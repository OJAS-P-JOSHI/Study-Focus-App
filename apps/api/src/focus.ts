import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Model, Types } from 'mongoose';
import { DistractionType, FocusSessionStatus } from './enums';
import type { AuthUser } from './common';
import { CurrentUser, serialize, serializeMany } from './common';
import { JwtAuthGuard } from './auth';
import {
  FocusSession,
  FocusSessionDocument,
  FocusSessionSchema,
  Subject,
  SubjectDocument,
  SubjectSchema,
  Task,
  TaskDocument,
  TaskSchema,
  UserSettings,
  UserSettingsDocument,
  UserSettingsSchema,
} from './schemas';

import { assertFocusTransition, calculateActualMinutes } from './focus-state';

export class CreateFocusSessionDto {
  @IsOptional()
  @IsMongoId()
  subjectId?: string;

  @IsOptional()
  @IsMongoId()
  taskId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  plannedMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  reminderIntervalMinutes?: number;
}

export class FocusQueryDto {
  @IsOptional()
  @IsEnum(FocusSessionStatus)
  status?: FocusSessionStatus;
}

export class CreateDistractionDto {
  @IsEnum(DistractionType)
  type!: DistractionType;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;
}

@Injectable()
export class FocusService {
  constructor(
    @InjectModel(FocusSession.name)
    private readonly sessions: Model<FocusSessionDocument>,
    @InjectModel(Subject.name)
    private readonly subjects: Model<SubjectDocument>,
    @InjectModel(Task.name) private readonly tasks: Model<TaskDocument>,
    @InjectModel(UserSettings.name)
    private readonly settings: Model<UserSettingsDocument>,
  ) {}

  async list(userId: string, query: FocusQueryDto) {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (query.status) filter.status = query.status;
    const docs = await this.sessions
      .find(filter)
      .populate('subjectId', 'name color icon')
      .populate('taskId', 'title status')
      .sort({ startedAt: -1 });
    return serializeMany(docs);
  }

  async get(userId: string, id: string) {
    const session = await this.sessions
      .findOne({ _id: id, userId: new Types.ObjectId(userId) })
      .populate('subjectId', 'name color icon')
      .populate('taskId', 'title status');
    if (!session) throw new NotFoundException('Focus session not found');
    return serialize(session);
  }

  async create(userId: string, dto: CreateFocusSessionDto) {
    await this.assertRelations(userId, dto.subjectId, dto.taskId);
    const active = await this.sessions.findOne({
      userId: new Types.ObjectId(userId),
      status: { $in: [FocusSessionStatus.ACTIVE, FocusSessionStatus.PAUSED] },
    });
    if (active)
      throw new ConflictException('An active or paused session already exists');
    const settings = await this.settings.findOne({
      userId: new Types.ObjectId(userId),
    });
    const session = await this.sessions.create({
      userId: new Types.ObjectId(userId),
      subjectId: dto.subjectId ? new Types.ObjectId(dto.subjectId) : undefined,
      taskId: dto.taskId ? new Types.ObjectId(dto.taskId) : undefined,
      startedAt: new Date(),
      plannedMinutes: dto.plannedMinutes ?? settings?.defaultFocusMinutes ?? 50,
      reminderIntervalMinutes:
        dto.reminderIntervalMinutes ??
        settings?.defaultReminderIntervalMinutes ??
        10,
      status: FocusSessionStatus.ACTIVE,
    });
    await session.populate([
      { path: 'subjectId', select: 'name color icon' },
      { path: 'taskId', select: 'title status' },
    ]);
    return serialize(session);
  }

  async pause(userId: string, id: string) {
    const session = await this.sessions.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!session) throw new NotFoundException('Focus session not found');
    assertFocusTransition(session.status, 'pause');
    session.status = FocusSessionStatus.PAUSED;
    session.pausedAt = new Date();
    await session.save();
    return serialize(session);
  }

  async resume(userId: string, id: string) {
    const session = await this.sessions.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!session) throw new NotFoundException('Focus session not found');
    assertFocusTransition(session.status, 'resume');
    const now = new Date();
    const pausedSeconds = session.pausedAt
      ? Math.max(
          0,
          Math.floor((now.getTime() - session.pausedAt.getTime()) / 1000),
        )
      : 0;
    session.status = FocusSessionStatus.ACTIVE;
    session.totalPausedSeconds += pausedSeconds;
    session.pausedAt = undefined;
    await session.save();
    return serialize(session);
  }

  complete(userId: string, id: string) {
    return this.finish(userId, id, FocusSessionStatus.COMPLETED);
  }

  cancel(userId: string, id: string) {
    return this.finish(userId, id, FocusSessionStatus.CANCELLED);
  }

  async addDistraction(userId: string, id: string, dto: CreateDistractionDto) {
    const session = await this.sessions.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!session) throw new NotFoundException('Focus session not found');
    if (
      session.status !== FocusSessionStatus.ACTIVE &&
      session.status !== FocusSessionStatus.PAUSED
    ) {
      throw new ConflictException(
        'Distractions can only be logged on an open session',
      );
    }
    session.distractions.push({
      type: dto.type,
      note: dto.note,
      occurredAt: new Date(),
    });
    session.distractionCount += 1;
    await session.save();
    return session.distractions[session.distractions.length - 1];
  }

  private async finish(
    userId: string,
    id: string,
    status: FocusSessionStatus.COMPLETED | FocusSessionStatus.CANCELLED,
  ) {
    const session = await this.sessions.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!session) throw new NotFoundException('Focus session not found');
    assertFocusTransition(
      session.status,
      status === FocusSessionStatus.COMPLETED ? 'complete' : 'cancel',
    );
    const endedAt = new Date();
    const pendingPauseSeconds = session.pausedAt
      ? Math.max(
          0,
          Math.floor((endedAt.getTime() - session.pausedAt.getTime()) / 1000),
        )
      : 0;
    const totalPausedSeconds = session.totalPausedSeconds + pendingPauseSeconds;
    session.totalPausedSeconds = totalPausedSeconds;
    session.status = status;
    session.endedAt = endedAt;
    session.actualMinutes = calculateActualMinutes(
      session.startedAt,
      endedAt,
      totalPausedSeconds,
    );
    session.pausedAt = undefined;
    session.completionPercentage = Math.min(
      100,
      Math.round((session.actualMinutes / session.plannedMinutes) * 100),
    );
    await session.save();
    return serialize(session);
  }

  private async assertRelations(
    userId: string,
    subjectId?: string,
    taskId?: string,
  ): Promise<void> {
    if (subjectId) {
      const subject = await this.subjects.findOne({
        _id: subjectId,
        userId: new Types.ObjectId(userId),
      });
      if (!subject) throw new BadRequestException('Subject not found');
    }
    if (taskId) {
      const task = await this.tasks.findOne({
        _id: taskId,
        userId: new Types.ObjectId(userId),
      });
      if (!task) throw new BadRequestException('Task not found');
    }
  }
}

@UseGuards(JwtAuthGuard)
@Controller('focus-sessions')
export class FocusController {
  constructor(private readonly service: FocusService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: FocusQueryDto) {
    return this.service.list(user.id, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.get(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFocusSessionDto) {
    return this.service.create(user.id, dto);
  }

  @Post(':id/pause')
  pause(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.pause(user.id, id);
  }

  @Post(':id/resume')
  resume(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.resume(user.id, id);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.complete(user.id, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.cancel(user.id, id);
  }

  @Post(':id/distractions')
  distraction(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateDistractionDto,
  ) {
    return this.service.addDistraction(user.id, id, dto);
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FocusSession.name, schema: FocusSessionSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Task.name, schema: TaskSchema },
      { name: UserSettings.name, schema: UserSettingsSchema },
    ]),
  ],
  controllers: [FocusController],
  providers: [FocusService],
})
export class FocusModule {}

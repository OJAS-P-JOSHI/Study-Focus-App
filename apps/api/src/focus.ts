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
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
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

export class SyncDistractionDto extends CreateDistractionDto {
  @IsDateString()
  occurredAt!: string;
}

export class SyncFocusSessionDto {
  @IsString()
  @Length(1, 120)
  clientSessionId!: string;

  @IsOptional()
  @IsMongoId()
  subjectId?: string;

  @IsOptional()
  @IsMongoId()
  taskId?: string;

  @IsDateString()
  startedAt!: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsOptional()
  @IsDateString()
  pausedAt?: string;

  @IsInt()
  @Min(0)
  totalPausedSeconds!: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  plannedMinutes!: number;

  @IsInt()
  @Min(1)
  @Max(240)
  reminderIntervalMinutes!: number;

  @IsEnum(FocusSessionStatus)
  status!: FocusSessionStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncDistractionDto)
  distractions: SyncDistractionDto[] = [];
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

  expire(userId: string, id: string) {
    return this.finish(userId, id, FocusSessionStatus.EXPIRED);
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

  async sync(userId: string, dto: SyncFocusSessionDto) {
    await this.assertRelations(userId, dto.subjectId, dto.taskId);
    const startedAt = new Date(dto.startedAt);
    const endedAt = dto.endedAt ? new Date(dto.endedAt) : undefined;
    const pausedAt = dto.pausedAt ? new Date(dto.pausedAt) : undefined;
    const now = Date.now();
    if (
      startedAt.getTime() > now + 60_000 ||
      startedAt.getTime() < now - 7 * 86_400_000
    ) {
      throw new BadRequestException(
        'Offline session start is outside the allowed range',
      );
    }
    if (endedAt && (endedAt < startedAt || endedAt.getTime() > now + 60_000)) {
      throw new BadRequestException('Offline session end is invalid');
    }
    if (
      dto.status === FocusSessionStatus.PAUSED &&
      (!pausedAt || pausedAt < startedAt)
    ) {
      throw new BadRequestException('Paused sessions require a valid pausedAt');
    }
    if (
      [
        FocusSessionStatus.COMPLETED,
        FocusSessionStatus.CANCELLED,
        FocusSessionStatus.EXPIRED,
      ].includes(dto.status) &&
      !endedAt
    ) {
      throw new BadRequestException('Closed sessions require endedAt');
    }
    const elapsedSeconds = Math.floor(
      ((endedAt?.getTime() ?? now) - startedAt.getTime()) / 1000,
    );
    if (dto.totalPausedSeconds > elapsedSeconds) {
      throw new BadRequestException('Paused time cannot exceed elapsed time');
    }
    const userObjectId = new Types.ObjectId(userId);
    const existing = await this.sessions.findOne({
      userId: userObjectId,
      clientSessionId: dto.clientSessionId,
    });
    if (
      existing &&
      [
        FocusSessionStatus.COMPLETED,
        FocusSessionStatus.CANCELLED,
        FocusSessionStatus.EXPIRED,
      ].includes(existing.status)
    ) {
      return serialize(existing);
    }
    const actualMinutes = endedAt
      ? calculateActualMinutes(
          startedAt,
          endedAt,
          dto.totalPausedSeconds,
          dto.status === FocusSessionStatus.PAUSED ? pausedAt : undefined,
        )
      : 0;
    const patch = {
      userId: userObjectId,
      clientSessionId: dto.clientSessionId,
      subjectId: dto.subjectId ? new Types.ObjectId(dto.subjectId) : undefined,
      taskId: dto.taskId ? new Types.ObjectId(dto.taskId) : undefined,
      startedAt,
      endedAt,
      pausedAt: dto.status === FocusSessionStatus.PAUSED ? pausedAt : undefined,
      totalPausedSeconds: dto.totalPausedSeconds,
      plannedMinutes: dto.plannedMinutes,
      actualMinutes,
      reminderIntervalMinutes: dto.reminderIntervalMinutes,
      status: dto.status,
      completionPercentage: Math.min(
        100,
        Math.round((actualMinutes / dto.plannedMinutes) * 100),
      ),
      distractionCount: dto.distractions.length,
      distractions: dto.distractions.map((event) => ({
        type: event.type,
        note: event.note,
        occurredAt: new Date(event.occurredAt),
      })),
    };
    const session = await this.sessions.findOneAndUpdate(
      { userId: userObjectId, clientSessionId: dto.clientSessionId },
      patch,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return serialize(session!);
  }

  private async finish(
    userId: string,
    id: string,
    status:
      | FocusSessionStatus.COMPLETED
      | FocusSessionStatus.CANCELLED
      | FocusSessionStatus.EXPIRED,
  ) {
    const session = await this.sessions.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!session) throw new NotFoundException('Focus session not found');
    if (status === FocusSessionStatus.EXPIRED) {
      const expiresAt =
        session.startedAt.getTime() +
        session.plannedMinutes * 60_000 +
        session.totalPausedSeconds * 1000;
      if (Date.now() < expiresAt) {
        throw new ConflictException(
          'Focus session has not reached its planned end',
        );
      }
    }
    const transition =
      status === FocusSessionStatus.COMPLETED
        ? 'complete'
        : status === FocusSessionStatus.CANCELLED
          ? 'cancel'
          : 'expire';
    assertFocusTransition(session.status, transition);
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
      if (subjectId && task.subjectId?.toString() !== subjectId) {
        throw new BadRequestException(
          'Task does not belong to the selected subject',
        );
      }
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

  @Post('sync')
  sync(@CurrentUser() user: AuthUser, @Body() dto: SyncFocusSessionDto) {
    return this.service.sync(user.id, dto);
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

  @Post(':id/expire')
  expire(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.expire(user.id, id);
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

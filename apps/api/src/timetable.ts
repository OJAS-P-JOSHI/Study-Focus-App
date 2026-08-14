import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Model, Types } from 'mongoose';
import type { AuthUser } from './common';
import { CurrentUser, serialize, serializeMany } from './common';
import { JwtAuthGuard } from './auth';
import {
  Subject,
  SubjectDocument,
  SubjectSchema,
  Task,
  TaskDocument,
  TaskSchema,
  TimetableEntry,
  TimetableEntryDocument,
  TimetableEntrySchema,
} from './schemas';

export class CreateTimetableDto {
  @IsMongoId()
  subjectId!: string;

  @IsOptional()
  @IsMongoId()
  taskId?: string;

  @IsString()
  @Length(1, 160)
  title!: string;

  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime!: string;

  @IsInt()
  @Min(1)
  @Max(1440)
  targetMinutes!: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class UpdateTimetableDto {
  @IsOptional()
  @IsMongoId()
  subjectId?: string;

  @IsOptional()
  @IsMongoId()
  taskId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  targetMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

@Injectable()
export class TimetableService {
  constructor(
    @InjectModel(TimetableEntry.name)
    private readonly entries: Model<TimetableEntryDocument>,
    @InjectModel(Subject.name)
    private readonly subjects: Model<SubjectDocument>,
    @InjectModel(Task.name) private readonly tasks: Model<TaskDocument>,
  ) {}

  async list(userId: string) {
    const docs = await this.entries
      .find({ userId: new Types.ObjectId(userId) })
      .populate('subjectId', 'name color icon')
      .populate('taskId', 'title status')
      .sort({ dayOfWeek: 1, startTime: 1 });
    return serializeMany(docs);
  }

  async get(userId: string, id: string) {
    const entry = await this.entries
      .findOne({ _id: id, userId: new Types.ObjectId(userId) })
      .populate('subjectId', 'name color icon')
      .populate('taskId', 'title status');
    if (!entry) throw new NotFoundException('Timetable entry not found');
    return serialize(entry);
  }

  async create(userId: string, dto: CreateTimetableDto) {
    this.assertTimes(dto.startTime, dto.endTime);
    await this.assertRelations(userId, dto.subjectId, dto.taskId);
    const entry = await this.entries.create({
      ...dto,
      title: dto.title.trim(),
      userId: new Types.ObjectId(userId),
      subjectId: new Types.ObjectId(dto.subjectId),
      taskId: dto.taskId ? new Types.ObjectId(dto.taskId) : undefined,
    });
    await entry.populate([
      { path: 'subjectId', select: 'name color icon' },
      { path: 'taskId', select: 'title status' },
    ]);
    return serialize(entry);
  }

  async update(userId: string, id: string, dto: UpdateTimetableDto) {
    const current = await this.entries.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!current) throw new NotFoundException('Timetable entry not found');
    const start = dto.startTime ?? current.startTime;
    const end = dto.endTime ?? current.endTime;
    this.assertTimes(start, end);
    await this.assertRelations(
      userId,
      dto.subjectId ?? current.subjectId.toString(),
      dto.taskId,
    );
    const entry = await this.entries
      .findByIdAndUpdate(
        id,
        {
          ...dto,
          title: dto.title?.trim(),
          subjectId: dto.subjectId
            ? new Types.ObjectId(dto.subjectId)
            : undefined,
          taskId: dto.taskId ? new Types.ObjectId(dto.taskId) : dto.taskId,
        },
        { new: true },
      )
      .populate('subjectId', 'name color icon')
      .populate('taskId', 'title status');
    return serialize(entry!);
  }

  async remove(userId: string, id: string) {
    await this.get(userId, id);
    await this.entries.findByIdAndDelete(id);
    return { deleted: true };
  }

  private assertTimes(start: string, end: string): void {
    if (end <= start)
      throw new BadRequestException('endTime must be after startTime');
  }

  private async assertRelations(
    userId: string,
    subjectId: string,
    taskId?: string,
  ): Promise<void> {
    const subject = await this.subjects.findOne({
      _id: subjectId,
      userId: new Types.ObjectId(userId),
    });
    if (!subject) throw new BadRequestException('Subject not found');
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
@Controller('timetable')
export class TimetableController {
  constructor(private readonly service: TimetableService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.get(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTimetableDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTimetableDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TimetableEntry.name, schema: TimetableEntrySchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Task.name, schema: TaskSchema },
    ]),
  ],
  controllers: [TimetableController],
  providers: [TimetableService],
})
export class TimetableModule {}

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
  Query,
  UseGuards,
} from '@nestjs/common';

import { InjectModel, MongooseModule } from '@nestjs/mongoose';

import {
  IsDateString,
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

import { TaskPriority, TaskStatus } from './enums';

import type { AuthUser } from './common';
import { CurrentUser, parseDate, serialize, serializeMany } from './common';

import { JwtAuthGuard } from './auth';

import {
  Subject,
  SubjectDocument,
  SubjectSchema,
  Task,
  TaskDocument,
  TaskSchema,
} from './schemas';

export class CreateTaskDto {
  @IsString()
  @Length(1, 160)
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsOptional()
  @IsMongoId()
  subjectId?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  estimatedMinutes?: number;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  description?: string;

  @IsOptional()
  @IsMongoId()
  subjectId?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  estimatedMinutes?: number;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class TaskQueryDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsMongoId()
  subjectId?: string;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<TaskDocument>,

    @InjectModel(Subject.name)
    private readonly subjects: Model<SubjectDocument>,
  ) {}

  async list(userId: string, query: TaskQueryDto) {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (query.status) filter.status = query.status;

    if (query.subjectId) filter.subjectId = new Types.ObjectId(query.subjectId);

    const docs = await this.tasks

      .find(filter)

      .populate('subjectId', 'name color icon')

      .sort({ dueAt: 1, createdAt: -1 });

    return serializeMany(docs);
  }

  async get(userId: string, id: string) {
    const task = await this.tasks

      .findOne({ _id: id, userId: new Types.ObjectId(userId) })

      .populate('subjectId', 'name color icon');

    if (!task) throw new NotFoundException('Task not found');

    return serialize(task);
  }

  async create(userId: string, dto: CreateTaskDto) {
    await this.assertSubject(userId, dto.subjectId);

    const task = await this.tasks.create({
      ...dto,

      userId: new Types.ObjectId(userId),

      title: dto.title.trim(),

      subjectId: dto.subjectId ? new Types.ObjectId(dto.subjectId) : undefined,

      dueAt: parseDate(dto.dueAt),
    });

    await task.populate('subjectId', 'name color icon');

    return serialize(task);
  }

  async update(userId: string, id: string, dto: UpdateTaskDto) {
    const existing = await this.tasks.findOne({
      _id: id,

      userId: new Types.ObjectId(userId),
    });

    if (!existing) throw new NotFoundException('Task not found');

    await this.assertSubject(userId, dto.subjectId);

    const status = dto.status;

    const task = await this.tasks

      .findOneAndUpdate(
        { _id: id, userId: new Types.ObjectId(userId) },

        {
          ...dto,

          title: dto.title?.trim(),

          subjectId: dto.subjectId
            ? new Types.ObjectId(dto.subjectId)
            : dto.subjectId,

          dueAt: parseDate(dto.dueAt),

          completedAt:
            status === TaskStatus.COMPLETED
              ? (existing.completedAt ?? new Date())
              : status
                ? null
                : undefined,
        },

        { new: true },
      )

      .populate('subjectId', 'name color icon');

    return serialize(task!);
  }

  async complete(userId: string, id: string) {
    const task = await this.tasks.findOneAndUpdate(
      { _id: id, userId: new Types.ObjectId(userId) },

      { status: TaskStatus.COMPLETED, completedAt: new Date() },

      { new: true },
    );
    if (!task) throw new NotFoundException('Task not found');

    return serialize(task);
  }

  async remove(userId: string, id: string) {
    const result = await this.tasks.deleteOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!result.deletedCount) throw new NotFoundException('Task not found');

    return { deleted: true };
  }

  private async assertSubject(
    userId: string,
    subjectId?: string,
  ): Promise<void> {
    if (!subjectId) return;

    const subject = await this.subjects.findOne({
      _id: subjectId,

      userId: new Types.ObjectId(userId),
    });

    if (!subject) throw new BadRequestException('Subject not found');
  }
}

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: TaskQueryDto) {
    return this.service.list(user.id, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.get(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,

    @Param('id') id: string,

    @Body() dto: UpdateTaskDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.complete(user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },

      { name: Subject.name, schema: SubjectSchema },
    ]),
  ],

  controllers: [TasksController],

  providers: [TasksService],
})
export class TasksModule {}

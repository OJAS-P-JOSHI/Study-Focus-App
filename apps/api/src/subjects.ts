import {
  Body,
  ConflictException,
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
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

import { Model, Types } from 'mongoose';

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
  TimetableEntry,
  TimetableEntryDocument,
  TimetableEntrySchema,
} from './schemas';

export class CreateSubjectDto {
  @IsString()
  @Length(1, 80)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  weeklyTargetMinutes?: number;
}

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  weeklyTargetMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Injectable()
export class SubjectsService {
  constructor(
    @InjectModel(Subject.name)
    private readonly subjects: Model<SubjectDocument>,
    @InjectModel(Task.name) private readonly tasks: Model<TaskDocument>,
    @InjectModel(TimetableEntry.name)
    private readonly timetable: Model<TimetableEntryDocument>,
    @InjectModel(FocusSession.name)
    private readonly sessions: Model<FocusSessionDocument>,
  ) {}

  async list(userId: string) {
    const docs = await this.subjects

      .find({ userId: new Types.ObjectId(userId) })

      .sort({ name: 1 });

    return serializeMany(docs);
  }

  async get(userId: string, id: string) {
    const subject = await this.subjects.findOne({
      _id: id,

      userId: new Types.ObjectId(userId),
    });

    if (!subject) throw new NotFoundException('Subject not found');

    return serialize(subject);
  }

  async create(userId: string, dto: CreateSubjectDto) {
    const subject = await this.subjects.create({
      ...dto,

      name: dto.name.trim(),

      userId: new Types.ObjectId(userId),
    });

    return serialize(subject);
  }

  async update(userId: string, id: string, dto: UpdateSubjectDto) {
    await this.get(userId, id);

    const subject = await this.subjects.findOneAndUpdate(
      { _id: id, userId: new Types.ObjectId(userId) },

      { ...dto, ...(dto.name ? { name: dto.name.trim() } : {}) },

      { new: true },
    );

    return serialize(subject!);
  }

  async remove(userId: string, id: string) {
    await this.get(userId, id);

    const subjectId = new Types.ObjectId(id);
    const [task, timetable, session] = await Promise.all([
      this.tasks.exists({ userId: new Types.ObjectId(userId), subjectId }),
      this.timetable.exists({ userId: new Types.ObjectId(userId), subjectId }),
      this.sessions.exists({ userId: new Types.ObjectId(userId), subjectId }),
    ]);
    if (task || timetable || session) {
      throw new ConflictException(
        'Subject has related study data; deactivate it instead of deleting it',
      );
    }

    await this.subjects.deleteOne({
      _id: subjectId,
      userId: new Types.ObjectId(userId),
    });

    return { deleted: true };
  }
}

@UseGuards(JwtAuthGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly service: SubjectsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.get(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSubjectDto) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,

    @Param('id') id: string,

    @Body() dto: UpdateSubjectDto,
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
      { name: Subject.name, schema: SubjectSchema },
      { name: Task.name, schema: TaskSchema },
      { name: TimetableEntry.name, schema: TimetableEntrySchema },
      { name: FocusSession.name, schema: FocusSessionSchema },
    ]),
  ],

  controllers: [SubjectsController],

  providers: [SubjectsService],
})
export class SubjectsModule {}

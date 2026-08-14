import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Model, Types } from 'mongoose';
import { Theme } from './enums';
import type { AuthUser } from './common';
import { CurrentUser, serialize } from './common';
import { JwtAuthGuard } from './auth';
import {
  FocusSession,
  FocusSessionDocument,
  FocusSessionSchema,
  StudyGoal,
  StudyGoalDocument,
  StudyGoalSchema,
  Subject,
  SubjectDocument,
  SubjectSchema,
  Task,
  TaskDocument,
  TaskSchema,
  TimetableEntry,
  TimetableEntryDocument,
  TimetableEntrySchema,
  User,
  UserDocument,
  UserSchema,
  UserSettings,
  UserSettingsDocument,
  UserSettingsSchema,
} from './schemas';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  defaultFocusMinutes?: number;

  @IsOptional()
  @IsInt()
  @IsIn([5, 10, 15, 20, 25, 30])
  defaultReminderIntervalMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  dailyStudyTargetMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
  weeklyStudyTargetMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  minimumStreakMinutes?: number;

  @IsOptional()
  @IsEnum(Theme)
  theme?: Theme;

  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  vibrationEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  timezone?: string;
}

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(UserSettings.name)
    private readonly settings: Model<UserSettingsDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Subject.name)
    private readonly subjects: Model<SubjectDocument>,
    @InjectModel(Task.name) private readonly tasks: Model<TaskDocument>,
    @InjectModel(TimetableEntry.name)
    private readonly timetable: Model<TimetableEntryDocument>,
    @InjectModel(FocusSession.name)
    private readonly sessions: Model<FocusSessionDocument>,
    @InjectModel(StudyGoal.name)
    private readonly goals: Model<StudyGoalDocument>,
  ) {}

  async get(userId: string) {
    const [settings, user] = await Promise.all([
      this.settings.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        {},
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
      this.users.findById(userId).select('name email timezone'),
    ]);
    return {
      ...serialize(settings!)!,
      name: user?.name,
      email: user?.email,
      timezone: user?.timezone ?? 'UTC',
    };
  }

  async update(userId: string, dto: UpdateSettingsDto) {
    const { timezone, name, ...settingsPatch } = dto;
    if (timezone) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
      } catch {
        throw new BadRequestException(
          'timezone must be a valid IANA time zone',
        );
      }
    }
    await this.settings.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      settingsPatch,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (timezone || name) {
      await this.users.findByIdAndUpdate(userId, {
        ...(timezone ? { timezone } : {}),
        ...(name ? { name: name.trim() } : {}),
      });
    }
    return this.get(userId);
  }

  async resetData(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    await Promise.all([
      this.subjects.deleteMany({ userId: userObjectId }),
      this.tasks.deleteMany({ userId: userObjectId }),
      this.timetable.deleteMany({ userId: userObjectId }),
      this.sessions.deleteMany({ userId: userObjectId }),
      this.goals.deleteMany({ userId: userObjectId }),
      this.settings.deleteOne({ userId: userObjectId }),
    ]);
    return { reset: true, settings: await this.get(userId) };
  }
}

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.service.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.service.update(user.id, dto);
  }

  @Delete('data')
  resetData(@CurrentUser() user: AuthUser) {
    return this.service.resetData(user.id);
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserSettings.name, schema: UserSettingsSchema },
      { name: User.name, schema: UserSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: Task.name, schema: TaskSchema },
      { name: TimetableEntry.name, schema: TimetableEntrySchema },
      { name: FocusSession.name, schema: FocusSessionSchema },
      { name: StudyGoal.name, schema: StudyGoalSchema },
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}

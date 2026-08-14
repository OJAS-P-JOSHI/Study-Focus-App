import {
  BadRequestException,
  Body,
  Controller,
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
  User,
  UserDocument,
  UserSchema,
  UserSettings,
  UserSettingsDocument,
  UserSettingsSchema,
} from './schemas';

export class UpdateSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  defaultFocusMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
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
  ) {}

  async get(userId: string) {
    const [settings, user] = await Promise.all([
      this.settings.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        {},
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
      this.users.findById(userId).select('timezone'),
    ]);
    return {
      ...serialize(settings!)!,
      timezone: user?.timezone ?? 'UTC',
    };
  }

  async update(userId: string, dto: UpdateSettingsDto) {
    const { timezone, ...settingsPatch } = dto;
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
    if (timezone) {
      await this.users.findByIdAndUpdate(userId, { timezone });
    }
    return this.get(userId);
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
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserSettings.name, schema: UserSettingsSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}

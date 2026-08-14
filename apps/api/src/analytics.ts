import {
  Controller,
  Get,
  Injectable,
  Module,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import { IsDateString, IsOptional } from 'class-validator';
import { Model, Types } from 'mongoose';
import { FocusSessionStatus } from './enums';
import type { AuthUser } from './common';
import { CurrentUser } from './common';
import { JwtAuthGuard } from './auth';
import {
  FocusSession,
  FocusSessionDocument,
  FocusSessionSchema,
  Subject,
  SubjectDocument,
  SubjectSchema,
  User,
  UserDocument,
  UserSchema,
  UserSettings,
  UserSettingsDocument,
  UserSettingsSchema,
} from './schemas';

import { calculateStreak, shiftDateKey } from './streak';

export class AnalyticsDateDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}

interface DailyPoint {
  date: string;
  minutes: number;
  sessions: number;
  distractions: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(UserSettings.name)
    private readonly settings: Model<UserSettingsDocument>,
    @InjectModel(FocusSession.name)
    private readonly sessions: Model<FocusSessionDocument>,
    @InjectModel(Subject.name)
    private readonly subjectModel: Model<SubjectDocument>,
  ) {}

  async overview(userId: string) {
    const data = await this.load(userId);
    const today = this.dateKey(new Date(), data.timezone);
    const weekKeys = this.range(today, 7);
    const monthPrefix = today.slice(0, 7);
    const streak = calculateStreak(
      data.minutesByDay,
      data.minimumStreak,
      today,
    );
    return {
      today: this.point(today, data.points),
      weeklyMinutes: this.sumKeys(data.minutesByDay, weekKeys),
      monthlyMinutes: Object.entries(data.minutesByDay)
        .filter(([key]) => key.startsWith(monthPrefix))
        .reduce((sum, [, minutes]) => sum + minutes, 0),
      totalMinutes: Object.values(data.minutesByDay).reduce((a, b) => a + b, 0),
      completedSessions: data.completedSessions,
      streak,
    };
  }

  async daily(userId: string, requested?: string) {
    const data = await this.load(userId);
    const day =
      requested?.slice(0, 10) ?? this.dateKey(new Date(), data.timezone);
    return this.point(day, data.points);
  }

  async weekly(userId: string, requested?: string) {
    const data = await this.load(userId);
    const end =
      requested?.slice(0, 10) ?? this.dateKey(new Date(), data.timezone);
    const days = this.range(end, 7).map((day) => this.point(day, data.points));
    return {
      startDate: days[0].date,
      endDate: end,
      days,
      totalMinutes: days.reduce((sum, day) => sum + day.minutes, 0),
    };
  }

  async monthly(userId: string, requested?: string) {
    const data = await this.load(userId);
    const key =
      requested?.slice(0, 7) ??
      this.dateKey(new Date(), data.timezone).slice(0, 7);
    const days = [...data.points.values()].filter((point) =>
      point.date.startsWith(key),
    );
    return {
      month: key,
      days,
      totalMinutes: days.reduce((sum, day) => sum + day.minutes, 0),
      sessions: days.reduce((sum, day) => sum + day.sessions, 0),
    };
  }

  async subjects(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const grouped = await this.sessions.aggregate<{
      _id: Types.ObjectId | null;
      minutes: number;
      sessions: number;
    }>([
      {
        $match: {
          userId: userObjectId,
          status: FocusSessionStatus.COMPLETED,
        },
      },
      {
        $group: {
          _id: '$subjectId',
          minutes: { $sum: '$actualMinutes' },
          sessions: { $sum: 1 },
        },
      },
    ]);
    const subjects = await this.subjectModel
      .find({ userId: userObjectId })
      .select('name color icon');
    const lookup = new Map(
      subjects.map((subject) => [subject._id.toString(), subject.toJSON()]),
    );
    return grouped.map((row) => ({
      subject: row._id ? (lookup.get(row._id.toString()) ?? null) : null,
      minutes: row.minutes,
      sessions: row.sessions,
    }));
  }

  async streak(userId: string) {
    const data = await this.load(userId);
    const today = this.dateKey(new Date(), data.timezone);
    return {
      ...calculateStreak(data.minutesByDay, data.minimumStreak, today),
      minimumMinutes: data.minimumStreak,
    };
  }

  private async load(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const [user, settings] = await Promise.all([
      this.users.findById(userId).select('timezone'),
      this.settings.findOne({ userId: userObjectId }),
    ]);
    const timezone = user?.timezone ?? 'UTC';
    const grouped = await this.sessions.aggregate<DailyPoint>([
      {
        $match: {
          userId: userObjectId,
          status: FocusSessionStatus.COMPLETED,
          endedAt: { $gte: new Date(Date.now() - 400 * 86_400_000) },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              date: '$endedAt',
              format: '%Y-%m-%d',
              timezone,
            },
          },
          minutes: { $sum: '$actualMinutes' },
          sessions: { $sum: 1 },
          distractions: { $sum: '$distractionCount' },
        },
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          minutes: 1,
          sessions: 1,
          distractions: 1,
        },
      },
      { $sort: { date: 1 } },
    ]);
    const points = new Map(grouped.map((point) => [point.date, point]));
    return {
      timezone,
      minimumStreak: settings?.minimumStreakMinutes ?? 30,
      completedSessions: grouped.reduce(
        (sum, point) => sum + point.sessions,
        0,
      ),
      points,
      minutesByDay: Object.fromEntries(
        [...points].map(([key, point]) => [key, point.minutes]),
      ),
    };
  }

  private point(day: string, points: Map<string, DailyPoint>): DailyPoint {
    return (
      points.get(day) ?? { date: day, minutes: 0, sessions: 0, distractions: 0 }
    );
  }

  private range(end: string, count: number): string[] {
    return Array.from({ length: count }, (_, index) =>
      shiftDateKey(end, index - count + 1),
    );
  }

  private sumKeys(values: Record<string, number>, keys: string[]): number {
    return keys.reduce((sum, key) => sum + (values[key] ?? 0), 0);
  }

  private dateKey(date: Date, timezone: string): string {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const value = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
      );
      return `${value.year}-${value.month}-${value.day}`;
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }
}

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.service.overview(user.id);
  }

  @Get('daily')
  daily(@CurrentUser() user: AuthUser, @Query() query: AnalyticsDateDto) {
    return this.service.daily(user.id, query.date);
  }

  @Get('weekly')
  weekly(@CurrentUser() user: AuthUser, @Query() query: AnalyticsDateDto) {
    return this.service.weekly(user.id, query.date);
  }

  @Get('monthly')
  monthly(@CurrentUser() user: AuthUser, @Query() query: AnalyticsDateDto) {
    return this.service.monthly(user.id, query.date);
  }

  @Get('subjects')
  subjects(@CurrentUser() user: AuthUser) {
    return this.service.subjects(user.id);
  }

  @Get('streak')
  streak(@CurrentUser() user: AuthUser) {
    return this.service.streak(user.id);
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserSettings.name, schema: UserSettingsSchema },
      { name: FocusSession.name, schema: FocusSessionSchema },
      { name: Subject.name, schema: SubjectSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}

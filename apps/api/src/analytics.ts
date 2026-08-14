import {
  Controller,
  Get,
  Injectable,
  Module,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectModel, MongooseModule } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional } from 'class-validator';
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

import { calculateStreak, shiftDateKey } from './streak';

export class AnalyticsDateDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class AnalyticsRangeDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsIn([7, 30, 90])
  days = 30;
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
    @InjectModel(TimetableEntry.name)
    private readonly timetable: Model<TimetableEntryDocument>,
  ) {}

  async overview(userId: string, days = 30) {
    const data = await this.load(userId);
    const today = this.dateKey(new Date(), data.timezone);
    const weekKeys = this.range(today, 7);
    const monthPrefix = today.slice(0, 7);
    const streak = calculateStreak(
      data.minutesByDay,
      data.minimumStreak,
      today,
    );
    const since = new Date(Date.now() - days * 86_400_000);
    const [rangeSummary] = await this.sessions.aggregate<{
      minutes: number;
      sessions: number;
      averageSessionDuration: number;
      averageDistractions: number;
    }>([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          status: FocusSessionStatus.COMPLETED,
          endedAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: null,
          minutes: { $sum: '$actualMinutes' },
          sessions: { $sum: 1 },
          averageSessionDuration: { $avg: '$actualMinutes' },
          averageDistractions: { $avg: '$distractionCount' },
        },
      },
    ]);
    return {
      today: this.point(today, data.points),
      weeklyMinutes: this.sumKeys(data.minutesByDay, weekKeys),
      monthlyMinutes: Object.entries(data.minutesByDay)
        .filter(([key]) => key.startsWith(monthPrefix))
        .reduce((sum, [, minutes]) => sum + minutes, 0),
      totalMinutes: Object.values(data.minutesByDay).reduce((a, b) => a + b, 0),
      completedSessions: data.completedSessions,
      streak,
      rangeDays: days,
      rangeMinutes: rangeSummary?.minutes ?? 0,
      rangeSessions: rangeSummary?.sessions ?? 0,
      averageSessionDuration: Math.round(rangeSummary?.averageSessionDuration ?? 0),
      averageDistractions: Number(
        (rangeSummary?.averageDistractions ?? 0).toFixed(1),
      ),
      timetableAdherence: await this.adherence(userId, days, data.timezone),
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

  async subjects(userId: string, days = 90) {
    const userObjectId = new Types.ObjectId(userId);
    const since = new Date(Date.now() - days * 86_400_000);
    const grouped = await this.sessions.aggregate<{
      _id: Types.ObjectId | null;
      minutes: number;
      sessions: number;
    }>([
      {
        $match: {
          userId: userObjectId,
          status: FocusSessionStatus.COMPLETED,
          endedAt: { $gte: since },
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

  async history(userId: string, days: number) {
    const data = await this.load(userId, days);
    const today = this.dateKey(new Date(), data.timezone);
    const points = this.range(today, days).map((day) =>
      this.point(day, data.points),
    );
    return {
      days,
      startDate: points[0]?.date,
      endDate: today,
      totalMinutes: points.reduce((sum, point) => sum + point.minutes, 0),
      sessions: points.reduce((sum, point) => sum + point.sessions, 0),
      points,
    };
  }

  private async load(userId: string, days = 400) {
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
          endedAt: { $gte: new Date(Date.now() - days * 86_400_000) },
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

  private async adherence(userId: string, days: number, timezone: string) {
    const userObjectId = new Types.ObjectId(userId);
    const since = new Date(Date.now() - days * 86_400_000);
    const [entries, sessions] = await Promise.all([
      this.timetable.find({ userId: userObjectId, isEnabled: true }).lean(),
      this.sessions
        .find({
          userId: userObjectId,
          status: FocusSessionStatus.COMPLETED,
          startedAt: { $gte: since },
        })
        .select('subjectId startedAt')
        .lean(),
    ]);
    const sessionKeys = sessions.map((session) => {
      const local = this.localParts(session.startedAt, timezone);
      return {
        subjectId: session.subjectId?.toString(),
        date: local.date,
        minutes: local.minutes,
      };
    });
    let planned = 0;
    let completed = 0;
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(Date.now() - offset * 86_400_000);
      const local = this.localParts(date, timezone);
      for (const entry of entries) {
        if (entry.dayOfWeek !== local.dayOfWeek) continue;
        const isPast =
          local.date < this.dateKey(new Date(), timezone) ||
          this.timeMinutes(entry.endTime) <= this.localParts(new Date(), timezone).minutes;
        if (!isPast) continue;
        planned += 1;
        if (
          sessionKeys.some(
            (session) =>
              session.date === local.date &&
              session.subjectId === entry.subjectId.toString() &&
              session.minutes >= this.timeMinutes(entry.startTime) &&
              session.minutes < this.timeMinutes(entry.endTime),
          )
        ) {
          completed += 1;
        }
      }
    }
    return {
      planned,
      completed,
      percentage: planned ? Math.round((completed / planned) * 100) : 0,
    };
  }

  private localParts(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      values.weekday,
    );
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      dayOfWeek,
      minutes: Number(values.hour) * 60 + Number(values.minute),
    };
  }

  private timeMinutes(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
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
  overview(@CurrentUser() user: AuthUser, @Query() query: AnalyticsRangeDto) {
    return this.service.overview(user.id, query.days);
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
  subjects(@CurrentUser() user: AuthUser, @Query() query: AnalyticsRangeDto) {
    return this.service.subjects(user.id, query.days);
  }

  @Get('streak')
  streak(@CurrentUser() user: AuthUser) {
    return this.service.streak(user.id);
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser, @Query() query: AnalyticsRangeDto) {
    return this.service.history(user.id, query.days);
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserSettings.name, schema: UserSettingsSchema },
      { name: FocusSession.name, schema: FocusSessionSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: TimetableEntry.name, schema: TimetableEntrySchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}

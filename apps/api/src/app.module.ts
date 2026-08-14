import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AnalyticsModule } from './analytics';
import { AuthModule } from './auth';
import { DatabaseModule } from './database';
import { FocusModule } from './focus';
import { SettingsModule } from './settings';
import { SubjectsModule } from './subjects';
import { TasksModule } from './tasks';
import { TimetableModule } from './timetable';

function validateConfig(raw: Record<string, unknown>): Record<string, unknown> {
  const required = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  for (const key of required) {
    if (typeof raw[key] !== 'string' || !raw[key]) {
      throw new Error(`${key} is required`);
    }
  }
  for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    if ((raw[key] as string).length < 32) {
      throw new Error(`${key} must be at least 32 characters`);
    }
  }
  return raw;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateConfig,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.refreshToken',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTED]',
        },
      },
    }),
    DatabaseModule,
    AuthModule,
    SubjectsModule,
    TasksModule,
    TimetableModule,
    FocusModule,
    SettingsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}

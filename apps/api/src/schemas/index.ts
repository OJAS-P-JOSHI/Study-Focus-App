import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import {
  DistractionType,
  FocusSessionStatus,
  GoalPeriod,
  TaskPriority,
  TaskStatus,
  Theme,
} from '../enums';

const jsonTransform = (_doc: unknown, ret: any) => {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  return ret;
};

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, lowercase: true, trim: true, maxlength: 254 })
  email!: string;

  @Prop({ required: true, select: false })
  passwordHash!: string;

  @Prop({ required: true, trim: true, minlength: 2, maxlength: 80 })
  name!: string;

  @Prop({ default: 'UTC' })
  timezone!: string;

  @Prop({ type: String, default: null, select: false })
  refreshTokenHash?: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.set('toJSON', { transform: jsonTransform });

@Schema({ timestamps: true, collection: 'subjects' })
export class Subject {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name!: string;

  @Prop({ maxlength: 500 })
  description?: string;

  @Prop({ default: '#8B9DFF', match: /^#[0-9a-f]{6}$/i })
  color!: string;

  @Prop({ default: 'book', maxlength: 40 })
  icon!: string;

  @Prop({ default: 0, min: 0, max: 10080 })
  weeklyTargetMinutes!: number;

  @Prop({ default: true })
  isActive!: boolean;
}

export type SubjectDocument = HydratedDocument<Subject>;
export const SubjectSchema = SchemaFactory.createForClass(Subject);
SubjectSchema.index({ userId: 1 });
SubjectSchema.index({ userId: 1, name: 1 }, { unique: true });
SubjectSchema.set('toJSON', { transform: jsonTransform });

@Schema({ timestamps: true, collection: 'tasks' })
export class Task {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subject' })
  subjectId?: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 160 })
  title!: string;

  @Prop({ maxlength: 2000 })
  description?: string;

  @Prop({ type: String, enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority!: TaskPriority;

  @Prop({ min: 1, max: 10080 })
  estimatedMinutes?: number;

  @Prop()
  dueAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop({ type: String, enum: TaskStatus, default: TaskStatus.TODO })
  status!: TaskStatus;
}

export type TaskDocument = HydratedDocument<Task>;
export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ userId: 1, status: 1 });
TaskSchema.index({ subjectId: 1 });
TaskSchema.set('toJSON', { transform: jsonTransform });

@Schema({ timestamps: true, collection: 'timetableEntries' })
export class TimetableEntry {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subject', required: true })
  subjectId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Task' })
  taskId?: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 160 })
  title!: string;

  @Prop({ required: true, min: 0, max: 6 })
  dayOfWeek!: number;

  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  startTime!: string;

  @Prop({ required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ })
  endTime!: string;

  @Prop({ required: true, min: 1, max: 1440 })
  targetMinutes!: number;

  @Prop({ default: true })
  isEnabled!: boolean;
}

export type TimetableEntryDocument = HydratedDocument<TimetableEntry>;
export const TimetableEntrySchema =
  SchemaFactory.createForClass(TimetableEntry);
TimetableEntrySchema.index({ userId: 1, dayOfWeek: 1 });
TimetableEntrySchema.set('toJSON', { transform: jsonTransform });

@Schema({ _id: true })
export class EmbeddedDistraction {
  @Prop({ type: String, enum: DistractionType, required: true })
  type!: DistractionType;

  @Prop({ maxlength: 500 })
  note?: string;

  @Prop({ default: () => new Date() })
  occurredAt!: Date;
}

const EmbeddedDistractionSchema =
  SchemaFactory.createForClass(EmbeddedDistraction);

@Schema({ timestamps: true, collection: 'focusSessions' })
export class FocusSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Subject' })
  subjectId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Task' })
  taskId?: Types.ObjectId;

  @Prop({ required: true })
  startedAt!: Date;

  @Prop()
  endedAt?: Date;

  @Prop()
  pausedAt?: Date;

  @Prop({ default: 0, min: 0 })
  totalPausedSeconds!: number;

  @Prop({ required: true, min: 1, max: 1440 })
  plannedMinutes!: number;

  @Prop({ default: 0, min: 0 })
  actualMinutes!: number;

  @Prop({ required: true, min: 1, max: 240 })
  reminderIntervalMinutes!: number;

  @Prop({
    type: String,
    enum: FocusSessionStatus,
    default: FocusSessionStatus.ACTIVE,
  })
  status!: FocusSessionStatus;

  @Prop({ default: 0, min: 0, max: 100 })
  completionPercentage!: number;

  @Prop({ default: 0, min: 0 })
  distractionCount!: number;

  @Prop({ type: [EmbeddedDistractionSchema], default: [] })
  distractions!: EmbeddedDistraction[];
}

export type FocusSessionDocument = HydratedDocument<FocusSession>;
export const FocusSessionSchema = SchemaFactory.createForClass(FocusSession);
FocusSessionSchema.index({ userId: 1 });
FocusSessionSchema.index({ startedAt: 1 });
FocusSessionSchema.index({ userId: 1, startedAt: -1 });
FocusSessionSchema.index({ userId: 1, status: 1 });
FocusSessionSchema.set('toJSON', { transform: jsonTransform });

@Schema({ timestamps: true, collection: 'userSettings' })
export class UserSettings {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ default: 50, min: 1, max: 1440 })
  defaultFocusMinutes!: number;

  @Prop({ default: 10, min: 1, max: 240 })
  defaultReminderIntervalMinutes!: number;

  @Prop({ default: 180, min: 1, max: 1440 })
  dailyStudyTargetMinutes!: number;

  @Prop({ default: 1260, min: 1, max: 10080 })
  weeklyStudyTargetMinutes!: number;

  @Prop({ default: 30, min: 1, max: 1440 })
  minimumStreakMinutes!: number;

  @Prop({ type: String, enum: Theme, default: Theme.DARK })
  theme!: Theme;

  @Prop({ default: true })
  soundEnabled!: boolean;

  @Prop({ default: true })
  vibrationEnabled!: boolean;

  @Prop({ default: true })
  notificationsEnabled!: boolean;
}

export type UserSettingsDocument = HydratedDocument<UserSettings>;
export const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);
UserSettingsSchema.index({ userId: 1 }, { unique: true });
UserSettingsSchema.set('toJSON', { transform: jsonTransform });

@Schema({ timestamps: true, collection: 'studyGoals' })
export class StudyGoal {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, enum: GoalPeriod, required: true })
  period!: GoalPeriod;

  @Prop({ required: true, min: 1, max: 10080 })
  targetMinutes!: number;
}

export type StudyGoalDocument = HydratedDocument<StudyGoal>;
export const StudyGoalSchema = SchemaFactory.createForClass(StudyGoal);
StudyGoalSchema.index({ userId: 1 });
StudyGoalSchema.set('toJSON', { transform: jsonTransform });

export function assertObjectId(value: string, label = 'id'): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`Invalid ${label}`);
  }
  return new Types.ObjectId(value);
}

export function toObjectId(
  value: string | undefined,
): Types.ObjectId | undefined {
  return value ? assertObjectId(value) : undefined;
}

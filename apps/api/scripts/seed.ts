import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import {
  FocusSession,
  FocusSessionSchema,
  StudyGoal,
  StudyGoalSchema,
  Subject,
  SubjectSchema,
  User,
  UserSchema,
  UserSettings,
  UserSettingsSchema,
} from '../src/schemas';
import { GoalPeriod } from '../src/enums';

async function seed() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/studyapp';
  await mongoose.connect(uri);

  const UserModel = mongoose.model(User.name, UserSchema);
  const SettingsModel = mongoose.model(UserSettings.name, UserSettingsSchema);
  const SubjectModel = mongoose.model(Subject.name, SubjectSchema);
  const GoalModel = mongoose.model(StudyGoal.name, StudyGoalSchema);
  const SessionModel = mongoose.model(FocusSession.name, FocusSessionSchema);

  const email = 'demo@studyfocus.app';
  let user = await UserModel.findOne({ email });
  if (!user) {
    user = await UserModel.create({
      email,
      name: 'Demo Student',
      passwordHash: await bcrypt.hash('password123', 12),
      timezone: 'UTC',
    });
    await SettingsModel.create({ userId: user._id });
    await SubjectModel.create({
      userId: user._id,
      name: 'Mathematics',
      description: 'Core algebra and calculus',
      color: '#8B9DFF',
      icon: 'book',
      weeklyTargetMinutes: 300,
    });
    await GoalModel.create({
      userId: user._id,
      period: GoalPeriod.DAILY,
      targetMinutes: 180,
    });
    await GoalModel.create({
      userId: user._id,
      period: GoalPeriod.WEEKLY,
      targetMinutes: 1260,
    });
    console.log(`Seeded demo user ${email} / password123`);
  } else {
    console.log(`Demo user already exists: ${email}`);
  }

  const sessionCount = await SessionModel.countDocuments({ userId: user._id });
  console.log(`Existing focus sessions for demo user: ${sessionCount}`);
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});

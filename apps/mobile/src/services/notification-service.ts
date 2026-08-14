import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import type { FocusSession } from '@/types';

const STORAGE_KEY = '@study-focus/notifications/v1';
const CHANNEL_ID = 'focus-reminders';
export const PRODUCTION_INTERVALS = [5, 10, 15, 20, 25, 30] as const;

type NotificationRecord = {
  sessionId: string;
  notificationIds: string[];
  intervalMinutes: number;
  timezone: string;
};

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';

async function readRecord(): Promise<NotificationRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NotificationRecord) : null;
  } catch {
    return null;
  }
}

async function writeRecord(record: NotificationRecord | null) {
  if (record) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  else await AsyncStorage.removeItem(STORAGE_KEY);
}

export const NotificationService = {
  async initialize() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Focus reminders',
        description: 'Gentle reminders while a focus session is active',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 150],
        lightColor: '#7ED6AC',
      });
    }
  },

  async requestPermission() {
    if (Platform.OS === 'web') return false;
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  },

  async cancelSession(sessionId?: string) {
    const record = await readRecord();
    if (!record || (sessionId && record.sessionId !== sessionId)) return;
    await Promise.all(
      record.notificationIds.map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
      ),
    );
    await writeRecord(null);
  },

  async scheduleForActiveSession(
    session: FocusSession,
    allowDevMinute = session.devReminderOptIn === true,
  ) {
    if (session.status !== 'ACTIVE' || Platform.OS === 'web') return false;
    const interval = session.reminderMinutes;
    const valid = PRODUCTION_INTERVALS.includes(interval as (typeof PRODUCTION_INTERVALS)[number]);
    if (!valid && !(__DEV__ && allowDevMinute && interval === 1)) return false;
    if (!(await this.requestPermission())) return false;

    const existing = await readRecord();
    if (
      existing?.sessionId === session.id &&
      existing.intervalMinutes === interval &&
      existing.timezone === timezone() &&
      existing.notificationIds.length > 0
    ) {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      if (existing.notificationIds.every((id) => scheduled.some((item) => item.identifier === id))) {
        return true;
      }
    }
    if (existing) await this.cancelSession(existing.sessionId);

    const notificationIds: string[] = [];
    const intervalMs = interval * 60_000;
    try {
      for (let firesAt = Date.now() + intervalMs; firesAt < session.endsAt; firesAt += intervalMs) {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Return to your focus',
            body: `${session.subjectName} is still in progress. Take one calm breath and continue.`,
            data: { sessionId: session.id, kind: 'focus-reminder' },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(firesAt),
            ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
          },
        });
        notificationIds.push(id);
      }
    } catch {
      await Promise.all(
        notificationIds.map((id) =>
          Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
        ),
      );
      return false;
    }
    await writeRecord({
      sessionId: session.id,
      notificationIds,
      intervalMinutes: interval,
      timezone: timezone(),
    });
    return true;
  },

  async reconcile(
    session: FocusSession | null,
    allowDevMinute = session?.devReminderOptIn === true,
  ) {
    const record = await readRecord();
    if (!session || session.status !== 'ACTIVE' || Date.now() >= session.endsAt) {
      if (record) await this.cancelSession(record.sessionId);
      return;
    }
    if (
      record?.sessionId !== session.id ||
      record.intervalMinutes !== session.reminderMinutes ||
      record.timezone !== timezone()
    ) {
      await this.scheduleForActiveSession(session, allowDevMinute);
      return;
    }
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    if (!record.notificationIds.every((id) => scheduled.some((item) => item.identifier === id))) {
      await this.scheduleForActiveSession(session, allowDevMinute);
    }
  },

  listenForForegroundReconciliation(getSession: () => FocusSession | null) {
    return AppState.addEventListener('change', (state) => {
      if (state === 'active') void this.reconcile(getSession());
    });
  },
};

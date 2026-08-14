import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { enqueueMutation } from '@/services/offline-queue';
import { NotificationService } from '@/services/notification-service';
import type { FocusSession } from '@/types';

type StartInput = Pick<
  FocusSession,
  'subjectId' | 'subjectName' | 'task' | 'durationMinutes' | 'reminderMinutes'
> & { allowDevMinute?: boolean };

type FocusState = {
  session: FocusSession | null;
  lastCompleted: FocusSession | null;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  start: (input: StartInput) => Promise<FocusSession>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  complete: () => Promise<void>;
  cancel: () => Promise<void>;
  reconcile: () => Promise<void>;
  clearSummary: () => void;
};

const id = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function getRemainingMs(session: FocusSession | null, now = Date.now()) {
  if (!session) return 0;
  const effectiveNow = session.status === 'PAUSED' && session.pausedAt ? session.pausedAt : now;
  return Math.max(0, session.endsAt - effectiveNow);
}

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      session: null,
      lastCompleted: null,
      hydrated: false,
      setHydrated: (hydrated) => set({ hydrated }),
      start: async (input) => {
        const now = Date.now();
        const session: FocusSession = {
          id: id(),
          subjectId: input.subjectId,
          subjectName: input.subjectName,
          task: input.task,
          durationMinutes: input.durationMinutes,
          reminderMinutes: input.reminderMinutes,
          devReminderOptIn: __DEV__ && input.allowDevMinute === true,
          status: 'ACTIVE',
          startedAt: now,
          endsAt: now + input.durationMinutes * 60_000,
          totalPausedMs: 0,
        };
        set({ session, lastCompleted: null });
        await enqueueMutation({ method: 'post', path: '/focus/sessions', body: session });
        await NotificationService.scheduleForActiveSession(session, input.allowDevMinute);
        return session;
      },
      pause: async () => {
        const session = get().session;
        if (!session || session.status !== 'ACTIVE') return;
        set({ session: { ...session, status: 'PAUSED', pausedAt: Date.now() } });
        await NotificationService.cancelSession(session.id);
      },
      resume: async () => {
        const session = get().session;
        if (!session || session.status !== 'PAUSED' || !session.pausedAt) return;
        const pausedMs = Date.now() - session.pausedAt;
        const resumed: FocusSession = {
          ...session,
          status: 'ACTIVE',
          pausedAt: undefined,
          totalPausedMs: session.totalPausedMs + pausedMs,
          endsAt: session.endsAt + pausedMs,
        };
        set({ session: resumed });
        await NotificationService.scheduleForActiveSession(resumed);
      },
      complete: async () => {
        const session = get().session;
        if (!session) return;
        const completed = { ...session, status: 'COMPLETED' as const, completedAt: Date.now() };
        set({ session: null, lastCompleted: completed });
        await NotificationService.cancelSession(session.id);
        await enqueueMutation({
          method: 'patch',
          path: `/focus/sessions/${session.id}`,
          body: completed,
        });
      },
      cancel: async () => {
        const session = get().session;
        if (!session) return;
        set({ session: null });
        await NotificationService.cancelSession(session.id);
        await enqueueMutation({
          method: 'patch',
          path: `/focus/sessions/${session.id}`,
          body: { status: 'CANCELLED', completedAt: Date.now() },
        });
      },
      reconcile: async () => {
        const session = get().session;
        if (session?.status === 'ACTIVE' && getRemainingMs(session) === 0) {
          await get().complete();
          return;
        }
        await NotificationService.reconcile(session);
      },
      clearSummary: () => set({ lastCompleted: null }),
    }),
    {
      name: '@study-focus/focus-store/v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ session, lastCompleted }) => ({ session, lastCompleted }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);

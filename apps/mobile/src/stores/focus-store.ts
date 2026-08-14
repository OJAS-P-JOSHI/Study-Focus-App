import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAxiosError } from 'axios';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { enqueueMutation } from '@/services/offline-queue';
import { NotificationService } from '@/services/notification-service';
import { focusApi, type ApiFocusSession } from '@/services/resources';
import type { FocusSession } from '@/types';

type StartInput = Pick<
  FocusSession,
  | 'subjectId'
  | 'subjectName'
  | 'taskId'
  | 'task'
  | 'durationMinutes'
  | 'reminderMinutes'
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
  expire: () => Promise<void>;
  logDistraction: () => Promise<void>;
  reconcile: () => Promise<void>;
  clearSummary: () => void;
};

const id = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const isOfflineError = (error: unknown) => isAxiosError(error) && !error.response;

function fromApi(
  remote: ApiFocusSession,
  labels: { subjectName: string; task?: string; devReminderOptIn?: boolean },
): FocusSession {
  const startedAt = new Date(remote.startedAt).getTime();
  const pausedAt = remote.pausedAt ? new Date(remote.pausedAt).getTime() : undefined;
  const totalPausedMs = remote.totalPausedSeconds * 1000;
  return {
    id: remote.id,
    subjectId:
      typeof remote.subjectId === 'object' ? remote.subjectId.id : remote.subjectId,
    subjectName:
      typeof remote.subjectId === 'object' ? remote.subjectId.name : labels.subjectName,
    taskId: typeof remote.taskId === 'object' ? remote.taskId.id : remote.taskId,
    task: typeof remote.taskId === 'object' ? remote.taskId.title : labels.task,
    durationMinutes: remote.plannedMinutes,
    reminderMinutes: remote.reminderIntervalMinutes,
    devReminderOptIn: labels.devReminderOptIn,
    status: remote.status,
    startedAt,
    endsAt: startedAt + remote.plannedMinutes * 60_000 + totalPausedMs,
    pausedAt,
    totalPausedMs,
    completedAt: remote.endedAt ? new Date(remote.endedAt).getTime() : undefined,
    actualMinutes: remote.actualMinutes,
    completionPercentage: remote.completionPercentage,
    distractionCount: remote.distractionCount,
    synced: true,
  };
}

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
        let session: FocusSession;
        try {
          const remote = await focusApi.start({
            subjectId: input.subjectId,
            taskId: input.taskId,
            plannedMinutes: input.durationMinutes,
            reminderIntervalMinutes: input.reminderMinutes,
          });
          session = fromApi(remote, {
            subjectName: input.subjectName,
            task: input.task,
            devReminderOptIn: __DEV__ && input.allowDevMinute === true,
          });
        } catch (error) {
          if (!isOfflineError(error)) throw error;
          const now = Date.now();
          session = {
            id: id(),
            subjectId: input.subjectId,
            subjectName: input.subjectName,
            taskId: input.taskId,
            task: input.task,
            durationMinutes: input.durationMinutes,
            reminderMinutes: input.reminderMinutes,
            devReminderOptIn: __DEV__ && input.allowDevMinute === true,
            status: 'ACTIVE',
            startedAt: now,
            endsAt: now + input.durationMinutes * 60_000,
            totalPausedMs: 0,
            distractionCount: 0,
            synced: false,
          };
          await enqueueMutation({
            method: 'post',
            path: '/focus-sessions',
            body: {
              subjectId: input.subjectId,
              taskId: input.taskId,
              plannedMinutes: input.durationMinutes,
              reminderIntervalMinutes: input.reminderMinutes,
            },
          });
        }
        set({ session, lastCompleted: null });
        await NotificationService.scheduleForActiveSession(session, input.allowDevMinute);
        return session;
      },
      pause: async () => {
        const session = get().session;
        if (!session || session.status !== 'ACTIVE') return;
        let paused: FocusSession = {
          ...session,
          status: 'PAUSED',
          pausedAt: Date.now(),
        };
        if (session.synced) {
          try {
            paused = fromApi(await focusApi.pause(session.id), session);
          } catch (error) {
            if (!isOfflineError(error)) throw error;
            await enqueueMutation({
              method: 'post',
              path: `/focus-sessions/${session.id}/pause`,
            });
          }
        }
        set({ session: paused });
        await NotificationService.cancelSession(session.id);
      },
      resume: async () => {
        const session = get().session;
        if (!session || session.status !== 'PAUSED' || !session.pausedAt) return;
        const pausedMs = Date.now() - session.pausedAt;
        let resumed: FocusSession = {
          ...session,
          status: 'ACTIVE',
          pausedAt: undefined,
          totalPausedMs: session.totalPausedMs + pausedMs,
          endsAt: session.endsAt + pausedMs,
        };
        if (session.synced) {
          try {
            resumed = fromApi(await focusApi.resume(session.id), session);
          } catch (error) {
            if (!isOfflineError(error)) throw error;
            await enqueueMutation({
              method: 'post',
              path: `/focus-sessions/${session.id}/resume`,
            });
          }
        }
        set({ session: resumed });
        await NotificationService.scheduleForActiveSession(resumed);
      },
      complete: async () => {
        const session = get().session;
        if (!session) return;
        let completed: FocusSession = {
          ...session,
          status: 'COMPLETED',
          completedAt: Date.now(),
          actualMinutes: Math.max(
            0,
            Math.floor((Date.now() - session.startedAt - session.totalPausedMs) / 60_000),
          ),
        };
        if (session.synced) {
          try {
            completed = fromApi(await focusApi.complete(session.id), session);
          } catch (error) {
            if (!isOfflineError(error)) throw error;
            await enqueueMutation({
              method: 'post',
              path: `/focus-sessions/${session.id}/complete`,
            });
          }
        }
        set({ session: null, lastCompleted: completed });
        await NotificationService.cancelSession(session.id);
      },
      cancel: async () => {
        const session = get().session;
        if (!session) return;
        if (session.synced) {
          try {
            await focusApi.cancel(session.id);
          } catch (error) {
            if (!isOfflineError(error)) throw error;
            await enqueueMutation({
              method: 'post',
              path: `/focus-sessions/${session.id}/cancel`,
            });
          }
        }
        set({ session: null });
        await NotificationService.cancelSession(session.id);
      },
      expire: async () => {
        const session = get().session;
        if (!session || session.status !== 'ACTIVE') return;
        if (session.synced) {
          try {
            await focusApi.expire(session.id);
          } catch (error) {
            if (!isOfflineError(error)) throw error;
            await enqueueMutation({
              method: 'post',
              path: `/focus-sessions/${session.id}/expire`,
            });
          }
        }
        set({ session: null });
        await NotificationService.cancelSession(session.id);
      },
      logDistraction: async () => {
        const session = get().session;
        if (!session || !['ACTIVE', 'PAUSED'].includes(session.status)) return;
        if (session.synced) {
          try {
            await focusApi.addDistraction(session.id, { type: 'OTHER' });
          } catch (error) {
            if (!isOfflineError(error)) throw error;
            await enqueueMutation({
              method: 'post',
              path: `/focus-sessions/${session.id}/distractions`,
              body: { type: 'OTHER' },
            });
          }
        }
        set({
          session: {
            ...session,
            distractionCount: session.distractionCount + 1,
          },
        });
      },
      reconcile: async () => {
        const session = get().session;
        if (session?.status === 'ACTIVE' && getRemainingMs(session) === 0) {
          await get().expire();
          return;
        }
        if (session?.synced) {
          try {
            const remote = await focusApi.get(session.id);
            if (remote.status === 'COMPLETED') {
              const completed = fromApi(remote, session);
              set({ session: null, lastCompleted: completed });
              await NotificationService.cancelSession(session.id);
              return;
            }
            if (['CANCELLED', 'EXPIRED'].includes(remote.status)) {
              set({ session: null });
              await NotificationService.cancelSession(session.id);
              return;
            }
            set({ session: fromApi(remote, session) });
          } catch (error) {
            if (!isOfflineError(error)) throw error;
          }
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

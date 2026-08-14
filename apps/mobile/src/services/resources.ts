import { api } from '@/services/api';

type ApiEnvelope<T> = { success: true; data: T };

export type ApiSubject = {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  weeklyTargetMinutes: number;
  isActive: boolean;
};

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED';

export type ApiTask = {
  id: string;
  title: string;
  description?: string;
  subjectId?: ApiSubject | string;
  priority: TaskPriority;
  estimatedMinutes?: number;
  dueAt?: string;
  completedAt?: string;
  status: TaskStatus;
};

export type SubjectInput = {
  name: string;
  description?: string;
  color?: string;
  weeklyTargetMinutes?: number;
  isActive?: boolean;
};

export type TaskInput = {
  title: string;
  description?: string;
  subjectId?: string;
  priority?: TaskPriority;
  estimatedMinutes?: number;
  dueAt?: string;
  status?: TaskStatus;
};

export type ApiFocusStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export type ApiFocusSession = {
  id: string;
  subjectId?: ApiSubject | string;
  taskId?: ApiTask | string;
  startedAt: string;
  endedAt?: string;
  pausedAt?: string;
  totalPausedSeconds: number;
  plannedMinutes: number;
  actualMinutes: number;
  reminderIntervalMinutes: number;
  status: ApiFocusStatus;
  completionPercentage: number;
  distractionCount: number;
};

async function data<T>(request: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  return (await request).data.data;
}

export const subjectsApi = {
  list: () => data(api.get<ApiEnvelope<ApiSubject[]>>('/subjects')),
  create: (input: SubjectInput) =>
    data(api.post<ApiEnvelope<ApiSubject>>('/subjects', input)),
  update: (id: string, input: Partial<SubjectInput>) =>
    data(api.patch<ApiEnvelope<ApiSubject>>(`/subjects/${id}`, input)),
  remove: (id: string) =>
    data(api.delete<ApiEnvelope<{ deleted: true }>>(`/subjects/${id}`)),
};

export const tasksApi = {
  list: (filters?: { subjectId?: string; status?: TaskStatus }) =>
    data(
      api.get<ApiEnvelope<ApiTask[]>>('/tasks', {
        params: filters,
      }),
    ),
  create: (input: TaskInput) => data(api.post<ApiEnvelope<ApiTask>>('/tasks', input)),
  update: (id: string, input: Partial<TaskInput>) =>
    data(api.patch<ApiEnvelope<ApiTask>>(`/tasks/${id}`, input)),
  complete: (id: string) =>
    data(api.post<ApiEnvelope<ApiTask>>(`/tasks/${id}/complete`)),
  remove: (id: string) =>
    data(api.delete<ApiEnvelope<{ deleted: true }>>(`/tasks/${id}`)),
};

export const focusApi = {
  start: (input: {
    subjectId?: string;
    taskId?: string;
    plannedMinutes: number;
    reminderIntervalMinutes: number;
  }) =>
    data(api.post<ApiEnvelope<ApiFocusSession>>('/focus-sessions', input)),
  get: (id: string) =>
    data(api.get<ApiEnvelope<ApiFocusSession>>(`/focus-sessions/${id}`)),
  list: (status?: ApiFocusStatus) =>
    data(
      api.get<ApiEnvelope<ApiFocusSession[]>>('/focus-sessions', {
        params: status ? { status } : undefined,
      }),
    ),
  pause: (id: string) =>
    data(api.post<ApiEnvelope<ApiFocusSession>>(`/focus-sessions/${id}/pause`)),
  resume: (id: string) =>
    data(api.post<ApiEnvelope<ApiFocusSession>>(`/focus-sessions/${id}/resume`)),
  complete: (id: string) =>
    data(api.post<ApiEnvelope<ApiFocusSession>>(`/focus-sessions/${id}/complete`)),
  cancel: (id: string) =>
    data(api.post<ApiEnvelope<ApiFocusSession>>(`/focus-sessions/${id}/cancel`)),
  expire: (id: string) =>
    data(api.post<ApiEnvelope<ApiFocusSession>>(`/focus-sessions/${id}/expire`)),
  addDistraction: (
    id: string,
    input: {
      type: 'PHONE' | 'SOCIAL_MEDIA' | 'MESSAGING' | 'FATIGUE' | 'OTHER';
      note?: string;
    },
  ) =>
    data(
      api.post<ApiEnvelope<{ type: string; note?: string; occurredAt: string }>>(
        `/focus-sessions/${id}/distractions`,
        input,
      ),
    ),
};

export function taskSubject(task: ApiTask): ApiSubject | undefined {
  return typeof task.subjectId === 'object' ? task.subjectId : undefined;
}

import * as SecureStore from 'expo-secure-store';
import axios, { create, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { getQueuedMutations, replaceQueue } from '@/services/offline-queue';
import type { OfflineMutation } from '@/types';

const ACCESS_KEY = 'study-focus.access-token';
const REFRESH_KEY = 'study-focus.refresh-token';
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

export const api = create({ baseURL: API_URL, timeout: 10_000 });
let refreshPromise: Promise<string | null> | null = null;
let authFailureHandler: (() => void) | null = null;
let offlineSyncHandler:
  | ((localEntityId: string, remoteId: string) => void)
  | null = null;

type ApiEnvelope<T> = { success: true; data: T };

export function setAuthFailureHandler(handler: () => void) {
  authFailureHandler = handler;
}

export function setOfflineSyncHandler(
  handler: (localEntityId: string, remoteId: string) => void,
) {
  offlineSyncHandler = handler;
}

export const tokenStorage = {
  async save(accessToken: string, refreshToken: string) {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
    ]);
  },
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
    ]);
  },
  getAccess: () => SecureStore.getItemAsync(ACCESS_KEY),
  getRefresh: () => SecureStore.getItemAsync(REFRESH_KEY),
};

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

async function refreshAccessToken() {
  const refreshToken = await tokenStorage.getRefresh();
  if (!refreshToken) return null;
  try {
    const response = await axios.post<ApiEnvelope<{ accessToken: string; refreshToken?: string }>>(
      `${API_URL}/auth/refresh`,
      { refreshToken },
      { timeout: 10_000 },
    );
    const tokens = response.data.data;
    await tokenStorage.save(tokens.accessToken, tokens.refreshToken ?? refreshToken);
    return tokens.accessToken;
  } catch {
    await tokenStorage.clear();
    authFailureHandler?.();
    return null;
  }
}

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  if (error.response?.status !== 401 || !original || original._retried) throw error;
  original._retried = true;
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  const token = await refreshPromise;
  if (!token) throw error;
  original.headers.Authorization = `Bearer ${token}`;
  return api(original);
});

export async function flushOfflineQueue() {
  const queue = await getQueuedMutations();
  let failedAt = queue.length;
  let failedItem: OfflineMutation | null = null;
  for (let index = 0; index < queue.length; index += 1) {
    const item = queue[index];
    try {
      const response = await api.request<ApiEnvelope<{ id?: string }>>({
        method: item.method,
        url: item.path,
        data: item.body,
      });
      const remoteId = response.data.data?.id;
      if (item.localEntityId && remoteId) {
        offlineSyncHandler?.(item.localEntityId, remoteId);
      }
    } catch {
      failedAt = index;
      failedItem = { ...item, attempts: item.attempts + 1 };
      break;
    }
  }
  const remaining = failedItem ? [failedItem, ...queue.slice(failedAt + 1)] : [];
  await replaceQueue(remaining);
  return failedAt;
}

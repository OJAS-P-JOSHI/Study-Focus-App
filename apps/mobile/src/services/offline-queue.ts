import AsyncStorage from '@react-native-async-storage/async-storage';

import type { OfflineMutation } from '@/types';

const KEY = '@study-focus/offline-queue/v1';

export async function getQueuedMutations(): Promise<OfflineMutation[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OfflineMutation[]) : [];
  } catch {
    return [];
  }
}

export async function enqueueMutation(
  mutation: Omit<OfflineMutation, 'id' | 'createdAt' | 'attempts'>,
) {
  const queue = await getQueuedMutations();
  const item: OfflineMutation = {
    ...mutation,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    attempts: 0,
  };
  await AsyncStorage.setItem(KEY, JSON.stringify([...queue, item]));
  return item;
}

export async function replaceQueue(queue: OfflineMutation[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(queue));
}

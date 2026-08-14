import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { api, tokenStorage } from '@/services/api';

const LOCAL_MODE_KEY = 'study-focus.local-mode';
type User = { id: string; name: string; email: string };
type AuthState = {
  user: User | null;
  ready: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  continueOffline: () => Promise<void>;
  logout: () => Promise<void>;
};

type AuthResponse = { user: User; accessToken: string; refreshToken: string };

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  initialize: async () => {
    const token = await tokenStorage.getAccess();
    if (!token) {
      const localMode = await SecureStore.getItemAsync(LOCAL_MODE_KEY);
      return set({
        user: localMode ? { id: 'local', name: 'Focused learner', email: 'offline@local' } : null,
        ready: true,
      });
    }
    try {
      const { data } = await api.get<User>('/auth/me');
      set({ user: data, ready: true });
    } catch {
      set({ ready: true });
    }
  },
  login: async (email, password) => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    await tokenStorage.save(data.accessToken, data.refreshToken);
    await SecureStore.deleteItemAsync(LOCAL_MODE_KEY);
    set({ user: data.user });
  },
  register: async (name, email, password) => {
    const { data } = await api.post<AuthResponse>('/auth/register', { name, email, password });
    await tokenStorage.save(data.accessToken, data.refreshToken);
    await SecureStore.deleteItemAsync(LOCAL_MODE_KEY);
    set({ user: data.user });
  },
  continueOffline: async () => {
    await SecureStore.setItemAsync(LOCAL_MODE_KEY, '1');
    set({ user: { id: 'local', name: 'Focused learner', email: 'offline@local' } });
  },
  logout: async () => {
    await tokenStorage.clear();
    await SecureStore.deleteItemAsync(LOCAL_MODE_KEY);
    set({ user: null });
  },
}));

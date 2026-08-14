import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { api, setAuthFailureHandler, tokenStorage } from '@/services/api';

const LOCAL_MODE_KEY = 'study-focus.local-mode';
type User = { id: string; name: string; email: string };
type ApiEnvelope<T> = { success: true; data: T };
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
      const response = await api.get<ApiEnvelope<User>>('/auth/me');
      set({ user: response.data.data, ready: true });
    } catch {
      await tokenStorage.clear();
      set({ user: null, ready: true });
    }
  },
  login: async (email, password) => {
    const response = await api.post<ApiEnvelope<AuthResponse>>('/auth/login', { email, password });
    const data = response.data.data;
    await tokenStorage.save(data.accessToken, data.refreshToken);
    await SecureStore.deleteItemAsync(LOCAL_MODE_KEY);
    set({ user: data.user });
  },
  register: async (name, email, password) => {
    const response = await api.post<ApiEnvelope<AuthResponse>>('/auth/register', {
      name,
      email,
      password,
    });
    const data = response.data.data;
    await tokenStorage.save(data.accessToken, data.refreshToken);
    await SecureStore.deleteItemAsync(LOCAL_MODE_KEY);
    set({ user: data.user });
  },
  continueOffline: async () => {
    await SecureStore.setItemAsync(LOCAL_MODE_KEY, '1');
    set({ user: { id: 'local', name: 'Focused learner', email: 'offline@local' } });
  },
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Local sign-out must still complete if the API is unavailable.
    }
    await tokenStorage.clear();
    await SecureStore.deleteItemAsync(LOCAL_MODE_KEY);
    set({ user: null });
  },
}));

setAuthFailureHandler(() => {
  useAuthStore.setState({ user: null, ready: true });
});

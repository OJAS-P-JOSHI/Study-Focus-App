import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { palette } from '@/constants/design';
import { flushOfflineQueue } from '@/services/api';
import { NotificationService } from '@/services/notification-service';
import { useAuthStore } from '@/stores/auth-store';
import { useFocusStore } from '@/stores/focus-store';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

export default function RootLayout() {
  const initializeAuth = useAuthStore((state) => state.initialize);
  const hydrated = useFocusStore((state) => state.hydrated);
  const reconcile = useFocusStore((state) => state.reconcile);

  useEffect(() => {
    void initializeAuth();
    void NotificationService.initialize();
    void flushOfflineQueue();
  }, [initializeAuth]);

  useEffect(() => {
    if (!hydrated) return;
    void reconcile();
    const subscription = NotificationService.listenForForegroundReconciliation(
      () => useFocusStore.getState().session,
    );
    return () => subscription.remove();
  }, [hydrated, reconcile]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: palette.bg },
          headerTintColor: palette.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: palette.bg },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="focus/start" options={{ title: 'Start focus', presentation: 'modal' }} />
        <Stack.Screen name="focus/active" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="focus/summary" options={{ headerShown: false }} />
        <Stack.Screen name="tasks" options={{ title: 'Tasks' }} />
      </Stack>
    </QueryClientProvider>
  );
}

import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '@/stores/auth-store';

export default function AuthLayout() {
  const { ready, user } = useAuthStore();

  if (ready && user) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

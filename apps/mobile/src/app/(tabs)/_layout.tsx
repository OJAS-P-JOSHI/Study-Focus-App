import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';

import { palette } from '@/constants/design';
import { useAuthStore } from '@/stores/auth-store';

const icons: Record<string, string> = {
  index: '◉',
  timetable: '▦',
  subjects: '◇',
  stats: '↗',
  settings: '⌁',
};

export default function TabsLayout() {
  const { ready, user } = useAuthStore();

  if (ready && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          height: 68,
          paddingTop: 7,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{icons[route.name]}</Text>,
      })}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="timetable" options={{ title: 'Plan' }} />
      <Tabs.Screen name="subjects" options={{ title: 'Subjects' }} />
      <Tabs.Screen name="stats" options={{ title: 'Progress' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}

import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { palette } from '@/constants/design';
import { useAuthStore } from '@/stores/auth-store';
import { useFocusStore } from '@/stores/focus-store';

export default function Index() {
  const { ready, user } = useAuthStore();
  const { hydrated, session } = useFocusStore();
  if (!ready || !hydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/(auth)/login" />;
  if (session?.status === 'ACTIVE' || session?.status === 'PAUSED') {
    return <Redirect href="/focus/active" />;
  }
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg },
});

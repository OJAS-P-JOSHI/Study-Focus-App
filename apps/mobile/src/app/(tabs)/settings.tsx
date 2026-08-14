import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Heading, Screen, typography } from '@/components/ui';
import { palette, space } from '@/constants/design';
import { NotificationService } from '@/services/notification-service';
import { useAuthStore } from '@/stores/auth-store';

function SettingRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={typography.body}>{title}</Text>
        <Text style={typography.muted}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: palette.primaryDark }} thumbColor={value ? palette.primary : palette.muted} />
    </View>
  );
}

export default function SettingsScreen() {
  const [reminders, setReminders] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const logout = useAuthStore((state) => state.logout);
  return (
    <Screen>
      <Heading eyebrow="Make it yours" title="Settings" subtitle="Quiet defaults for focused work." />
      <Card>
        <Text style={typography.sectionTitle}>Focus</Text>
        <SettingRow
          title="Gentle reminders"
          description="Notify only during an active session"
          value={reminders}
          onChange={async (value) => {
            setReminders(value);
            if (value) await NotificationService.requestPermission();
            else await NotificationService.cancelSession();
          }}
        />
        <View style={styles.divider} />
        <SettingRow
          title="Haptic cues"
          description="Subtle feedback for timer controls"
          value={haptics}
          onChange={setHaptics}
        />
      </Card>
      <Card>
        <Text style={typography.sectionTitle}>About your data</Text>
        <Text style={typography.muted}>
          Sessions are saved on this device first and synced securely when a connection is available.
        </Text>
      </Card>
      <Button
        label="Sign out"
        variant="secondary"
        onPress={async () => {
          await logout();
          router.replace('/(auth)/login');
        }}
      />
      <Text style={styles.version}>Stillpoint 1.0.0</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  copy: { flex: 1, gap: 3 },
  divider: { height: 1, backgroundColor: palette.border },
  version: { color: palette.muted, fontSize: 12, textAlign: 'center' },
});

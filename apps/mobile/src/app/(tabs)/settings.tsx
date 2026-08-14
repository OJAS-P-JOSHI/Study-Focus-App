import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Chip, Field, Heading, Screen, typography } from '@/components/ui';
import { palette, space } from '@/constants/design';
import { NotificationService } from '@/services/notification-service';
import { settingsApi, type ApiSettings } from '@/services/resources';
import { useAuthStore } from '@/stores/auth-store';
import { useFocusStore } from '@/stores/focus-store';

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
  const settings = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });

  return (
    <Screen>
      <Heading eyebrow="Make it yours" title="Settings" subtitle="Quiet defaults for focused work." />
      {settings.data ? <SettingsForm initial={settings.data} /> : null}
      {settings.isLoading ? <Text style={typography.muted}>Loading settings…</Text> : null}
      {settings.error ? <Text style={styles.error}>Settings could not be loaded.</Text> : null}
      <Text style={styles.version}>Stillpoint 1.0.0</Text>
    </Screen>
  );
}

function SettingsForm({ initial }: { initial: ApiSettings }) {
  const queryClient = useQueryClient();
  const logout = useAuthStore((state) => state.logout);
  const resetLocal = useFocusStore((state) => state.resetLocal);
  const [form, setForm] = useState({
    name: initial.name,
    timezone: initial.timezone,
    dailyStudyTargetMinutes: String(initial.dailyStudyTargetMinutes),
    weeklyStudyTargetMinutes: String(initial.weeklyStudyTargetMinutes),
    minimumStreakMinutes: String(initial.minimumStreakMinutes),
    defaultFocusMinutes: String(initial.defaultFocusMinutes),
    defaultReminderIntervalMinutes: String(initial.defaultReminderIntervalMinutes),
    notificationsEnabled: initial.notificationsEnabled,
    soundEnabled: initial.soundEnabled,
    vibrationEnabled: initial.vibrationEnabled,
    theme: initial.theme,
  });
  const save = useMutation({
    mutationFn: () =>
      settingsApi.update({
        name: form.name.trim(),
        timezone: form.timezone.trim(),
        dailyStudyTargetMinutes: Number(form.dailyStudyTargetMinutes),
        weeklyStudyTargetMinutes: Number(form.weeklyStudyTargetMinutes),
        minimumStreakMinutes: Number(form.minimumStreakMinutes),
        defaultFocusMinutes: Number(form.defaultFocusMinutes),
        defaultReminderIntervalMinutes: Number(form.defaultReminderIntervalMinutes),
        notificationsEnabled: form.notificationsEnabled,
        soundEnabled: form.soundEnabled,
        vibrationEnabled: form.vibrationEnabled,
        theme: form.theme,
      }),
    onSuccess: async (updated) => {
      useAuthStore.setState((state) => ({
        user: state.user ? { ...state.user, name: updated.name } : null,
      }));
      if (!updated.notificationsEnabled) await NotificationService.cancelSession();
      await queryClient.invalidateQueries();
    },
  });
  const reset = useMutation({
    mutationFn: settingsApi.resetData,
    onSuccess: async () => {
      await resetLocal();
      await queryClient.invalidateQueries();
      router.replace('/(tabs)');
    },
  });

  return (
    <>
      <Card>
        <Text style={typography.sectionTitle}>Profile</Text>
        <Field
          label="Name"
          value={form.name}
          onChangeText={(name) => setForm((value) => ({ ...value, name }))}
        />
        <Field label="Email" value={initial.email} editable={false} />
        <Field
          label="Timezone"
          value={form.timezone}
          placeholder="Asia/Kolkata"
          autoCapitalize="none"
          onChangeText={(timezone) => setForm((value) => ({ ...value, timezone }))}
        />
      </Card>
      <Card>
        <Text style={typography.sectionTitle}>Goals</Text>
        <View style={styles.numberRow}>
          <View style={styles.flex}>
            <Field
              label="Daily target"
              keyboardType="number-pad"
              value={form.dailyStudyTargetMinutes}
              onChangeText={(dailyStudyTargetMinutes) =>
                setForm((value) => ({ ...value, dailyStudyTargetMinutes }))
              }
            />
          </View>
          <View style={styles.flex}>
            <Field
              label="Weekly target"
              keyboardType="number-pad"
              value={form.weeklyStudyTargetMinutes}
              onChangeText={(weeklyStudyTargetMinutes) =>
                setForm((value) => ({ ...value, weeklyStudyTargetMinutes }))
              }
            />
          </View>
          <View style={styles.flex}>
            <Field
              label="Streak minimum"
              keyboardType="number-pad"
              value={form.minimumStreakMinutes}
              onChangeText={(minimumStreakMinutes) =>
                setForm((value) => ({ ...value, minimumStreakMinutes }))
              }
            />
          </View>
        </View>
      </Card>
      <Card>
        <Text style={typography.sectionTitle}>Focus defaults</Text>
        <View style={styles.numberRow}>
          <View style={styles.flex}>
            <Field
              label="Focus minutes"
              keyboardType="number-pad"
              value={form.defaultFocusMinutes}
              onChangeText={(defaultFocusMinutes) =>
                setForm((value) => ({ ...value, defaultFocusMinutes }))
              }
            />
          </View>
        </View>
        <Text style={styles.label}>Reminder interval</Text>
        <View style={styles.numberRow}>
          {[5, 10, 15, 20, 25, 30].map((minutes) => (
            <Chip
              key={minutes}
              label={`${minutes}m`}
              selected={form.defaultReminderIntervalMinutes === String(minutes)}
              onPress={() =>
                setForm((value) => ({
                  ...value,
                  defaultReminderIntervalMinutes: String(minutes),
                }))
              }
            />
          ))}
        </View>
      </Card>
      <Card>
        <Text style={typography.sectionTitle}>Notifications</Text>
        <SettingRow
          title="Gentle reminders"
          description="Notify only during an active session"
          value={form.notificationsEnabled}
          onChange={async (value) => {
            const granted = value ? await NotificationService.requestPermission() : false;
            setForm((current) => ({
              ...current,
              notificationsEnabled: value && granted,
            }));
            if (!value) await NotificationService.cancelSession();
          }}
        />
        <View style={styles.divider} />
        <SettingRow
          title="Sound"
          description="Allow sound on focus reminders"
          value={form.soundEnabled}
          onChange={(soundEnabled) => setForm((value) => ({ ...value, soundEnabled }))}
        />
        <View style={styles.divider} />
        <SettingRow
          title="Vibration"
          description="Allow vibration on focus reminders"
          value={form.vibrationEnabled}
          onChange={(vibrationEnabled) =>
            setForm((value) => ({ ...value, vibrationEnabled }))
          }
        />
      </Card>
      <Card>
        <Text style={typography.sectionTitle}>Theme</Text>
        <View style={styles.numberRow}>
          {(['DARK', 'LIGHT', 'SYSTEM'] as const).map((theme) => (
            <Chip
              key={theme}
              label={theme}
              selected={form.theme === theme}
              onPress={() => setForm((value) => ({ ...value, theme }))}
            />
          ))}
        </View>
      </Card>
      {save.error ? <Text style={styles.error}>Check the values and timezone.</Text> : null}
      <Button label="Save settings" loading={save.isPending} onPress={() => save.mutate()} />
      <Button
        label="Sign out"
        variant="secondary"
        onPress={async () => {
          await logout();
          router.replace('/(auth)/login');
        }}
      />
      <Button
        label="Reset application data"
        variant="danger"
        loading={reset.isPending}
        onPress={() =>
          Alert.alert(
            'Reset all study data?',
            'This permanently deletes subjects, tasks, timetable plans, focus sessions, analytics, and goals. Your account remains.',
            [
              { text: 'Keep data', style: 'cancel' },
              {
                text: 'Reset',
                style: 'destructive',
                onPress: () => reset.mutate(),
              },
            ],
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  copy: { flex: 1, gap: 3 },
  divider: { height: 1, backgroundColor: palette.border },
  numberRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 90 },
  label: { color: palette.text, fontSize: 13, fontWeight: '700' },
  error: { color: palette.danger },
  version: { color: palette.muted, fontSize: 12, textAlign: 'center' },
});

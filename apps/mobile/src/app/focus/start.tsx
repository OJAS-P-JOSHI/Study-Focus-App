import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, Field, Heading, Screen, typography } from '@/components/ui';
import { palette, space } from '@/constants/design';
import { PRODUCTION_INTERVALS } from '@/services/notification-service';
import { settingsApi, subjectsApi, tasksApi } from '@/services/resources';
import { useFocusStore } from '@/stores/focus-store';

const durations = [15, 25, 40, 50];

export default function StartFocusScreen() {
  const start = useFocusStore((state) => state.start);
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: subjectsApi.list });
  const [subjectId, setSubjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const tasks = useQuery({
    queryKey: ['tasks', subjectId, 'TODO'],
    queryFn: () => tasksApi.list({ subjectId: subjectId || undefined, status: 'TODO' }),
  });
  const settings = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const [durationOverride, setDuration] = useState<number | null>(null);
  const [reminderOverride, setReminder] = useState<number | null>(null);
  const [intention, setIntention] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const subject = subjects.data?.find((item) => item.id === subjectId);
  const task = tasks.data?.find((item) => item.id === taskId);
  const duration = durationOverride ?? settings.data?.defaultFocusMinutes ?? 50;
  const reminder =
    reminderOverride ?? settings.data?.defaultReminderIntervalMinutes ?? 10;

  return (
    <Screen>
      <Heading title="Set your intention" subtitle="Decide what matters before the timer begins." />
      <Text style={typography.sectionTitle}>Subject</Text>
      <View style={styles.wrap}>
        {subjects.data?.filter((item) => item.isActive).map((item) => (
          <Chip
            key={item.id}
            label={item.name}
            selected={item.id === subjectId}
            onPress={() => {
              setSubjectId(item.id);
              setTaskId('');
            }}
          />
        ))}
      </View>
      {subjects.isLoading ? <Text style={typography.muted}>Loading subjects…</Text> : null}
      {!subjects.isLoading && !subjects.data?.some((item) => item.isActive) ? (
        <Text style={styles.error}>Create an active subject before starting focus.</Text>
      ) : null}
      <Text style={typography.sectionTitle}>Task (optional)</Text>
      <View style={styles.wrap}>
        <Chip label="No task" selected={!taskId} onPress={() => setTaskId('')} />
        {tasks.data?.map((item) => (
          <Chip
            key={item.id}
            label={item.title}
            selected={taskId === item.id}
            onPress={() => setTaskId(item.id)}
          />
        ))}
      </View>
      <Field
        label="Intention (optional)"
        placeholder="e.g. Complete exercises 1–10"
        value={intention}
        onChangeText={setIntention}
      />
      <Card>
        <Text style={typography.sectionTitle}>Focus duration</Text>
        <View style={styles.wrap}>
          {durations.map((value) => (
            <Chip key={value} label={`${value} min`} selected={duration === value} onPress={() => setDuration(value)} />
          ))}
        </View>
      </Card>
      <Card>
        <Text style={typography.sectionTitle}>Return reminder</Text>
        <Text style={typography.muted}>A quiet notification if you leave the app during focus.</Text>
        <View style={styles.wrap}>
          {PRODUCTION_INTERVALS.map((value) => (
            <Chip key={value} label={`${value}m`} selected={reminder === value} onPress={() => setReminder(value)} />
          ))}
          {__DEV__ ? <Chip label="1m test" selected={reminder === 1} onPress={() => setReminder(1)} /> : null}
        </View>
      </Card>
      <View style={styles.note}>
        <Text style={styles.noteIcon}>◌</Text>
        <Text style={typography.muted}>The timer uses elapsed timestamps, so it remains accurate if the app sleeps or restarts.</Text>
      </View>
      <Button
        label="Begin focus"
        loading={starting}
        disabled={!subject}
        onPress={async () => {
          setStarting(true);
          setError('');
          try {
            await start({
              subjectId: subject?.id,
              subjectName: subject?.name ?? 'Focus',
              taskId: task?.id,
              task: (task?.title ?? intention.trim()) || undefined,
              durationMinutes: duration,
              reminderMinutes: reminder,
              allowDevMinute: __DEV__ && reminder === 1,
            });
            router.replace('/focus/active');
          } catch {
            setError('Could not start this session. Check for another open session and try again.');
          } finally {
            setStarting(false);
          }
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm },
  noteIcon: { color: palette.primary, fontSize: 24 },
  error: { color: palette.danger },
});

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Chip, Field, Heading, Screen, typography } from '@/components/ui';
import { palette, radius, space } from '@/constants/design';
import {
  focusApi,
  subjectsApi,
  tasksApi,
  timetableApi,
  type ApiTimetableEntry,
} from '@/services/resources';
import { timetableStatus } from '@/services/timetable-status';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const emptyForm = {
  subjectId: '',
  taskId: '',
  title: '',
  dayOfWeek: new Date().getDay(),
  startTime: '09:00',
  endTime: '09:50',
  targetMinutes: '50',
  isEnabled: true,
};

export default function TimetableScreen() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ApiTimetableEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const entries = useQuery({ queryKey: ['timetable'], queryFn: timetableApi.list });
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: subjectsApi.list });
  const tasks = useQuery({
    queryKey: ['tasks', form.subjectId],
    queryFn: () => tasksApi.list({ subjectId: form.subjectId || undefined }),
  });
  const sessions = useQuery({ queryKey: ['focus-sessions'], queryFn: () => focusApi.list() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['timetable'] });
  const save = useMutation({
    mutationFn: () => {
      const input = {
        subjectId: form.subjectId,
        taskId: form.taskId || null,
        title: form.title.trim(),
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        targetMinutes: Number(form.targetMinutes),
        isEnabled: form.isEnabled,
      };
      return editing
        ? timetableApi.update(editing.id, input)
        : timetableApi.create({ ...input, taskId: input.taskId ?? undefined });
    },
    onSuccess: async () => {
      setEditing(null);
      setForm(emptyForm);
      await refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: (entry: ApiTimetableEntry) =>
      timetableApi.update(entry.id, { isEnabled: !entry.isEnabled }),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: timetableApi.remove, onSuccess: refresh });
  const now = new Date();
  const todayEntries = entries.data
    ?.filter(
      (entry) =>
        entry.isEnabled &&
        entry.dayOfWeek === now.getDay() &&
        entry.startTime > `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    )
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const nextId = todayEntries?.[0]?.id;

  const edit = (entry: ApiTimetableEntry) => {
    setEditing(entry);
    setForm({
      subjectId:
        typeof entry.subjectId === 'object' ? entry.subjectId.id : entry.subjectId,
      taskId: typeof entry.taskId === 'object' ? entry.taskId.id : (entry.taskId ?? ''),
      title: entry.title,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      targetMinutes: String(entry.targetMinutes),
      isEnabled: entry.isEnabled,
    });
  };

  return (
    <Screen>
      <Heading
        eyebrow="Your rhythm"
        title="Timetable"
        subtitle="Recurring plans only become study time when you start focus."
      />
      <Card>
        <Text style={typography.sectionTitle}>{editing ? 'Edit plan' : 'New weekly plan'}</Text>
        <View style={styles.wrap}>
          {days.map((day, dayOfWeek) => (
            <Chip
              key={day}
              label={day}
              selected={form.dayOfWeek === dayOfWeek}
              onPress={() => setForm((value) => ({ ...value, dayOfWeek }))}
            />
          ))}
        </View>
        <Text style={styles.label}>Subject</Text>
        <View style={styles.wrap}>
          {subjects.data?.filter((subject) => subject.isActive).map((subject) => (
            <Chip
              key={subject.id}
              label={subject.name}
              selected={form.subjectId === subject.id}
              onPress={() =>
                setForm((value) => ({ ...value, subjectId: subject.id, taskId: '' }))
              }
            />
          ))}
        </View>
        <Text style={styles.label}>Task (optional)</Text>
        <View style={styles.wrap}>
          <Chip
            label="No task"
            selected={!form.taskId}
            onPress={() => setForm((value) => ({ ...value, taskId: '' }))}
          />
          {tasks.data?.map((task) => (
            <Chip
              key={task.id}
              label={task.title}
              selected={form.taskId === task.id}
              onPress={() => setForm((value) => ({ ...value, taskId: task.id }))}
            />
          ))}
        </View>
        <Field
          label="Plan title"
          value={form.title}
          onChangeText={(title) => setForm((value) => ({ ...value, title }))}
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field
              label="Start"
              value={form.startTime}
              placeholder="09:00"
              onChangeText={(startTime) => setForm((value) => ({ ...value, startTime }))}
            />
          </View>
          <View style={styles.flex}>
            <Field
              label="End"
              value={form.endTime}
              placeholder="09:50"
              onChangeText={(endTime) => setForm((value) => ({ ...value, endTime }))}
            />
          </View>
          <View style={styles.flex}>
            <Field
              label="Target min"
              value={form.targetMinutes}
              keyboardType="number-pad"
              onChangeText={(targetMinutes) =>
                setForm((value) => ({ ...value, targetMinutes }))
              }
            />
          </View>
        </View>
        <View style={styles.enabledRow}>
          <Text style={typography.body}>Enabled</Text>
          <Switch
            value={form.isEnabled}
            onValueChange={(isEnabled) => setForm((value) => ({ ...value, isEnabled }))}
          />
        </View>
        {save.error ? <Text style={styles.error}>Check the times and selected subject.</Text> : null}
        <Button
          label={editing ? 'Save plan' : 'Create plan'}
          disabled={!form.subjectId || !form.title.trim()}
          loading={save.isPending}
          onPress={() => save.mutate()}
        />
        {editing ? (
          <Button
            label="Cancel edit"
            variant="ghost"
            onPress={() => {
              setEditing(null);
              setForm(emptyForm);
            }}
          />
        ) : null}
      </Card>

      <Text style={typography.sectionTitle}>Weekly plans</Text>
      {entries.isLoading ? <Text style={typography.muted}>Loading timetable…</Text> : null}
      {entries.data?.map((entry) => {
        const subject =
          typeof entry.subjectId === 'object' ? entry.subjectId : undefined;
        const status = timetableStatus(entry, sessions.data ?? [], now, entry.id === nextId);
        return (
          <Pressable key={entry.id} onPress={() => edit(entry)}>
            <Card style={!entry.isEnabled ? styles.inactive : undefined}>
              <View style={styles.block}>
                <View
                  style={[styles.dot, { backgroundColor: subject?.color ?? palette.primary }]}
                />
                <View style={styles.copy}>
                  <View style={styles.titleRow}>
                    <Text style={typography.body}>{entry.title}</Text>
                    <Text style={[styles.status, styles[`status_${status}`]]}>{status}</Text>
                  </View>
                  <Text style={typography.muted}>
                    {days[entry.dayOfWeek]} · {entry.startTime}–{entry.endTime} ·{' '}
                    {subject?.name ?? 'Subject'} · {entry.targetMinutes} min
                  </Text>
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button
                    label={entry.isEnabled ? 'Disable' : 'Enable'}
                    variant="secondary"
                    onPress={() => toggle.mutate(entry)}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    label="Delete"
                    variant="danger"
                    onPress={() =>
                      Alert.alert('Delete this weekly plan?', entry.title, [
                        { text: 'Keep', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => remove.mutate(entry.id),
                        },
                      ])
                    }
                  />
                </View>
              </View>
            </Card>
          </Pressable>
        );
      })}
      {!entries.isLoading && entries.data?.length === 0 ? (
        <Text style={typography.muted}>No recurring plans yet.</Text>
      ) : null}
      {entries.error ? (
        <Card>
          <Text style={styles.error}>Timetable could not be loaded.</Text>
          <Button label="Try again" variant="secondary" onPress={() => entries.refetch()} />
        </Card>
      ) : null}
      <Text style={styles.note}>
        Timetable entries are plans. A FocusSession is created only when you press Start Focus.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  enabledRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flex: { flex: 1 },
  label: { color: palette.text, fontSize: 13, fontWeight: '700' },
  block: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 7, height: 42, borderRadius: 5 },
  copy: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  status: {
    overflow: 'hidden',
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    color: palette.muted,
    backgroundColor: palette.surfaceRaised,
    fontSize: 10,
    fontWeight: '800',
  },
  status_CURRENT: { color: palette.primary },
  status_NEXT: { color: palette.warning },
  status_COMPLETED: { color: palette.primary },
  status_MISSED: { color: palette.danger },
  status_PLANNED: { color: palette.muted },
  status_DISABLED: { color: palette.muted },
  inactive: { opacity: 0.58 },
  error: { color: palette.danger },
  note: { color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: space.md },
});

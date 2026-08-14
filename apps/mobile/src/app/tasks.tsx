import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, Field, Heading, Screen, typography } from '@/components/ui';
import { palette, space } from '@/constants/design';
import {
  subjectsApi,
  taskSubject,
  tasksApi,
  type ApiTask,
  type TaskPriority,
  type TaskStatus,
} from '@/services/resources';

const emptyForm = {
  title: '',
  description: '',
  subjectId: '',
  priority: 'MEDIUM' as TaskPriority,
  estimatedMinutes: '',
  dueAt: '',
};

export default function TasksScreen() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ApiTask | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState<TaskStatus | undefined>();
  const [subjectFilter, setSubjectFilter] = useState<string | undefined>();

  const subjects = useQuery({ queryKey: ['subjects'], queryFn: subjectsApi.list });
  const tasks = useQuery({
    queryKey: ['tasks', subjectFilter, status],
    queryFn: () => tasksApi.list({ subjectId: subjectFilter, status }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['tasks'] });
  const save = useMutation({
    mutationFn: () => {
      const dueAt = form.dueAt.trim()
        ? new Date(`${form.dueAt.trim()}T23:59:59`).toISOString()
        : undefined;
      const input = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        subjectId: form.subjectId || undefined,
        priority: form.priority,
        estimatedMinutes: Number(form.estimatedMinutes) || undefined,
        dueAt,
      };
      return editing ? tasksApi.update(editing.id, input) : tasksApi.create(input);
    },
    onSuccess: async () => {
      setEditing(null);
      setForm(emptyForm);
      await refresh();
    },
  });
  const complete = useMutation({ mutationFn: tasksApi.complete, onSuccess: refresh });
  const remove = useMutation({ mutationFn: tasksApi.remove, onSuccess: refresh });

  const edit = (task: ApiTask) => {
    const subject = taskSubject(task);
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description ?? '',
      subjectId: subject?.id ?? (typeof task.subjectId === 'string' ? task.subjectId : ''),
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes ? String(task.estimatedMinutes) : '',
      dueAt: task.dueAt?.slice(0, 10) ?? '',
    });
  };

  return (
    <Screen>
      <Heading
        eyebrow="Small next steps"
        title="Tasks"
        subtitle="Capture concrete work, then finish it."
      />
      <Card>
        <Text style={typography.sectionTitle}>{editing ? 'Edit task' : 'New task'}</Text>
        <Field
          label="Task"
          placeholder="Quadratic equation practice"
          value={form.title}
          onChangeText={(title) => setForm((value) => ({ ...value, title }))}
        />
        <Field
          label="Notes"
          multiline
          value={form.description}
          onChangeText={(description) => setForm((value) => ({ ...value, description }))}
        />
        <View style={styles.row}>
          {(['LOW', 'MEDIUM', 'HIGH'] as const).map((priority) => (
            <Chip
              key={priority}
              label={priority}
              selected={form.priority === priority}
              onPress={() => setForm((value) => ({ ...value, priority }))}
            />
          ))}
        </View>
        <Text style={styles.label}>Subject</Text>
        <View style={styles.wrap}>
          <Chip
            label="No subject"
            selected={!form.subjectId}
            onPress={() => setForm((value) => ({ ...value, subjectId: '' }))}
          />
          {subjects.data
            ?.filter((subject) => subject.isActive)
            .map((subject) => (
              <Chip
                key={subject.id}
                label={subject.name}
                selected={form.subjectId === subject.id}
                onPress={() => setForm((value) => ({ ...value, subjectId: subject.id }))}
              />
            ))}
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Field
              label="Estimate (min)"
              keyboardType="number-pad"
              value={form.estimatedMinutes}
              onChangeText={(estimatedMinutes) =>
                setForm((value) => ({ ...value, estimatedMinutes }))
              }
            />
          </View>
          <View style={styles.flex}>
            <Field
              label="Due date"
              placeholder="YYYY-MM-DD"
              value={form.dueAt}
              onChangeText={(dueAt) => setForm((value) => ({ ...value, dueAt }))}
            />
          </View>
        </View>
        {save.error ? <Text style={styles.error}>Could not save this task.</Text> : null}
        <Button
          label={editing ? 'Save changes' : 'Add task'}
          disabled={!form.title.trim()}
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

      <Text style={typography.sectionTitle}>Filters</Text>
      <View style={styles.wrap}>
        <Chip label="All" selected={!status} onPress={() => setStatus(undefined)} />
        {(['TODO', 'IN_PROGRESS', 'COMPLETED'] as const).map((value) => (
          <Chip
            key={value}
            label={value.replace('_', ' ')}
            selected={status === value}
            onPress={() => setStatus(value)}
          />
        ))}
      </View>
      <View style={styles.wrap}>
        <Chip
          label="Every subject"
          selected={!subjectFilter}
          onPress={() => setSubjectFilter(undefined)}
        />
        {subjects.data?.map((subject) => (
          <Chip
            key={subject.id}
            label={subject.name}
            selected={subjectFilter === subject.id}
            onPress={() => setSubjectFilter(subject.id)}
          />
        ))}
      </View>

      <Text style={typography.sectionTitle}>Your tasks</Text>
      {tasks.isLoading ? <Text style={typography.muted}>Loading tasks…</Text> : null}
      {tasks.error ? (
        <Card>
          <Text style={styles.error}>Tasks could not be loaded.</Text>
          <Button label="Try again" variant="secondary" onPress={() => tasks.refetch()} />
        </Card>
      ) : null}
      {tasks.data?.map((task) => (
        <Pressable
          key={task.id}
          onPress={() => edit(task)}>
          <Card style={styles.task}>
            <Pressable
              accessibilityLabel={`Complete ${task.title}`}
              disabled={task.status === 'COMPLETED'}
              onPress={() => complete.mutate(task.id)}
              style={[styles.checkbox, task.status === 'COMPLETED' && styles.checked]}>
              {task.status === 'COMPLETED' ? <Text style={styles.tick}>✓</Text> : null}
            </Pressable>
            <View style={styles.copy}>
              <Text style={[typography.body, task.status === 'COMPLETED' && styles.done]}>
                {task.title}
              </Text>
              <Text style={typography.muted}>
                {taskSubject(task)?.name ?? 'No subject'} · {task.priority}
                {task.estimatedMinutes ? ` · ${task.estimatedMinutes} min` : ''}
              </Text>
            </View>
            <Pressable
              accessibilityLabel={`Delete ${task.title}`}
              onPress={() =>
                Alert.alert('Delete task?', task.title, [
                  { text: 'Keep', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => remove.mutate(task.id),
                  },
                ])
              }>
              <Text style={styles.delete}>×</Text>
            </Pressable>
          </Card>
        </Pressable>
      ))}
      {!tasks.isLoading && tasks.data?.length === 0 ? (
        <Text style={typography.muted}>No tasks match these filters.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  task: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: palette.muted, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: palette.primary, borderColor: palette.primary },
  tick: { color: palette.bg, fontWeight: '900' },
  copy: { flex: 1, gap: 2, marginLeft: space.sm },
  done: { color: palette.muted, textDecorationLine: 'line-through' },
  row: { flexDirection: 'row', gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  flex: { flex: 1 },
  label: { color: palette.text, fontSize: 13, fontWeight: '700' },
  error: { color: palette.danger },
  delete: { color: palette.danger, fontSize: 28, paddingHorizontal: space.xs },
});

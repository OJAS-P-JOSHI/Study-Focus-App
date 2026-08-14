import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Heading, Screen, typography } from '@/components/ui';
import { palette, radius, space } from '@/constants/design';
import { subjectsApi, type ApiSubject } from '@/services/resources';

const initialForm = {
  name: '',
  description: '',
  color: '#8B9DFF',
  weeklyTargetMinutes: '300',
};

export default function SubjectsScreen() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ApiSubject | null>(null);
  const [form, setForm] = useState(initialForm);
  const subjects = useQuery({ queryKey: ['subjects'], queryFn: subjectsApi.list });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['subjects'] });
  const save = useMutation({
    mutationFn: () => {
      const input = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        color: form.color,
        weeklyTargetMinutes: Number(form.weeklyTargetMinutes) || 0,
      };
      return editing ? subjectsApi.update(editing.id, input) : subjectsApi.create(input);
    },
    onSuccess: async () => {
      setEditing(null);
      setForm(initialForm);
      await refresh();
    },
  });
  const deactivate = useMutation({
    mutationFn: (subject: ApiSubject) =>
      subjectsApi.update(subject.id, { isActive: !subject.isActive }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: subjectsApi.remove,
    onSuccess: async () => {
      setEditing(null);
      setForm(initialForm);
      await refresh();
    },
  });

  const edit = (subject: ApiSubject) => {
    setEditing(subject);
    setForm({
      name: subject.name,
      description: subject.description ?? '',
      color: subject.color,
      weeklyTargetMinutes: String(subject.weeklyTargetMinutes),
    });
  };

  return (
    <Screen>
      <Heading
        eyebrow="Areas of attention"
        title="Subjects"
        subtitle="Organize real work and set a weekly target."
      />
      <Card>
        <Text style={typography.sectionTitle}>{editing ? 'Edit subject' : 'New subject'}</Text>
        <Field
          label="Name"
          value={form.name}
          onChangeText={(name) => setForm((value) => ({ ...value, name }))}
        />
        <Field
          label="Description"
          value={form.description}
          onChangeText={(description) => setForm((value) => ({ ...value, description }))}
        />
        <View style={styles.fields}>
          <View style={styles.flex}>
            <Field
              label="Color"
              value={form.color}
              autoCapitalize="characters"
              onChangeText={(color) => setForm((value) => ({ ...value, color }))}
            />
          </View>
          <View style={styles.flex}>
            <Field
              label="Weekly target (min)"
              value={form.weeklyTargetMinutes}
              keyboardType="number-pad"
              onChangeText={(weeklyTargetMinutes) =>
                setForm((value) => ({ ...value, weeklyTargetMinutes }))
              }
            />
          </View>
        </View>
        {save.error ? <Text style={styles.error}>Could not save this subject.</Text> : null}
        <Button
          label={editing ? 'Save changes' : 'Create subject'}
          disabled={!form.name.trim()}
          loading={save.isPending}
          onPress={() => save.mutate()}
        />
        {editing ? (
          <Button
            label="Cancel edit"
            variant="ghost"
            onPress={() => {
              setEditing(null);
              setForm(initialForm);
            }}
          />
        ) : null}
      </Card>

      {subjects.isLoading ? <Text style={typography.muted}>Loading subjects…</Text> : null}
      {subjects.error ? (
        <Card>
          <Text style={styles.error}>Subjects could not be loaded.</Text>
          <Button label="Try again" variant="secondary" onPress={() => subjects.refetch()} />
        </Card>
      ) : null}
      {subjects.data?.map((subject) => (
        <Pressable key={subject.id} onPress={() => edit(subject)}>
          <Card style={!subject.isActive ? styles.inactive : undefined}>
          <View style={styles.top}>
            <View style={[styles.icon, { backgroundColor: `${subject.color}25` }]}>
              <View style={[styles.dot, { backgroundColor: subject.color }]} />
            </View>
            <View style={styles.copy}>
              <Text style={typography.sectionTitle}>{subject.name}</Text>
              <Text style={typography.muted}>
                {subject.weeklyTargetMinutes} min weekly target ·{' '}
                {subject.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </View>
            <View style={styles.actions}>
              <View style={styles.flex}>
                <Button
                  label={subject.isActive ? 'Deactivate' : 'Reactivate'}
                  variant="secondary"
                  onPress={() => deactivate.mutate(subject)}
                />
              </View>
              <View style={styles.flex}>
                <Button
                  label="Delete"
                  variant="danger"
                  onPress={() =>
                    Alert.alert(
                      'Delete subject?',
                      'Existing tasks and sessions will keep their history where possible.',
                      [
                        { text: 'Keep', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => remove.mutate(subject.id),
                        },
                      ],
                    )
                  }
                />
              </View>
            </View>
          </Card>
        </Pressable>
      ))}
      {!subjects.isLoading && subjects.data?.length === 0 ? (
        <Text style={typography.muted}>Create your first subject to organize focus sessions.</Text>
      ) : null}
      <Button label="Focus on a subject" onPress={() => router.push('/focus/start')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  copy: { flex: 1, gap: 3 },
  arrow: { color: palette.muted, fontSize: 28 },
  fields: { flexDirection: 'row', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  inactive: { opacity: 0.58 },
  error: { color: palette.danger },
});

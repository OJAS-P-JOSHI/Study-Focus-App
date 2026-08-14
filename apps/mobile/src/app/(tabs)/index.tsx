import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Metric, Screen, typography } from '@/components/ui';
import { palette, radius, space } from '@/constants/design';
import { initialTasks } from '@/data/sample-data';
import { useAuthStore } from '@/stores/auth-store';
import { useFocusStore } from '@/stores/focus-store';

export default function DashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const session = useFocusStore((state) => state.session);
  const firstName = user?.name.split(' ')[0] ?? 'there';
  return (
    <Screen>
      <Heading
        eyebrow="Friday · 14 August"
        title={`Good afternoon, ${firstName}`}
        subtitle="Protect one small pocket of attention today."
      />
      {session ? (
        <Card style={styles.activeCard}>
          <Text style={styles.activeLabel}>SESSION IN PROGRESS</Text>
          <Text style={styles.activeTitle}>{session.subjectName}</Text>
          <Text style={typography.muted}>{session.status === 'PAUSED' ? 'Paused' : 'Focused now'}</Text>
          <Button label="Return to session" onPress={() => router.push('/focus/active')} />
        </Card>
      ) : (
        <View style={styles.hero}>
          <View style={styles.orbit}><View style={styles.orbitInner}><Text style={styles.heroMinutes}>25</Text><Text style={styles.heroUnit}>MINUTES</Text></View></View>
          <Text style={styles.heroTitle}>Ready when you are.</Text>
          <Text style={styles.heroCopy}>Choose a subject, silence the noise, and begin.</Text>
          <Button label="Start a focus session" onPress={() => router.push('/focus/start')} />
        </View>
      )}
      <Card style={styles.metrics}>
        <Metric value="42m" label="Focused today" />
        <Metric value="3" label="Sessions" />
        <Metric value="6" label="Day streak" />
      </Card>
      <View style={styles.sectionRow}>
        <Text style={typography.sectionTitle}>Up next</Text>
        <Pressable onPress={() => router.push('/tasks')}><Text style={typography.accent}>All tasks</Text></Pressable>
      </View>
      {initialTasks.filter((task) => !task.done).slice(0, 2).map((task) => (
        <Card key={task.id} style={styles.task}>
          <View style={styles.checkbox} />
          <View style={styles.taskCopy}>
            <Text style={typography.body}>{task.title}</Text>
            <Text style={typography.muted}>{task.subject} · {task.due}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center', gap: space.sm, padding: space.lg, backgroundColor: palette.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: palette.border,
  },
  orbit: {
    width: 142, height: 142, borderRadius: 71, borderWidth: 1, borderColor: palette.primary,
    padding: 10, marginBottom: space.sm,
  },
  orbitInner: {
    flex: 1, borderRadius: 60, backgroundColor: palette.primaryDark,
    alignItems: 'center', justifyContent: 'center',
  },
  heroMinutes: { color: palette.text, fontSize: 42, lineHeight: 46, fontWeight: '300' },
  heroUnit: { color: palette.primary, fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  heroTitle: { color: palette.text, fontSize: 21, fontWeight: '800' },
  heroCopy: { color: palette.muted, textAlign: 'center', marginBottom: space.sm },
  metrics: { flexDirection: 'row' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm },
  task: { flexDirection: 'row', alignItems: 'center' },
  taskCopy: { flex: 1, gap: 3 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: palette.muted },
  activeCard: { backgroundColor: palette.primaryDark },
  activeLabel: { color: palette.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  activeTitle: { color: palette.text, fontSize: 25, fontWeight: '800' },
});

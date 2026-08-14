import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Metric, Screen, typography } from '@/components/ui';
import { palette, radius, space } from '@/constants/design';
import {
  analyticsApi,
  focusApi,
  settingsApi,
  tasksApi,
  timetableApi,
} from '@/services/resources';
import { useAuthStore } from '@/stores/auth-store';
import { useFocusStore } from '@/stores/focus-store';

export default function DashboardScreen() {
  const user = useAuthStore((state) => state.user);
  const session = useFocusStore((state) => state.session);
  const overview = useQuery({
    queryKey: ['analytics', 'overview', 30],
    queryFn: () => analyticsApi.overview(30),
  });
  const settings = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const timetable = useQuery({ queryKey: ['timetable'], queryFn: timetableApi.list });
  const sessions = useQuery({ queryKey: ['focus-sessions'], queryFn: () => focusApi.list() });
  const tasks = useQuery({
    queryKey: ['tasks', 'TODO'],
    queryFn: () => tasksApi.list({ status: 'TODO' }),
  });
  const firstName = user?.name.split(' ')[0] ?? 'there';
  const now = new Date();
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const todayPlans = timetable.data
    ?.filter((entry) => entry.isEnabled && entry.dayOfWeek === now.getDay())
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const currentPlan = todayPlans?.find(
    (entry) => entry.startTime <= clock && entry.endTime > clock,
  );
  const nextPlan = todayPlans?.find((entry) => entry.startTime > clock);
  const today = overview.data?.today.minutes ?? 0;
  const target = settings.data?.dailyStudyTargetMinutes ?? 180;
  const progress = Math.min(100, Math.round((today / target) * 100));
  const refreshing =
    overview.isFetching ||
    settings.isFetching ||
    timetable.isFetching ||
    sessions.isFetching ||
    tasks.isFetching;
  const refresh = () => {
    void Promise.all([
      overview.refetch(),
      settings.refetch(),
      timetable.refetch(),
      sessions.refetch(),
      tasks.refetch(),
    ]);
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={palette.primary}
        />
      }>
      <Heading
        eyebrow={now.toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
        title={`Good afternoon, ${firstName}`}
        subtitle={
          currentPlan
            ? `Now: ${currentPlan.title}`
            : nextPlan
              ? `Next: ${nextPlan.title} at ${nextPlan.startTime}`
              : 'Choose the most useful next step.'
        }
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
          <View style={styles.orbit}>
            <View style={styles.orbitInner}>
              <Text style={styles.heroMinutes}>
                {settings.data?.defaultFocusMinutes ?? 50}
              </Text>
              <Text style={styles.heroUnit}>MINUTES</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>
            {currentPlan?.title ?? nextPlan?.title ?? 'Ready when you are.'}
          </Text>
          <Text style={styles.heroCopy}>
            {currentPlan
              ? 'This timetable block is current. Start only when you are ready to study.'
              : nextPlan
                ? `Planned for ${nextPlan.startTime}–${nextPlan.endTime}.`
                : 'Choose a subject, silence the noise, and begin.'}
          </Text>
          <Button label="START FOCUS" onPress={() => router.push('/focus/start')} />
        </View>
      )}
      <Card style={styles.metrics}>
        <Metric value={`${today}m`} label={`Today · ${progress}%`} />
        <Metric value={`${overview.data?.today.sessions ?? 0}`} label="Sessions" />
        <Metric value={`${overview.data?.streak.current ?? 0}`} label="Day streak" />
      </Card>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={typography.muted}>
        {today} of {target} daily target minutes
      </Text>
      {currentPlan || nextPlan ? (
        <Card>
          <Text style={styles.activeLabel}>{currentPlan ? 'CURRENT' : 'NEXT'}</Text>
          <Text style={typography.sectionTitle}>{(currentPlan ?? nextPlan)?.title}</Text>
          <Text style={typography.muted}>
            {(currentPlan ?? nextPlan)?.startTime}–{(currentPlan ?? nextPlan)?.endTime}
          </Text>
        </Card>
      ) : null}
      <View style={styles.sectionRow}>
        <Text style={typography.sectionTitle}>Up next</Text>
        <Pressable onPress={() => router.push('/tasks')}><Text style={typography.accent}>All tasks</Text></Pressable>
      </View>
      {tasks.data?.slice(0, 2).map((task) => (
        <Card key={task.id} style={styles.task}>
          <View style={styles.checkbox} />
          <View style={styles.taskCopy}>
            <Text style={typography.body}>{task.title}</Text>
            <Text style={typography.muted}>
              {task.priority}
              {task.dueAt ? ` · due ${new Date(task.dueAt).toLocaleDateString()}` : ''}
            </Text>
          </View>
        </Card>
      ))}
      <Text style={typography.sectionTitle}>Recent sessions</Text>
      {sessions.data
        ?.filter((item) => item.status === 'COMPLETED')
        .slice(0, 3)
        .map((item) => (
          <Card key={item.id} style={styles.recent}>
            <Text style={typography.body}>
              {typeof item.subjectId === 'object' ? item.subjectId.name : 'Focused study'}
            </Text>
            <Text style={typography.muted}>
              {item.actualMinutes} min · {new Date(item.startedAt).toLocaleDateString()}
            </Text>
          </Card>
        ))}
      {[overview, settings, timetable, sessions, tasks].some((query) => query.error) ? (
        <Text style={styles.error}>Some dashboard data could not be loaded. Pull to retry.</Text>
      ) : null}
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
  progressTrack: { height: 6, borderRadius: 6, backgroundColor: palette.border, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 6, backgroundColor: palette.primary },
  recent: { gap: space.xs },
  error: { color: palette.danger },
});

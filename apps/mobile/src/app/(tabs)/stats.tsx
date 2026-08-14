import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Chip, Heading, Metric, Screen, typography } from '@/components/ui';
import { palette, space } from '@/constants/design';
import { analyticsApi } from '@/services/resources';

export default function StatsScreen() {
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const overview = useQuery({
    queryKey: ['analytics', 'overview', days],
    queryFn: () => analyticsApi.overview(days),
  });
  const history = useQuery({
    queryKey: ['analytics', 'history', days],
    queryFn: () => analyticsApi.history(days),
  });
  const subjects = useQuery({
    queryKey: ['analytics', 'subjects', days],
    queryFn: () => analyticsApi.subjects(days),
  });
  const maxMinutes = Math.max(1, ...(history.data?.points.map((point) => point.minutes) ?? [1]));
  const chartPoints = history.data?.points.slice(days === 7 ? -7 : -14) ?? [];

  return (
    <Screen>
      <Heading eyebrow="Small gains compound" title="Progress" subtitle="Notice the rhythm, not just the total." />
      <View style={styles.filters}>
        {([7, 30, 90] as const).map((value) => (
          <Chip
            key={value}
            label={`${value} days`}
            selected={days === value}
            onPress={() => setDays(value)}
          />
        ))}
      </View>
      <Card style={styles.metrics}>
        <Metric value={`${overview.data?.today.minutes ?? 0}m`} label="Today" />
        <Metric value={`${overview.data?.weeklyMinutes ?? 0}m`} label="This week" />
        <Metric value={`${overview.data?.monthlyMinutes ?? 0}m`} label="This month" />
      </Card>
      <Card>
        <View style={styles.sectionRow}>
          <Text style={typography.sectionTitle}>Focus activity</Text>
          <Text style={typography.muted}>{history.data?.totalMinutes ?? 0} min</Text>
        </View>
        <View style={styles.chart}>
          {chartPoints.map((point) => (
            <View key={point.date} style={styles.barColumn}>
              <View
                style={[
                  styles.bar,
                  { height: Math.max(6, (point.minutes / maxMinutes) * 92) },
                  point.minutes > 0 && styles.barActive,
                ]}
              />
              <Text style={styles.day}>
                {new Date(`${point.date}T12:00:00`).toLocaleDateString(undefined, {
                  weekday: 'narrow',
                })}
              </Text>
            </View>
          ))}
        </View>
        {!chartPoints.some((point) => point.minutes) ? (
          <Text style={typography.muted}>Complete a focus session to begin your history.</Text>
        ) : null}
      </Card>
      <Card>
        <Text style={typography.sectionTitle}>Consistency</Text>
        <View style={styles.streakRow}>
          <Text style={styles.streak}>{overview.data?.streak.current ?? 0}</Text>
          <View style={styles.streakCopy}>
            <Text style={typography.body}>day focus streak</Text>
            <Text style={typography.muted}>
              Longest: {overview.data?.streak.longest ?? 0} days
            </Text>
          </View>
        </View>
      </Card>
      <Card>
        <Text style={typography.sectionTitle}>Session quality</Text>
        <View style={styles.metrics}>
          <Metric
            value={`${overview.data?.averageSessionDuration ?? 0}m`}
            label="Average session"
          />
          <Metric
            value={`${overview.data?.averageDistractions ?? 0}`}
            label="Avg distractions"
          />
          <Metric
            value={`${overview.data?.timetableAdherence.percentage ?? 0}%`}
            label="Plan adherence"
          />
        </View>
      </Card>
      <Text style={typography.sectionTitle}>Subject distribution</Text>
      {subjects.data?.map((item) => {
        const percentage = overview.data?.rangeMinutes
          ? Math.round((item.minutes / overview.data.rangeMinutes) * 100)
          : 0;
        return (
          <Card key={item.subject?.id ?? 'unassigned'} style={styles.subject}>
            <View style={styles.sectionRow}>
              <Text style={typography.body}>{item.subject?.name ?? 'Unassigned'}</Text>
              <Text style={typography.muted}>{item.minutes}m · {percentage}%</Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${percentage}%`,
                    backgroundColor: item.subject?.color ?? palette.muted,
                  },
                ]}
              />
            </View>
          </Card>
        );
      })}
      {[overview, history, subjects].some((query) => query.isLoading) ? (
        <Text style={typography.muted}>Calculating progress…</Text>
      ) : null}
      {[overview, history, subjects].some((query) => query.error) ? (
        <Text style={styles.error}>Progress could not be loaded.</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row' },
  filters: { flexDirection: 'row', gap: space.sm },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chart: { height: 120, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', gap: 3 },
  barColumn: { flex: 1, alignItems: 'center', gap: space.sm },
  bar: { width: '70%', minHeight: 6, borderRadius: 7, backgroundColor: palette.primaryDark },
  barActive: { backgroundColor: palette.primary },
  day: { color: palette.muted, fontSize: 11 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  streak: { color: palette.primary, fontSize: 50, fontWeight: '300' },
  streakCopy: { gap: 3 },
  subject: { gap: space.sm },
  track: { height: 5, borderRadius: 5, backgroundColor: palette.border, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 5 },
  error: { color: palette.danger },
});

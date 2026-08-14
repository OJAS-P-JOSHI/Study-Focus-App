import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Metric, Screen, typography } from '@/components/ui';
import { palette, radius, space } from '@/constants/design';
import { useFocusStore } from '@/stores/focus-store';

export default function FocusSummaryScreen() {
  const { lastCompleted, clearSummary } = useFocusStore();
  const minutes =
    lastCompleted?.actualMinutes ??
    (lastCompleted
      ? Math.max(
          0,
          Math.floor(
            ((lastCompleted.completedAt ?? lastCompleted.endsAt) -
              lastCompleted.startedAt -
              lastCompleted.totalPausedMs) /
              60_000,
          ),
        )
      : 0);
  return (
    <Screen style={styles.screen}>
      <View style={styles.check}><Text style={styles.checkText}>✓</Text></View>
      <Text style={styles.title}>Session complete</Text>
      <Text style={styles.subtitle}>You kept a promise to your attention.</Text>
      <Card style={styles.metrics}>
        <Metric value={`${minutes}m`} label="Focused" />
        <Metric value={lastCompleted?.subjectName ?? '—'} label="Subject" />
      </Card>
      <Card>
        <Text style={typography.sectionTitle}>Take a breath before moving on</Text>
        <Text style={typography.muted}>Stand up, look into the distance, and give your mind a moment to settle.</Text>
      </Card>
      <View style={styles.actions}>
        <Button
          label="Back to today"
          onPress={() => {
            clearSummary();
            router.replace('/(tabs)');
          }}
        />
        <Button label="Start another" variant="secondary" onPress={() => router.replace('/focus/start')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center', alignItems: 'center' },
  check: {
    width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.primaryDark, borderWidth: 1, borderColor: palette.primary,
  },
  checkText: { color: palette.primary, fontSize: 40 },
  title: { color: palette.text, fontSize: 31, fontWeight: '800', marginTop: space.sm },
  subtitle: { color: palette.muted, fontSize: 15, textAlign: 'center', marginBottom: space.md },
  metrics: { width: '100%', flexDirection: 'row', borderRadius: radius.lg },
  actions: { width: '100%', gap: space.sm, marginTop: space.md },
});

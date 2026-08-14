import { StyleSheet, Text, View } from 'react-native';

import { Card, Heading, Metric, Screen, typography } from '@/components/ui';
import { palette, space } from '@/constants/design';

const bars = [38, 60, 46, 82, 66, 30, 12];

export default function StatsScreen() {
  return (
    <Screen>
      <Heading eyebrow="Small gains compound" title="Progress" subtitle="Notice the rhythm, not just the total." />
      <Card style={styles.metrics}>
        <Metric value="9h 42m" label="This week" />
        <Metric value="+18%" label="vs last week" />
      </Card>
      <Card>
        <View style={styles.sectionRow}>
          <Text style={typography.sectionTitle}>Focus activity</Text>
          <Text style={typography.muted}>Last 7 days</Text>
        </View>
        <View style={styles.chart}>
          {bars.map((height, index) => (
            <View key={index} style={styles.barColumn}>
              <View style={[styles.bar, { height }, index === 4 && styles.barActive]} />
              <Text style={styles.day}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</Text>
            </View>
          ))}
        </View>
      </Card>
      <Card>
        <Text style={typography.sectionTitle}>Consistency</Text>
        <View style={styles.streakRow}>
          <Text style={styles.streak}>6</Text>
          <View style={styles.streakCopy}>
            <Text style={typography.body}>day focus streak</Text>
            <Text style={typography.muted}>Your longest is 12 days</Text>
          </View>
        </View>
      </Card>
      <Card>
        <Text style={typography.sectionTitle}>A useful pattern</Text>
        <Text style={typography.muted}>
          Your strongest sessions begin before noon and last 25–40 minutes. Protect that window when you can.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chart: { height: 120, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' },
  barColumn: { alignItems: 'center', gap: space.sm },
  bar: { width: 22, minHeight: 8, borderRadius: 7, backgroundColor: palette.primaryDark },
  barActive: { backgroundColor: palette.primary },
  day: { color: palette.muted, fontSize: 11 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  streak: { color: palette.primary, fontSize: 50, fontWeight: '300' },
  streakCopy: { gap: 3 },
});

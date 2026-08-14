import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Screen, typography } from '@/components/ui';
import { palette, radius, space } from '@/constants/design';
import { subjects } from '@/data/sample-data';

export default function SubjectsScreen() {
  return (
    <Screen>
      <Heading eyebrow="Areas of attention" title="Subjects" subtitle="See where your energy has been going." />
      {subjects.map((subject) => (
        <Card key={subject.id}>
          <View style={styles.top}>
            <View style={[styles.icon, { backgroundColor: `${subject.color}25` }]}>
              <View style={[styles.dot, { backgroundColor: subject.color }]} />
            </View>
            <View style={styles.copy}>
              <Text style={typography.sectionTitle}>{subject.name}</Text>
              <Text style={typography.muted}>{subject.weeklyMinutes} minutes this week</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, subject.weeklyMinutes / 2.5)}%`, backgroundColor: subject.color }]} />
          </View>
        </Card>
      ))}
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
  track: { height: 5, backgroundColor: palette.border, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 5 },
});

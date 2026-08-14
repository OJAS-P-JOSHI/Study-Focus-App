import { StyleSheet, Text, View } from 'react-native';

import { Card, Chip, Heading, Screen, typography } from '@/components/ui';
import { palette, space } from '@/constants/design';

const blocks = [
  { time: '09:00', title: 'Calculus practice', subject: 'Mathematics', color: palette.primary },
  { time: '11:30', title: 'Wave mechanics', subject: 'Physics', color: '#8FB8ED' },
  { time: '15:00', title: 'Algorithms review', subject: 'Computer Science', color: palette.warning },
];

export default function TimetableScreen() {
  return (
    <Screen>
      <Heading eyebrow="Your rhythm" title="Timetable" subtitle="A spacious plan leaves room to think." />
      <View style={styles.days}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
          <View key={`${day}-${index}`} style={[styles.day, index === 4 && styles.today]}>
            <Text style={[styles.dayName, index === 4 && styles.todayText]}>{day}</Text>
            <Text style={[styles.dayNumber, index === 4 && styles.todayText]}>{10 + index}</Text>
          </View>
        ))}
      </View>
      <View style={styles.filter}><Chip label="Today" selected /><Chip label="Week" /></View>
      {blocks.map((block) => (
        <View key={block.time} style={styles.row}>
          <Text style={styles.time}>{block.time}</Text>
          <Card style={styles.block}>
            <View style={[styles.dot, { backgroundColor: block.color }]} />
            <View style={styles.copy}>
              <Text style={typography.body}>{block.title}</Text>
              <Text style={typography.muted}>{block.subject} · 50 min</Text>
            </View>
          </Card>
        </View>
      ))}
      <Text style={styles.note}>Keep 10-minute buffers between sessions to reset your attention.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 39, paddingVertical: space.sm, alignItems: 'center', gap: 5, borderRadius: 14 },
  today: { backgroundColor: palette.primary },
  dayName: { color: palette.muted, fontSize: 11, fontWeight: '700' },
  dayNumber: { color: palette.text, fontSize: 15, fontWeight: '700' },
  todayText: { color: palette.bg },
  filter: { flexDirection: 'row', gap: space.sm, marginVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  time: { color: palette.muted, width: 45, fontSize: 13 },
  block: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 7, height: 42, borderRadius: 5 },
  copy: { flex: 1, gap: 3 },
  note: { color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: space.md },
});

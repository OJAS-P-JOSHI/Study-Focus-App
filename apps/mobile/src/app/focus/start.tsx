import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, Field, Heading, Screen, typography } from '@/components/ui';
import { palette, space } from '@/constants/design';
import { subjects } from '@/data/sample-data';
import { PRODUCTION_INTERVALS } from '@/services/notification-service';
import { useFocusStore } from '@/stores/focus-store';

const durations = [15, 25, 40, 50];

export default function StartFocusScreen() {
  const start = useFocusStore((state) => state.start);
  const [subject, setSubject] = useState(subjects[0]);
  const [duration, setDuration] = useState(25);
  const [reminder, setReminder] = useState(10);
  const [task, setTask] = useState('');
  const [starting, setStarting] = useState(false);

  return (
    <Screen>
      <Heading title="Set your intention" subtitle="Decide what matters before the timer begins." />
      <Text style={typography.sectionTitle}>Subject</Text>
      <View style={styles.wrap}>
        {subjects.map((item) => (
          <Chip key={item.id} label={item.name} selected={item.id === subject.id} onPress={() => setSubject(item)} />
        ))}
      </View>
      <Field
        label="What will you work on? (optional)"
        placeholder="e.g. Complete problem set"
        value={task}
        onChangeText={setTask}
      />
      <Card>
        <Text style={typography.sectionTitle}>Focus duration</Text>
        <View style={styles.wrap}>
          {durations.map((value) => (
            <Chip key={value} label={`${value} min`} selected={duration === value} onPress={() => setDuration(value)} />
          ))}
        </View>
      </Card>
      <Card>
        <Text style={typography.sectionTitle}>Return reminder</Text>
        <Text style={typography.muted}>A quiet notification if you leave the app during focus.</Text>
        <View style={styles.wrap}>
          {PRODUCTION_INTERVALS.map((value) => (
            <Chip key={value} label={`${value}m`} selected={reminder === value} onPress={() => setReminder(value)} />
          ))}
          {__DEV__ ? <Chip label="1m test" selected={reminder === 1} onPress={() => setReminder(1)} /> : null}
        </View>
      </Card>
      <View style={styles.note}>
        <Text style={styles.noteIcon}>◌</Text>
        <Text style={typography.muted}>The timer uses elapsed timestamps, so it remains accurate if the app sleeps or restarts.</Text>
      </View>
      <Button
        label="Begin focus"
        loading={starting}
        onPress={async () => {
          setStarting(true);
          await start({
            subjectId: subject.id,
            subjectName: subject.name,
            task: task.trim() || undefined,
            durationMinutes: duration,
            reminderMinutes: reminder,
            allowDevMinute: __DEV__ && reminder === 1,
          });
          router.replace('/focus/active');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm },
  noteIcon: { color: palette.primary, fontSize: 24 },
});

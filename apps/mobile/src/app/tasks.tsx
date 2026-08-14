import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Screen, typography } from '@/components/ui';
import { palette, space } from '@/constants/design';
import { initialTasks } from '@/data/sample-data';
import type { StudyTask } from '@/types';

const KEY = '@study-focus/tasks/v1';

export default function TasksScreen() {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState('');
  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((raw) => raw && setTasks(JSON.parse(raw) as StudyTask[]));
  }, []);
  const save = (next: StudyTask[]) => {
    setTasks(next);
    void AsyncStorage.setItem(KEY, JSON.stringify(next));
  };
  return (
    <Screen>
      <Card>
        <Field label="Add a small next step" placeholder="What needs doing?" value={title} onChangeText={setTitle} />
        <Button
          label="Add task"
          disabled={!title.trim()}
          onPress={() => {
            save([...tasks, { id: `${Date.now()}`, title: title.trim(), subject: 'General', done: false }]);
            setTitle('');
          }}
        />
      </Card>
      <Text style={typography.sectionTitle}>Your tasks</Text>
      {tasks.map((task) => (
        <Pressable
          key={task.id}
          onPress={() => save(tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))}>
          <Card style={styles.task}>
            <View style={[styles.checkbox, task.done && styles.checked]}>
              {task.done ? <Text style={styles.tick}>✓</Text> : null}
            </View>
            <View style={styles.copy}>
              <Text style={[typography.body, task.done && styles.done]}>{task.title}</Text>
              <Text style={typography.muted}>{task.subject}</Text>
            </View>
          </Card>
        </Pressable>
      ))}
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
});

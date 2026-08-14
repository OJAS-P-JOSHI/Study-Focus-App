import type { StudyTask, Subject } from '@/types';

export const subjects: Subject[] = [
  { id: 'math', name: 'Mathematics', color: '#7ED6AC', weeklyMinutes: 190 },
  { id: 'physics', name: 'Physics', color: '#8FB8ED', weeklyMinutes: 135 },
  { id: 'literature', name: 'Literature', color: '#D6A8E6', weeklyMinutes: 95 },
  { id: 'computer-science', name: 'Computer Science', color: '#F3C878', weeklyMinutes: 160 },
];

export const initialTasks: StudyTask[] = [
  { id: '1', title: 'Practice integration problems', subject: 'Mathematics', done: false, due: 'Today' },
  { id: '2', title: 'Review wave interference', subject: 'Physics', done: false, due: 'Today' },
  { id: '3', title: 'Read chapter seven', subject: 'Literature', done: true, due: 'Today' },
];

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, typography } from '@/components/ui';
import { palette, radius, space } from '@/constants/design';
import {
  NotificationService,
  type ReminderStatus,
} from '@/services/notification-service';
import { getRemainingMs, useFocusStore } from '@/stores/focus-store';

function formatTime(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function ActiveFocusScreen() {
  const { session, pause, resume, complete, cancel, expire, logDistraction } =
    useFocusStore();
  const [now, setNow] = useState(Date.now);
  const [recovery, setRecovery] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reminderStatus, setReminderStatus] = useState<ReminderStatus | null>(null);
  const leftAt = useRef<number | null>(null);
  const expiring = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session) return;
    void NotificationService.getStatus(session.id).then(setReminderStatus);
  }, [session]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') leftAt.current = Date.now();
      if (state === 'active' && leftAt.current && Date.now() - leftAt.current > 30_000) {
        setRecovery(true);
        leftAt.current = null;
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (session && session.status === 'ACTIVE' && getRemainingMs(session) === 0) {
      if (expiring.current) return;
      expiring.current = true;
      void expire()
        .then(() => router.replace('/(tabs)'))
        .catch(() => {
          expiring.current = false;
          setActionError('Could not close the elapsed session. It remains saved locally.');
        });
    }
  });

  if (!session) {
    router.replace('/(tabs)');
    return null;
  }
  const remaining = getRemainingMs(session, now);
  const progress = 1 - remaining / (session.durationMinutes * 60_000);
  const nextReminderMs = reminderStatus?.nextReminderAt
    ? Math.max(0, reminderStatus.nextReminderAt - now)
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Text style={styles.mode}>{session.status === 'PAUSED' ? 'PAUSED' : 'FOCUSING'}</Text>
        <Pressable
          onPress={() =>
            void cancel()
              .then(() => router.replace('/(tabs)'))
              .catch(() => setActionError('Could not cancel the session.'))
          }>
          <Text style={styles.close}>×</Text>
        </Pressable>
      </View>
      <View style={styles.center}>
        <View style={styles.ring}>
          <View style={styles.ringInner}>
            <Text style={styles.time}>{formatTime(remaining)}</Text>
            <Text style={styles.remaining}>REMAINING</Text>
          </View>
        </View>
        <Text style={styles.subject}>{session.subjectName}</Text>
        {session.task ? <Text style={styles.task}>{session.task}</Text> : null}
        {session.status === 'PAUSED' ? (
          <Text style={styles.reminder}>Reminders paused</Text>
        ) : reminderStatus && reminderStatus.permission !== 'granted' ? (
          <Text style={styles.warning}>Reminders disabled in system settings</Text>
        ) : nextReminderMs !== null ? (
          <Text style={styles.reminder}>Next return reminder in {formatTime(nextReminderMs)}</Text>
        ) : (
          <Text style={styles.reminder}>No more reminders before this session ends</Text>
        )}
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(2, progress * 100)}%` }]} /></View>
      </View>
      <View style={styles.controls}>
        <Button
          label={session.status === 'PAUSED' ? 'Resume' : 'Pause'}
          onPress={() => {
            setActionError('');
            void (session.status === 'PAUSED' ? resume() : pause())
              .then(() => NotificationService.getStatus(session.id))
              .then(setReminderStatus)
              .catch(() => setActionError('Could not change the session state.'));
          }}
        />
        <Button
          label="Finish session"
          variant="secondary"
          onPress={() => {
            setActionError('');
            void complete()
              .then(() => router.replace('/focus/summary'))
              .catch(() => setActionError('Could not finish the session. Please try again.'));
          }}
        />
        <Button
          label="I GOT DISTRACTED"
          variant="ghost"
          onPress={() => {
            setActionError('');
            void logDistraction()
              .then(() => setRecovery(true))
              .catch(() => setActionError('Could not record the distraction.'));
          }}
        />
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      </View>
      <Modal visible={recovery} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Card style={styles.modal}>
            <Text style={styles.recoveryTitle}>You&apos;re still in the session.</Text>
            <Text style={typography.muted}>
              No judgment. Let the distraction go and return to:{' '}
              {session.task ?? session.subjectName}.
            </Text>
            <Button label="GET BACK TO WORK" onPress={() => setRecovery(false)} />
            <Button label="Pause for now" variant="ghost" onPress={() => void pause().then(() => setRecovery(false))} />
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg, padding: space.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mode: { color: palette.primary, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  close: { color: palette.muted, fontSize: 32, fontWeight: '300' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  ring: { width: 270, height: 270, padding: 10, borderRadius: 135, borderWidth: 2, borderColor: palette.primary },
  ringInner: { flex: 1, borderRadius: 125, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surface },
  time: { color: palette.text, fontSize: 58, fontWeight: '200', fontVariant: ['tabular-nums'] },
  remaining: { color: palette.muted, letterSpacing: 2, fontSize: 10, fontWeight: '800' },
  subject: { color: palette.text, fontSize: 24, fontWeight: '800', marginTop: space.lg },
  task: { color: palette.muted, fontSize: 15 },
  reminder: { color: palette.muted, fontSize: 13, marginTop: space.sm },
  warning: { color: palette.warning, fontSize: 13, marginTop: space.sm },
  progressTrack: { width: 180, height: 4, backgroundColor: palette.border, borderRadius: 4, marginTop: space.md, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: palette.primary },
  controls: { gap: space.sm },
  modalBackdrop: { flex: 1, backgroundColor: '#000000B8', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  modal: { width: '100%', borderRadius: radius.lg },
  recoveryTitle: { color: palette.text, fontSize: 25, fontWeight: '800' },
  error: { color: palette.danger, textAlign: 'center' },
});

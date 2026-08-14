import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, radius, space } from '@/constants/design';

export function Screen({
  children,
  scroll = true,
  style,
}: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) {
  const body = <View style={[styles.content, style]}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function Heading({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={styles.headingRow}>
      <View style={styles.headingCopy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? palette.bg : palette.text} />
      ) : (
        <Text style={[styles.buttonText, variant === 'primary' && styles.buttonTextPrimary]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.muted}
        {...props}
        style={[styles.input, props.multiline && styles.multiline, props.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export const typography = StyleSheet.create({
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '700' },
  body: { color: palette.text, fontSize: 15, lineHeight: 22 },
  muted: { color: palette.muted, fontSize: 14, lineHeight: 20 },
  accent: { color: palette.primary },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  scroll: { flexGrow: 1 },
  content: { flex: 1, padding: space.lg, gap: space.md, backgroundColor: palette.bg },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  headingCopy: { flex: 1, gap: space.xs },
  eyebrow: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: palette.text, fontSize: 30, lineHeight: 36, fontWeight: '800' },
  subtitle: { color: palette.muted, fontSize: 15, lineHeight: 22 },
  card: {
    padding: space.md,
    gap: space.md,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  button: {
    minHeight: 52,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  button_primary: { backgroundColor: palette.primary },
  button_secondary: { backgroundColor: palette.surfaceRaised, borderWidth: 1, borderColor: palette.border },
  button_danger: { backgroundColor: '#3D2022' },
  button_ghost: { backgroundColor: 'transparent' },
  buttonText: { color: palette.text, fontSize: 15, fontWeight: '700' },
  buttonTextPrimary: { color: palette.bg },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
  field: { gap: space.xs },
  label: { color: palette.text, fontSize: 13, fontWeight: '700' },
  input: {
    minHeight: 52,
    color: palette.text,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: 16,
  },
  multiline: { minHeight: 90, paddingTop: space.md, textAlignVertical: 'top' },
  error: { color: palette.danger, fontSize: 12 },
  metric: { flex: 1, gap: 2 },
  metricValue: { color: palette.text, fontSize: 25, fontWeight: '800' },
  metricLabel: { color: palette.muted, fontSize: 12 },
  chip: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  chipSelected: { backgroundColor: palette.primaryDark, borderColor: palette.primary },
  chipText: { color: palette.muted, fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: palette.primary },
});

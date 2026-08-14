import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';

import { Button, Card, Field, Screen, typography } from '@/components/ui';
import { palette, space } from '@/constants/design';
import { useAuthStore } from '@/stores/auth-store';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Use at least 6 characters'),
});
type Form = z.infer<typeof schema>;

export default function LoginScreen() {
  const { login, continueOffline } = useAuthStore();
  const { control, handleSubmit, setError, formState } = useForm<Form>({
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    const result = schema.safeParse(values);
    if (!result.success) {
      result.error.issues.forEach((issue) =>
        setError(issue.path[0] as keyof Form, { message: issue.message }),
      );
      return;
    }
    try {
      await login(values.email.trim(), values.password);
      router.replace('/(tabs)');
    } catch {
      setError('root', { message: 'Could not sign in. Check your details or continue offline.' });
    }
  });

  return (
    <Screen style={styles.screen}>
      <View style={styles.brand}>
        <View style={styles.mark}><Text style={styles.markText}>S</Text></View>
        <Text style={styles.name}>Stillpoint</Text>
        <Text style={styles.tagline}>A calmer place to do focused work.</Text>
      </View>
      <Card>
        <Text style={typography.sectionTitle}>Welcome back</Text>
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <Field
              label="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field, fieldState }) => (
            <Field
              label="Password"
              secureTextEntry
              value={field.value}
              onChangeText={field.onChange}
              error={fieldState.error?.message}
            />
          )}
        />
        {formState.errors.root ? <Text style={styles.error}>{formState.errors.root.message}</Text> : null}
        <Button label="Sign in" onPress={submit} loading={formState.isSubmitting} />
        <Button
          label="Continue offline"
          variant="ghost"
          onPress={async () => {
            await continueOffline();
            router.replace('/(tabs)');
          }}
        />
      </Card>
      <Text style={styles.footer}>
        New here? <Link href="/(auth)/register" style={styles.link}>Create an account</Link>
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  brand: { alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  mark: {
    width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.primary,
  },
  markText: { color: palette.bg, fontSize: 28, fontWeight: '900' },
  name: { color: palette.text, fontSize: 34, fontWeight: '900' },
  tagline: { color: palette.muted, fontSize: 15 },
  error: { color: palette.danger, fontSize: 13 },
  footer: { color: palette.muted, textAlign: 'center', marginTop: space.md },
  link: { color: palette.primary, fontWeight: '700' },
});

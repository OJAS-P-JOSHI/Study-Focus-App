import { Link, router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { Button, Card, Field, Heading, Screen } from '@/components/ui';
import { palette, space } from '@/constants/design';
import { useAuthStore } from '@/stores/auth-store';

const schema = z.object({
  name: z.string().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
});
type Form = z.infer<typeof schema>;

export default function RegisterScreen() {
  const register = useAuthStore((state) => state.register);
  const { control, handleSubmit, setError, formState } = useForm<Form>({
    defaultValues: { name: '', email: '', password: '' },
  });
  const submit = handleSubmit(async (values) => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) =>
        setError(issue.path[0] as keyof Form, { message: issue.message }),
      );
      return;
    }
    try {
      await register(values.name.trim(), values.email.trim(), values.password);
      router.replace('/(tabs)');
    } catch {
      setError('root', { message: 'Account creation failed. Try again when connected.' });
    }
  });
  return (
    <Screen style={styles.screen}>
      <Heading
        eyebrow="Begin gently"
        title="Create your space"
        subtitle="Build a sustainable study rhythm, one session at a time."
      />
      <Card>
        {(['name', 'email', 'password'] as const).map((name) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field, fieldState }) => (
              <Field
                label={name[0].toUpperCase() + name.slice(1)}
                autoCapitalize={name === 'email' ? 'none' : undefined}
                secureTextEntry={name === 'password'}
                keyboardType={name === 'email' ? 'email-address' : 'default'}
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
              />
            )}
          />
        ))}
        {formState.errors.root ? <Text style={styles.error}>{formState.errors.root.message}</Text> : null}
        <Button label="Create account" onPress={submit} loading={formState.isSubmitting} />
      </Card>
      <Text style={styles.footer}>
        Already have an account? <Link href="/(auth)/login" style={styles.link}>Sign in</Link>
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { justifyContent: 'center' },
  error: { color: palette.danger, fontSize: 13 },
  footer: { color: palette.muted, textAlign: 'center', marginTop: space.md },
  link: { color: palette.primary, fontWeight: '700' },
});

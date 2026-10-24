import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Field, LinkText, Row, Screen, T } from '@/components/ui';
import { isConfigured, supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';

// Email sign-in for the first test version. Apple and Google sign-in come with the store accounts.
export default function SignIn() {
  const t = useTheme();
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState<'CA' | 'GB'>('CA');
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  async function submit() {
    setMsg(null);
    if (!email.includes('@') || password.length < 8) { setMsg({ text: 'Enter an email and a password of at least 8 characters.', bad: true }); return; }
    if (mode === 'up' && !adult) { setMsg({ text: 'StudyBuddy is for students aged 17 and over.', bad: true }); return; }
    setBusy(true);
    const res = mode === 'up'
      ? await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim(), age_confirmed: true, country } } })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (res.error) { setMsg({ text: res.error.message, bad: true }); return; }
    if (mode === 'up' && !res.data.session) setMsg({ text: 'Check your email to confirm your account, then sign in.' });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen style={{ paddingTop: 80, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
        <View style={{ gap: space.sm }}>
          <T variant="title">StudyBuddy</T>
          <T muted>Upload your syllabus, and your semester is set up: deadlines, a study plan, a tutor and exam prep.</T>
        </View>
        {!isConfigured && (
          <Card><T variant="small" style={{ color: t.warn }}>The app isn't connected to Supabase yet. Add the two values from README step 3 to app/.env and restart.</T></Card>
        )}
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {(['up', 'in'] as const).map((m) => (
              <Pressable key={m} onPress={() => { setMode(m); setMsg(null); }}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center', backgroundColor: mode === m ? t.surface : 'transparent' }}>
                <T variant="small" style={{ fontWeight: '600' }}>{m === 'up' ? 'Create account' : 'Sign in'}</T>
              </Pressable>
            ))}
          </View>
          {mode === 'up' && <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" />}
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'up' ? 'new-password' : 'current-password'} />
          {mode === 'up' && (
            <>
              <View style={{ gap: space.xs }}>
                <T variant="small" muted>Where do you study?</T>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  {([['CA', 'Canada'], ['GB', 'United Kingdom']] as const).map(([code, label]) => (
                    <Pressable key={code} onPress={() => setCountry(code)}
                      style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: country === code ? t.accent : t.border }}>
                      <T variant="small">{label}</T>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Pressable onPress={() => setAdult(!adult)} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }} accessibilityRole="checkbox" accessibilityState={{ checked: adult }}>
                <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: adult ? t.accent : t.muted, backgroundColor: adult ? t.accent : 'transparent' }} />
                <T variant="small">I'm 17 or older and agree to the Terms and Privacy Policy</T>
              </Pressable>
              <Row><LinkText title="Terms of Use" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} /><LinkText title="Privacy Policy" onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} /></Row>
            </>
          )}
          {msg && <T variant="small" style={{ color: msg.bad ? t.danger : t.good }}>{msg.text}</T>}
          <Button title={mode === 'up' ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} />
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

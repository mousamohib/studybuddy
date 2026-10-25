import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Check, Field, LinkText, Row, Segments, Stickers, T } from '@/components/ui';
import { isConfigured, supabase } from '@/lib/supabase';
import { font, space, useTheme } from '@/lib/theme';

// Email sign-in for the first test version. Apple and Google sign-in come with the store accounts.
export default function SignIn() {
  const t = useTheme();
  const [mode, setMode] = useState<'up' | 'in'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState<'CA' | 'GB'>('CA');
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);

  async function submit() {
    setMsg(null);
    if (!email.includes('@') || password.length < 8) { setMsg({ text: 'Enter your email and a password of at least 8 characters.', bad: true }); return; }
    if (mode === 'up' && !adult) { setMsg({ text: 'Tick the box to confirm you are 17 or older.', bad: true }); return; }
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
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 64, paddingBottom: 48, gap: space.xl, maxWidth: 480, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.lg }}>
          <Stickers size={52} />
          <Text style={{ fontFamily: font.display, fontSize: 46, lineHeight: 48, letterSpacing: -1.8, color: t.text }}>StudyBuddy</Text>
          <T muted style={{ fontSize: 17, lineHeight: 25 }}>Upload your syllabus and your semester sets itself up: deadlines, a daily study plan, a tutor that knows your course, and exam prep.</T>
        </View>

        {!isConfigured && (
          <Card tint={t.warn}><T variant="small">The app isn't connected to Supabase yet. Add the two values from the setup guide to app/.env and restart.</T></Card>
        )}

        <Card style={{ gap: space.lg, padding: space.xl }}>
          <Segments items={[{ key: 'up', label: 'Create account' }, { key: 'in', label: 'Sign in' }]} value={mode} onChange={(m) => { setMode(m); setMsg(null); }} />
          {mode === 'up' && <Field label="First name" value={name} onChangeText={setName} autoComplete="given-name" placeholder="Alex" />}
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@school.ca" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            hint={mode === 'up' ? 'At least 8 characters' : undefined} onSubmitEditing={submit} />
          {mode === 'up' && (
            <>
              <View style={{ gap: 6 }}>
                <T variant="label">Where do you study?</T>
                <Segments items={[{ key: 'CA', label: 'Canada' }, { key: 'GB', label: 'United Kingdom' }]} value={country} onChange={setCountry} />
              </View>
              <Pressable onPress={() => setAdult(!adult)} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                <Check checked={adult} onPress={() => setAdult(!adult)} color={t.accent} size={24} />
                <T variant="small" style={{ flex: 1 }}>I'm 17 or older and agree to the Terms of Use and Privacy Policy</T>
              </Pressable>
              <Row style={{ gap: space.lg }}>
                <LinkText title="Terms of Use" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} />
                <LinkText title="Privacy Policy" onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} />
              </Row>
            </>
          )}
          {msg && <Card tint={msg.bad ? t.danger : t.good} style={{ padding: space.md }}><T variant="small" color={msg.bad ? t.danger : t.good}>{msg.text}</T></Card>}
          <Button title={mode === 'up' ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

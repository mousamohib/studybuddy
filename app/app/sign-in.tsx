import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Check, Field, LinkText, Row, Segments, Stickers, T } from '@/components/ui';
import { isConfigured, supabase } from '@/lib/supabase';
import { font, space, useTheme } from '@/lib/theme';

// Email sign-in. Confirmation and password reset use a 6-digit code from the email, so they work
// in the phone app without links. Apple and Google sign-in come with the store accounts.
type Mode = 'up' | 'in' | 'confirm' | 'forgot' | 'reset';

export default function SignIn() {
  const t = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'in' ? 'in' : 'up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [country, setCountry] = useState<'CA' | 'GB'>('CA');
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const bad = (text: string) => setMsg({ text, bad: true });
  const go = (m: Mode) => { setMode(m); setMsg(null); setCode(''); };

  async function submit() {
    setMsg(null);
    const e = email.trim().toLowerCase();
    if (mode === 'up' || mode === 'in') {
      if (!e.includes('@') || password.length < 8) return bad('Enter your email and a password of at least 8 characters.');
      if (mode === 'up' && !adult) return bad('Tick the box to confirm you are 17 or older.');
      setBusy(true);
      const res = mode === 'up'
        ? await supabase.auth.signUp({ email: e, password, options: { data: { display_name: name.trim(), age_confirmed: true, country } } })
        : await supabase.auth.signInWithPassword({ email: e, password });
      setBusy(false);
      if (res.error) {
        if (/not confirmed/i.test(res.error.message)) { await supabase.auth.resend({ type: 'signup', email: e }); go('confirm'); return; }
        return bad(res.error.message === 'Invalid login credentials' ? 'That email and password don\'t match. Try again or reset your password.' : res.error.message);
      }
      if (mode === 'up' && !res.data.session) go('confirm');
      return;
    }
    if (mode === 'confirm') {
      if (code.trim().length < 6) return bad('Enter the code from the email.');
      setBusy(true);
      const { error } = await supabase.auth.verifyOtp({ email: e, token: code.trim(), type: 'signup' });
      setBusy(false);
      if (error) bad('That code didn\'t work. Check the newest email, or send a new code.');
      return;
    }
    if (mode === 'forgot') {
      if (!e.includes('@')) return bad('Enter the email you signed up with.');
      setBusy(true);
      const { error } = await supabase.auth.resetPasswordForEmail(e);
      setBusy(false);
      if (error) return bad(error.message);
      go('reset');
      return;
    }
    if (mode === 'reset') {
      if (code.trim().length < 6) return bad('Enter the code from the email.');
      if (password.length < 8) return bad('Choose a new password of at least 8 characters.');
      setBusy(true);
      const v = await supabase.auth.verifyOtp({ email: e, token: code.trim(), type: 'recovery' });
      if (v.error) { setBusy(false); return bad('That code didn\'t work. Check the newest email, or send a new code.'); }
      const u = await supabase.auth.updateUser({ password });
      setBusy(false);
      if (u.error) bad(u.error.message);
    }
  }

  async function resend() {
    const e = email.trim().toLowerCase();
    const { error } = mode === 'confirm' ? await supabase.auth.resend({ type: 'signup', email: e }) : await supabase.auth.resetPasswordForEmail(e);
    setMsg(error ? { text: error.message, bad: true } : { text: 'Sent. Check your inbox and spam folder.' });
  }

  const titles: Record<Mode, string> = { up: 'Create account', in: 'Sign in', confirm: 'Confirm your email', forgot: 'Reset your password', reset: 'Choose a new password' };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: 64, paddingBottom: 48, gap: space.xl, maxWidth: 480, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.lg }}>
          {Platform.OS === 'web' && <View style={{ alignSelf: 'flex-start' }}><LinkText title="← Back" color={t.muted} onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} /></View>}
          <Stickers size={52} />
          <Text style={{ fontFamily: font.display, fontSize: 46, lineHeight: 48, letterSpacing: -1.8, color: t.text }}>StudyBuddy</Text>
          {(mode === 'up' || mode === 'in') && <T muted style={{ fontSize: 17, lineHeight: 25 }}>Upload your syllabus and your semester sets itself up: deadlines, a daily study plan, a tutor that knows your course, and exam prep.</T>}
        </View>

        {!isConfigured && (
          <Card tint={t.warn}><T variant="small">The app isn't connected to Supabase yet. Add the two values from the setup guide to app/.env and restart.</T></Card>
        )}

        <View style={{ gap: space.lg }}>
          {mode === 'up' || mode === 'in'
            ? <Segments items={[{ key: 'up', label: 'Create account' }, { key: 'in', label: 'Sign in' }]} value={mode} onChange={(m) => go(m)} />
            : <T variant="title">{titles[mode]}</T>}

          {mode === 'confirm' && <T muted>We sent a 6-digit code to {email.trim()}. Enter it here to finish creating your account.</T>}
          {mode === 'forgot' && <T muted>We'll email you a 6-digit code to set a new password.</T>}
          {mode === 'reset' && <T muted>Enter the code we sent to {email.trim()}, then your new password.</T>}

          {mode === 'up' && <Field label="First name" value={name} onChangeText={setName} autoComplete="given-name" placeholder="Alex" />}
          {(mode === 'up' || mode === 'in' || mode === 'forgot') && (
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@school.ca" />
          )}
          {(mode === 'confirm' || mode === 'reset') && (
            <Field label="Code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" autoComplete="one-time-code" placeholder="123456"
              style={{ fontSize: 24, letterSpacing: 6, fontFamily: font.bold }} />
          )}
          {(mode === 'up' || mode === 'in' || mode === 'reset') && (
            <Field label={mode === 'reset' ? 'New password' : 'Password'} value={password} onChangeText={setPassword} secureTextEntry
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'} hint={mode !== 'in' ? 'At least 8 characters' : undefined} onSubmitEditing={submit} />
          )}
          {mode === 'in' && <View style={{ alignSelf: 'flex-start' }}><LinkText title="Forgot password?" onPress={() => go('forgot')} /></View>}

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
          {msg && <Card tint={msg.bad ? t.danger : t.good}><T variant="small" color={msg.bad ? t.danger : t.good}>{msg.text}</T></Card>}
          <Button title={{ up: 'Create account', in: 'Sign in', confirm: 'Confirm', forgot: 'Send code', reset: 'Save new password' }[mode]} onPress={submit} loading={busy} />
          {(mode === 'confirm' || mode === 'reset') && <Row style={{ gap: space.lg }}><LinkText title="Send a new code" onPress={resend} /><LinkText title="Back" color={t.muted} onPress={() => go('in')} /></Row>}
          {mode === 'forgot' && <LinkText title="Back to sign in" color={t.muted} onPress={() => go('in')} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

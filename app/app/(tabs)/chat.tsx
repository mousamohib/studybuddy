import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { Button, Card, T } from '@/components/ui';
import { AIError, askAI, type Msg } from '@/lib/ai';
import { useAccount } from '@/lib/auth';
import { radius, space, useTheme } from '@/lib/theme';

// Step 1: one test chat to prove the AI gateway, limits and demo mode work end to end.
// Step 4 replaces this with per-course chats, modes, styles and memory.
export default function Chat() {
  const t = useTheme();
  const { usage, limits, refresh } = useAccount();
  const [msgs, setMsgs] = useState<(Msg & { demo?: boolean })[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; upgrade?: boolean } | null>(null);
  const list = useRef<FlatList>(null);

  async function send() {
    const q = text.trim();
    if (!q || busy) return;
    setErr(null); setText('');
    const next = [...msgs, { role: 'user' as const, content: q }];
    setMsgs(next); setBusy(true);
    try {
      const r = await askAI('chat', next.map(({ role, content }) => ({ role, content })),
        'You are StudyBuddy, a friendly tutor for university students. Explain in simple, plain English.');
      setMsgs([...next, { role: 'assistant', content: r.text, demo: r.demo }]);
    } catch (e) {
      const a = e as AIError;
      setErr({ text: a.message, upgrade: a.code === 'limit_reached' });
    } finally {
      setBusy(false); refresh();
      setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList ref={list} data={msgs} keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: space.lg, gap: space.md, flexGrow: 1 }}
        ListEmptyComponent={
          <Card>
            <T variant="heading">Ask StudyBuddy anything</T>
            <T muted>This is a test chat. Course chats with teaching styles arrive in build step 4.</T>
            <T variant="small" muted>{usage.tutor_messages} of {limits.tutor_messages >= 1000 ? 'unlimited' : limits.tutor_messages} messages used this month</T>
          </Card>
        }
        renderItem={({ item }) => item.role === 'user' ? (
          <View style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: t.surface, borderRadius: radius.lg, padding: space.md }}>
            <T>{item.content}</T>
          </View>
        ) : (
          <View style={{ gap: 4 }}>
            <T>{item.content}</T>
            {item.demo ? <T variant="small" muted>Demo answer: real AI is off</T> : null}
          </View>
        )}
        ListFooterComponent={busy ? <T muted>Thinking…</T> : null}
      />
      {err && (
        <View style={{ paddingHorizontal: space.lg, gap: space.sm }}>
          <T variant="small" style={{ color: t.danger }}>{err.text}</T>
          {err.upgrade && <Button title="See Pro" kind="secondary" onPress={() => router.push('/paywall')} />}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md, borderTopWidth: 1, borderColor: t.border }}>
        <TextInput value={text} onChangeText={setText} placeholder="Message StudyBuddy…" placeholderTextColor={t.muted} multiline
          style={{ flex: 1, color: t.text, backgroundColor: t.surface, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10, maxHeight: 140, fontSize: 15 }} />
        <Button title="Send" onPress={send} disabled={!text.trim()} loading={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}

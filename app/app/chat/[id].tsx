import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { Rich } from '@/components/Rich';
import { Button, LinkText, Pill, Row, T } from '@/components/ui';
import { useMenu, useNotice } from '@/components/Menu';
import { ApiError, ERROR_UPGRADE, pickDocuments, pickPhoto, streamTutor, uploadMaterial, waitMaterial, type ChatMessage, type Picked } from '@/lib/api';
import { useAccount } from '@/lib/auth';
import { MODE_LABEL, type ChatRow } from '@/lib/data';
import { RESHAPE_OPTIONS, STYLE_OPTIONS } from '@/lib/styles';
import { supabase } from '@/lib/supabase';
import { radius, space, useTheme } from '@/lib/theme';

const QUICK = [
  { label: 'Next part', text: 'Continue to the next part.' },
  { label: 'Simpler', text: "I didn't get that. Explain it more simply, with a concrete example." },
  { label: 'Practice', text: "Give me a few practice questions on this. Don't show the answers until I reply." },
  { label: 'Summarize', text: 'Summarize what we covered in this chat as short revision notes.' },
  { label: 'What next?', text: 'What should I do next?' },
];

export default function ChatScreen() {
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>();
  const t = useTheme();
  const headerHeight = useHeaderHeight();
  const { refresh } = useAccount();
  const { open, confirm } = useMenu();
  const notice = useNotice();
  const [chat, setChat] = useState<ChatRow | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [live, setLive] = useState<{ index: number; text: string; user?: string } | null>(null);
  const [text, setText] = useState('');
  const [attaching, setAttaching] = useState('');
  const list = useRef<FlatList>(null);
  const abort = useRef<AbortController | null>(null);
  const started = useRef(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('chats').select('*, courses(code)').eq('id', id).maybeSingle();
    if (!data) return;
    setChat(data as ChatRow); setMsgs((data.messages ?? []) as ChatMessage[]); setCode((data as any).courses?.code ?? null);
    return data;
  }, [id]);

  useEffect(() => {
    load().then((d) => {
      if (d && start && !started.current && !(d.messages ?? []).length) { started.current = true; send(start); }
    });
    return () => abort.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const handleError = (e: unknown) => {
    const a = e as ApiError;
    if (a.code === 'cancelled') return;
    if (ERROR_UPGRADE.has(a.code)) open(a.message, [{ label: 'See Pro', onPress: () => router.push('/paywall') }, { label: 'OK' }]);
    else notice('Something went wrong', a.message);
  };

  async function send(q: string, opts: { regenerate?: boolean } = {}) {
    const body = q.trim();
    if ((!body && !opts.regenerate) || live || !chat && !id) return;
    setText('');
    const base = opts.regenerate ? msgs.slice(0, msgs.map((m) => m.role).lastIndexOf('user')) : msgs;
    const userText = opts.regenerate ? msgs[msgs.map((m) => m.role).lastIndexOf('user')]?.content : body;
    setMsgs(base); setLive({ index: base.length, text: '', user: userText });
    abort.current = new AbortController();
    try {
      const r = await streamTutor({ mode: 'chat', chat_id: id, text: body, regenerate: opts.regenerate }, (so) => setLive((l) => l && { ...l, text: so }), abort.current.signal);
      setMsgs([...base, { role: 'user', content: userText ?? '' }, r.message]);
      if (r.title && chat) setChat({ ...chat, title: r.title });
    } catch (e) { setMsgs(base); handleError(e); }
    finally { setLive(null); refresh(); }
  }

  async function reshape(index: number, style: string, keep: boolean) {
    if (live) return;
    setLive({ index, text: '' });
    abort.current = new AbortController();
    try {
      const r = await streamTutor({ mode: 'reshape', chat_id: id, index, style, keep }, (so) => setLive((l) => l && { ...l, text: so }), abort.current.signal);
      setMsgs((m) => m.map((x, i) => (i === index ? r.message : x)));
      if (keep && chat) setChat({ ...chat, modifier: style });
    } catch (e) { handleError(e); }
    finally { setLive(null); refresh(); }
  }

  function messageMenu(m: ChatMessage, index: number) {
    if (m.role !== 'assistant') {
      open(null, [{ label: 'Copy', onPress: () => Clipboard.setStringAsync(m.content) }, { label: 'Cancel' }]);
      return;
    }
    const last = index === msgs.length - 1;
    open('Change this answer', [
      ...RESHAPE_OPTIONS.map((o) => ({ label: o.label, onPress: () => o.key === 'quiz' ? reshape(index, o.key, false) : open(`${o.label}`, [
        { label: 'Just this answer', onPress: () => reshape(index, o.key, false) },
        { label: 'For the rest of this chat', onPress: () => reshape(index, o.key, true) },
        { label: 'Cancel' },
      ]) })),
      ...(m.original ? [{ label: 'Show the original', onPress: () => notice('Original answer', m.original!.slice(0, 1500)) }] : []),
      ...(last ? [{ label: 'Regenerate', onPress: () => send('', { regenerate: true }) }] : []),
      { label: 'Copy (keeps equations as LaTeX)', onPress: () => Clipboard.setStringAsync(m.content) },
      ...(chat?.course_id ? [{ label: 'Revisit this later', onPress: async () => { await supabase.from('memory').insert({ course_id: chat.course_id, kind: 'revisit', text: chat.title, source: 'you' }); notice('Added to your revisit list'); } }] : []),
      { label: 'Report this answer', onPress: () => report(m) },
      { label: 'Cancel' },
    ]);
  }

  function report(m: ChatMessage) {
    open('Report this answer', ['Wrong or misleading', 'Harmful or offensive', 'Did my graded work for me', 'Something else'].map((reason) => ({
      label: reason, onPress: async () => { await supabase.from('reports').insert({ chat_id: id, excerpt: m.content.slice(0, 2000), reason }); notice('Thanks', "We've recorded your report."); },
    })).concat([{ label: 'Cancel', onPress: async () => {} }]));
  }

  function chatMenu() {
    if (!chat) return;
    open(chat.title, [
      { label: `Teaching style: ${STYLE_OPTIONS.find((s) => s.key === chat.style)?.name ?? 'course default'}`, onPress: styleMenu },
      ...(chat.modifier ? [{ label: 'Clear "rest of chat" style change', onPress: async () => { await supabase.from('chats').update({ modifier: null }).eq('id', id); setChat({ ...chat, modifier: null }); } }] : []),
      { label: `Files in this chat (${chat.material_ids.length})`, onPress: filesMenu },
      { label: 'Delete chat', destructive: true, onPress: async () => { if (await confirm('Delete this chat?', 'This cannot be undone.', 'Delete')) { await supabase.from('chats').delete().eq('id', id); router.back(); } } },
      { label: 'Cancel' },
    ]);
  }

  function styleMenu() {
    open('Teaching style for this chat', [{ key: '', name: 'Course default' }, ...STYLE_OPTIONS].map((s) => ({
      label: s.name, onPress: async () => { await supabase.from('chats').update({ style: s.key || null }).eq('id', id); setChat((c) => c && { ...c, style: s.key || null }); },
    })));
  }

  async function filesMenu() {
    if (!chat?.course_id) { notice('Files', 'General chats have no course files. Start a chat from a course to use its files.'); return; }
    const { data } = await supabase.from('materials').select('id, file_name, deadline_id').eq('course_id', chat.course_id).eq('status', 'ready');
    const ids = new Set(chat.material_ids);
    open('Tap a file to include or leave it out', (data ?? []).map((m) => ({
      label: `${ids.has(m.id) ? '✓ ' : '   '}${m.file_name}`,
      onPress: async () => {
        const next = ids.has(m.id) ? chat.material_ids.filter((x) => x !== m.id) : [...chat.material_ids, m.id];
        await supabase.from('chats').update({ material_ids: next }).eq('id', id); setChat({ ...chat, material_ids: next });
      },
    })).concat([{ label: 'Done', onPress: async () => {} }]));
  }

  async function attach(get: () => Promise<Picked[]>) {
    if (!chat?.course_id) { notice('Attach files from a course chat', 'Files belong to a course. Start this chat from a course to attach files.'); return; }
    let picked: Picked[];
    try { picked = await get(); } catch (e) { notice((e as ApiError).message); return; }
    const added: string[] = [];
    for (const p of picked) {
      setAttaching(`Reading ${p.name}…`);
      try { const mid = await uploadMaterial(chat.course_id, p, chat.mode === 'assignment' ? chat.deadline_id : null); await waitMaterial(mid); added.push(mid); }
      catch (e) { handleError(e); }
    }
    setAttaching('');
    if (added.length) {
      const next = [...new Set([...chat.material_ids, ...added])];
      await supabase.from('chats').update({ material_ids: next }).eq('id', id); setChat({ ...chat, material_ids: next });
      notice('Attached', `Saved to ${code}${chat.mode === 'assignment' ? "'s assignment files" : "'s study material"} and added to this chat.`);
    }
    refresh();
  }

  const items: (ChatMessage & { live?: boolean })[] = live
    ? [...msgs.slice(0, live.index), ...(live.user !== undefined ? [{ role: 'user' as const, content: live.user }] : []), { role: 'assistant' as const, content: live.text, live: true }, ...(live.user === undefined ? msgs.slice(live.index + 1) : [])]
    : msgs;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
      <Stack.Screen options={{ title: chat?.title ?? 'Chat', headerRight: () => <LinkText title="•••" onPress={chatMenu} /> }} />
      <FlatList ref={list} data={items} keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => live?.user !== undefined && list.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ padding: space.lg, gap: space.lg, flexGrow: 1 }}
        ListHeaderComponent={chat ? (
          <Row>
            {code ? <Pill label={code} /> : <Pill label="General" />}
            <Pill label={MODE_LABEL[chat.mode]} />
            {chat.style ? <Pill label={STYLE_OPTIONS.find((s) => s.key === chat.style)?.name ?? chat.style} /> : null}
            {chat.modifier ? <Pill label={RESHAPE_OPTIONS.find((r) => r.key === chat.modifier)?.label ?? chat.modifier} color={t.accent} /> : null}
          </Row>
        ) : null}
        ListEmptyComponent={chat ? <T muted>{code ? `Ask anything about ${code}. The tutor sees your rules, this course's memory, deadlines, today's plan and ${chat.material_ids.length} file${chat.material_ids.length === 1 ? '' : 's'}.` : 'Ask anything.'}</T> : <ActivityIndicator />}
        renderItem={({ item, index }) => item.role === 'user' ? (
          <Pressable onLongPress={() => messageMenu(item, index)} style={{ alignSelf: 'flex-end', maxWidth: '88%', backgroundColor: t.surface, borderRadius: radius.lg, padding: space.md }}>
            <T>{item.content}</T>
          </Pressable>
        ) : (
          <Pressable onPress={() => !item.live && messageMenu(item, index)} style={{ gap: 6 }} accessibilityHint="Opens options to change this answer">
            {item.live && !item.content ? <Row><ActivityIndicator size="small" /><T muted>Thinking…</T></Row> : <Rich text={item.content} />}
            {item.saved?.map((s: string) => <Pill key={s} label={s.startsWith('Revisit') ? s : `Remembered: ${s}`} />)}
            {item.shape ? <T variant="small" muted>Rewritten: {RESHAPE_OPTIONS.find((r) => r.key === item.shape)?.label}</T> : null}
            {item.interrupted ? <T variant="small" style={{ color: t.warn }}>This answer was cut off.</T> : null}
            {!item.live && <T variant="small" muted>Tap to make it simpler, more detailed, more mathematical…</T>}
          </Pressable>
        )}
      />
      {attaching ? <Row style={{ paddingHorizontal: space.lg }}><ActivityIndicator size="small" /><T variant="small" muted>{attaching}</T></Row> : null}
      {msgs.length > 0 && !live && (
        <View style={{ paddingHorizontal: space.md }}>
          <FlatList horizontal data={QUICK} keyExtractor={(q) => q.label} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => send(item.text)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: t.border }}>
                <T variant="small">{item.label}</T>
              </Pressable>
            )} />
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: space.sm, padding: space.md, borderTopWidth: 1, borderColor: t.border, alignItems: 'flex-end' }}>
        <Pressable accessibilityLabel="Attach files" onPress={() => open('Attach to this chat', [
          { label: 'Files', onPress: () => attach(pickDocuments) }, { label: 'Photos', onPress: () => attach(() => pickPhoto(false)) },
          { label: 'Take a photo', onPress: () => attach(() => pickPhoto(true)) }, { label: 'Cancel' }])}
          style={{ width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ fontSize: 20, color: t.muted }}>+</T>
        </Pressable>
        <TextInput value={text} onChangeText={setText} placeholder="Message StudyBuddy…" placeholderTextColor={t.muted} multiline
          style={{ flex: 1, color: t.text, backgroundColor: t.surface, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 10, maxHeight: 160, fontSize: 15 }} />
        {live ? <Button title="Stop" kind="secondary" onPress={() => abort.current?.abort()} /> : <Button title="Send" onPress={() => send(text)} disabled={!text.trim()} />}
      </View>
    </KeyboardAvoidingView>
  );
}

import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { Rich } from '@/components/Rich';
import { LogoMark } from '@/components/Logo';
import { CourseTag, haptic, Icon, IconButton, ic, Pill, Pressy, Row, T, type IconName } from '@/components/ui';
import { useMenu, useNotice } from '@/components/Menu';
import { ApiError, ERROR_UPGRADE, pickDocuments, pickPhoto, streamTutor, uploadMaterial, waitMaterial, type ChatMessage, type Picked } from '@/lib/api';
import { useAccount } from '@/lib/auth';
import { courseColour, MODE_LABEL, type ChatRow, type Course } from '@/lib/data';
import { RESHAPE_OPTIONS, STYLE_OPTIONS } from '@/lib/styles';
import { supabase } from '@/lib/supabase';
import { font, ink, radius, space, tint, useTheme } from '@/lib/theme';

function Dots({ color }: { color: string }) {
  return <Row style={{ gap: 5, paddingVertical: 6 }}>{[0, 1, 2].map((i) => <Dot key={i} i={i} color={color} />)}</Row>;
}
function Dot({ i, color }: { i: number; color: string }) {
  const y = useSharedValue(0);
  useEffect(() => { y.value = withDelay(i * 140, withRepeat(withSequence(withTiming(-5, { duration: 260 }), withTiming(0, { duration: 260 })), -1)); }, [i, y]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, a]} />;
}

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressy onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: t.surface }}>
      <Icon name={icon} size={15} color={t.muted} />
      <Text style={{ color: t.muted, fontFamily: font.semi, fontSize: 13 }}>{label}</Text>
    </Pressy>
  );
}

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
  const [courseCol, setCourseCol] = useState<string | null>(null);
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
    if (data.course_id) {
      const { data: cs } = await supabase.from('courses').select('*').order('created_at');
      const i = (cs ?? []).findIndex((c) => c.id === data.course_id);
      if (i >= 0) setCourseCol(courseColour(cs![i] as Course, i));
    }
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

  const accent = courseCol ?? t.accent;
  const items: (ChatMessage & { live?: boolean })[] = live
    ? [...msgs.slice(0, live.index), ...(live.user !== undefined ? [{ role: 'user' as const, content: live.user }] : []), { role: 'assistant' as const, content: live.text, live: true }, ...(live.user === undefined ? msgs.slice(live.index + 1) : [])]
    : msgs;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={headerHeight}>
      <Stack.Screen options={{ title: chat?.title ?? 'Chat', headerRight: () => <IconButton icon={ic('ellipsis', 'more_horiz')} label="Chat options" size={36} onPress={chatMenu} /> }} />
      <FlatList ref={list} data={items} keyExtractor={(_, i) => String(i)}
        onContentSizeChange={() => live?.user !== undefined && list.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ padding: space.lg, gap: space.lg, flexGrow: 1, width: '100%', maxWidth: 820, alignSelf: 'center' }}
        ListHeaderComponent={chat ? (
          <Row>
            {code ? <CourseTag code={code} color={accent} /> : <Pill label="General" />}
            <Pill label={MODE_LABEL[chat.mode]} color={accent} />
            {chat.style ? <Pill label={STYLE_OPTIONS.find((s) => s.key === chat.style)?.name ?? chat.style} /> : null}
            {chat.modifier ? <Pill label={RESHAPE_OPTIONS.find((r) => r.key === chat.modifier)?.label ?? chat.modifier} color={t.accent} /> : null}
          </Row>
        ) : null}
        ListEmptyComponent={chat ? (
          <View style={{ gap: space.md, paddingTop: space.xl }}>
            <T variant="title">{code ? `Ask me anything about ${code}` : 'Ask me anything'}</T>
            <T muted>{code ? `I know your course rules, deadlines, today's plan and ${chat.material_ids.length} of your file${chat.material_ids.length === 1 ? '' : 's'}.` : 'For course-specific help, start a chat from a course.'}</T>
            <View style={{ gap: 8 }}>
              {['Explain the main idea of this topic simply', 'Quiz me with 3 questions', 'What should I study first?'].map((q) => (
                <Pressy key={q} onPress={() => send(q)} style={{ padding: space.md, borderRadius: radius.md, backgroundColor: tint(accent, t.dark ? 0.16 : 0.08) }}>
                  <T variant="label" color={ink(accent, t)}>{q}</T>
                </Pressy>
              ))}
            </View>
          </View>
        ) : <ActivityIndicator />}
        renderItem={({ item, index }) => item.role === 'user' ? (
          <Animated.View entering={FadeInDown.duration(220)} style={{ alignSelf: 'flex-end', maxWidth: '86%' }}>
            <Pressable onLongPress={() => messageMenu(item, index)}
              style={{ backgroundColor: accent, borderRadius: 20, borderBottomRightRadius: 6, paddingVertical: 11, paddingHorizontal: 15 }}>
              <Text style={{ color: '#FFFFFF', fontFamily: font.medium, fontSize: 16, lineHeight: 22 }}>{item.content}</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <View style={{ gap: 8 }}>
            <Row style={{ gap: 8 }}>
              <LogoMark size={30} />
              <T variant="label" muted>Scrawlie{item.shape ? ` · rewritten: ${RESHAPE_OPTIONS.find((r) => r.key === item.shape)?.label.toLowerCase()}` : ''}</T>
            </Row>
            <View style={{ paddingLeft: 34 }}>
              {item.live && !item.content ? <Dots color={accent} /> : <Rich text={item.content} fontSize={16} />}
            </View>
            {item.saved?.map((s: string) => <View key={s} style={{ paddingLeft: 34 }}><Pill label={s.startsWith('Revisit') ? s : `Remembered: ${s}`} color={t.good} /></View>)}
            {item.interrupted ? <T variant="small" color={t.warn}>This answer was cut off.</T> : null}
            {!item.live && (
              <Row style={{ gap: 6, paddingLeft: 34 }}>
                <Action icon={ic('wand.and.stars', 'auto_fix_high')} label="Change it" onPress={() => messageMenu(item, index)} />
                <Action icon={ic('doc.on.doc', 'content_copy')} label="Copy" onPress={() => { Clipboard.setStringAsync(item.content); haptic.success(); }} />
                {index === msgs.length - 1 && <Action icon={ic('arrow.clockwise', 'refresh')} label="Again" onPress={() => send('', { regenerate: true })} />}
              </Row>
            )}
          </View>
        )}
      />
      {attaching ? <Row style={{ paddingHorizontal: space.lg }}><ActivityIndicator size="small" /><T variant="small" muted>{attaching}</T></Row> : null}
      {msgs.length > 0 && !live && (
        <View style={{ paddingHorizontal: space.md, width: '100%', maxWidth: 820, alignSelf: 'center' }}>
          <FlatList horizontal data={QUICK} keyExtractor={(q) => q.label} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
            renderItem={({ item }) => (
              <Pressy onPress={() => send(item.text)} style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: tint(accent, t.dark ? 0.2 : 0.1) }}>
                <Text style={{ color: ink(accent, t), fontFamily: font.semi, fontSize: 14 }}>{item.label}</Text>
              </Pressy>
            )} />
        </View>
      )}
      <View style={{ padding: space.md, paddingBottom: Platform.OS === 'ios' ? space.xl : space.md, width: '100%', maxWidth: 820, alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end', backgroundColor: t.surface, borderRadius: 26, padding: 5 }}>
          <IconButton icon={ic('plus', 'add')} label="Attach files" size={42} bg={t.bg} color={t.muted} onPress={() => open('Attach to this chat', [
            { label: 'Files', onPress: () => attach(pickDocuments) }, { label: 'Photos', onPress: () => attach(() => pickPhoto(false)) },
            { label: 'Take a photo', onPress: () => attach(() => pickPhoto(true)) }, { label: 'Cancel' }])} />
          <TextInput value={text} onChangeText={setText} placeholder={code ? `Ask about ${code}…` : 'Ask anything…'} placeholderTextColor={t.muted} multiline
            style={{ flex: 1, color: t.text, paddingHorizontal: 6, paddingVertical: 10, maxHeight: 160, fontSize: 16, fontFamily: font.body, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : {}) }} />
          {live
            ? <IconButton icon={ic('stop.fill', 'stop')} label="Stop" size={42} bg={t.text} color={t.bg} onPress={() => abort.current?.abort()} />
            : <IconButton icon={ic('arrow.up', 'arrow_upward')} label="Send" size={42} bg={text.trim() ? accent : t.bg} color={text.trim() ? '#FFFFFF' : t.muted} onPress={() => send(text)} />}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

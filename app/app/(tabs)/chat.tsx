import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, TextInput, View, Platform } from 'react-native';
import { CourseTag, Icon, IconButton, ic, ListRow, Pressy, Row, Screen, Segments, Stickers, T } from '@/components/ui';
import { useNotice } from '@/components/Menu';
import { openNewChat } from '@/lib/chats';
import { courseColour, MODE_LABEL, type ChatMode, type ChatRow, type Course } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { font, ink, radius, space, tint, useTheme } from '@/lib/theme';

const MODE_ICON: Record<ChatMode, { ios: string; material: string }> = {
  ask: { ios: 'questionmark.bubble.fill', material: 'help' },
  lesson: { ios: 'graduationcap.fill', material: 'school' },
  practice: { ios: 'pencil.and.list.clipboard', material: 'quiz' },
  coding: { ios: 'chevron.left.forwardslash.chevron.right', material: 'code' },
  assignment: { ios: 'doc.text.fill', material: 'assignment' },
};

function when(iso: string) {
  const d = new Date(iso), now = new Date();
  const days = Math.floor((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  return days <= 0 ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : days === 1 ? 'Yesterday' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ChatTab() {
  const t = useTheme();
  const notice = useNotice();
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [q, setQ] = useState('');

  useFocusEffect(useCallback(() => {
    Promise.all([
      supabase.from('chats').select('id, course_id, mode, title, style, modifier, material_ids, deadline_id, updated_at').order('updated_at', { ascending: false }).limit(100),
      supabase.from('courses').select('*').order('created_at'),
    ]).then(([a, b]) => { setChats((a.data ?? []) as ChatRow[]); setCourses((b.data ?? []) as Course[]); });
  }, []));

  const shown = chats.filter((c) => filter === 'all' || (filter === 'general' ? !c.course_id : c.course_id === filter));
  const course = (id: string | null) => courses.find((c) => c.id === id);
  const colOf = (id: string | null) => { const i = courses.findIndex((c) => c.id === id); return i >= 0 ? courseColour(courses[i], i) : t.accent; };
  const sel = filter !== 'all' && filter !== 'general' ? course(filter) : undefined;
  const accent = sel ? colOf(sel.id) : t.accent;

  async function ask() {
    if (!q.trim()) return;
    try { await openNewChat({ courseId: sel?.id ?? null, mode: 'ask', topic: q, courseCode: sel?.code }); setQ(''); }
    catch (e) { notice("Couldn't start the chat", (e as Error).message); }
  }

  return (
    <Screen>
      <T variant="display">Tutor</T>
      <View style={{ marginHorizontal: -space.lg, paddingHorizontal: space.lg }}>
        <Segments value={filter} onChange={setFilter}
          items={[{ key: 'all', label: 'All' }, ...courses.map((c, i) => ({ key: c.id, label: c.code, color: courseColour(c, i) })), { key: 'general', label: 'General' }]} />
      </View>

      <View style={{ backgroundColor: accent, borderRadius: radius.xl, padding: space.lg, gap: space.md, overflow: 'hidden' }}>
        {Platform.OS !== 'web' && <View style={{ position: 'absolute', right: -30, top: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.12)' }} />}
        <Text style={{ color: '#fff', fontFamily: font.heading, fontSize: 22 }}>{sel ? `Stuck on something in ${sel.code}?` : 'What are you stuck on?'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, backgroundColor: t.bg, borderRadius: 22, padding: 5 }}>
          <TextInput value={q} onChangeText={setQ} placeholder={sel ? `Ask about ${sel.code}…` : 'Ask anything…'} placeholderTextColor={t.muted} multiline onSubmitEditing={ask}
            style={{ flex: 1, color: t.text, paddingHorizontal: 12, paddingVertical: 10, maxHeight: 120, fontSize: 16, fontFamily: font.body, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : {}) }} />
          <IconButton icon={ic('arrow.up', 'arrow_upward')} label="Ask" size={42} bg={q.trim() ? accent : t.surface} color={q.trim() ? '#FFFFFF' : t.muted} onPress={ask} />
        </View>
        {sel && (
          <Pressy onPress={() => router.push({ pathname: '/course/[id]', params: { id: sel.id, section: 'chats' } })} style={{ alignSelf: 'flex-start' }}>
            <Text style={{ color: '#fff', fontFamily: font.semi, fontSize: 14, textDecorationLine: 'underline' }}>Lessons, practice sets and assignment help</Text>
          </Pressy>
        )}
      </View>

      {shown.length === 0 && (
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
          <Stickers size={40} />
          <T muted style={{ textAlign: 'center', maxWidth: 300 }}>No chats yet. Ask above, or tap play on a session in your plan to start a lesson.</T>
        </View>
      )}
      <View>
        {shown.map((ch, i) => {
          const c = course(ch.course_id), col = colOf(ch.course_id), mi = MODE_ICON[ch.mode];
          return (
            <ListRow key={ch.id} last={i === shown.length - 1} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: ch.id } })}>
              <Icon name={ic(mi.ios, mi.material)} size={22} color={ink(col, t)} />
              <View style={{ flex: 1, gap: 4 }}>
                <T variant="strong" numberOfLines={1}>{ch.title}</T>
                <Row style={{ gap: 6 }}>
                  {c ? <CourseTag code={c.code} color={col} /> : null}
                  <T variant="small" muted>{MODE_LABEL[ch.mode]} · {when(ch.updated_at)}</T>
                </Row>
              </View>
              <Icon name={ic('chevron.right', 'chevron_right')} size={18} color={t.muted} />
            </ListRow>
          );
        })}
      </View>
    </Screen>
  );
}

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Field, Pill, Row, Screen, T } from '@/components/ui';
import { useNotice } from '@/components/Menu';
import { openNewChat } from '@/lib/chats';
import { courseColour, MODE_LABEL, type ChatRow, type Course } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';

export default function ChatTab() {
  const t = useTheme();
  const notice = useNotice();
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [filter, setFilter] = useState<string | 'all' | 'general'>('all');
  const [q, setQ] = useState('');

  useFocusEffect(useCallback(() => {
    Promise.all([
      supabase.from('chats').select('id, course_id, mode, title, style, modifier, material_ids, deadline_id, updated_at').order('updated_at', { ascending: false }).limit(100),
      supabase.from('courses').select('*').order('created_at'),
    ]).then(([a, b]) => { setChats((a.data ?? []) as ChatRow[]); setCourses((b.data ?? []) as Course[]); });
  }, []));

  const shown = chats.filter((c) => filter === 'all' || (filter === 'general' ? !c.course_id : c.course_id === filter));
  const course = (id: string | null) => courses.find((c) => c.id === id);

  async function ask() {
    if (!q.trim()) return;
    const c = filter !== 'all' && filter !== 'general' ? course(filter) : undefined;
    try { await openNewChat({ courseId: c?.id ?? null, mode: 'ask', topic: q, courseCode: c?.code }); setQ(''); }
    catch (e) { notice("Couldn't start the chat", (e as Error).message); }
  }

  return (
    <Screen>
      <T variant="title">Chats</T>
      <Row>
        {[{ id: 'all', label: 'All' }, ...courses.map((c) => ({ id: c.id, label: c.code })), { id: 'general', label: 'General' }].map((f) => (
          <Pressable key={f.id} onPress={() => setFilter(f.id)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: filter === f.id ? t.text : t.surface }}>
            <T variant="small" style={{ color: filter === f.id ? t.bg : t.text, fontWeight: '600' }}>{f.label}</T>
          </Pressable>
        ))}
      </Row>
      <Card style={{ gap: space.sm }}>
        <Field placeholder={filter !== 'all' && filter !== 'general' ? `Ask about ${course(filter)?.code}…` : 'Ask anything…'} value={q} onChangeText={setQ} multiline />
        <Row><Button title="Ask" onPress={ask} disabled={!q.trim()} />
          {filter !== 'all' && filter !== 'general' && <Button title="More chat types" kind="ghost" onPress={() => router.push({ pathname: '/course/[id]', params: { id: filter, section: 'chats' } })} />}
        </Row>
      </Card>
      {shown.length === 0 && <T muted>No chats yet. Lessons, practice sets and assignment help start from a course, or from Start on a planned session.</T>}
      {shown.map((ch) => {
        const c = course(ch.course_id), i = courses.findIndex((x) => x.id === ch.course_id);
        return (
          <Pressable key={ch.id} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: ch.id } })}>
            <Card style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ width: 4, borderRadius: 2, backgroundColor: c ? courseColour(c, i) : t.border }} />
              <View style={{ flex: 1, gap: 4 }}>
                <T style={{ fontWeight: '600' }}>{ch.title}</T>
                <Row><Pill label={c?.code ?? 'General'} /><Pill label={MODE_LABEL[ch.mode]} /><T variant="small" muted>{new Date(ch.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</T></Row>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

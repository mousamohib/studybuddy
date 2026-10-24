import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Field, Row, T } from '@/components/ui';
import { useMenu, useNotice } from '@/components/Menu';
import { STYLE_OPTIONS } from '@/lib/styles';
import { COURSE_COLOURS } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';
import type { CourseData } from './useCourse';

export function Settings({ data }: { data: CourseData }) {
  const t = useTheme();
  const { confirm } = useMenu();
  const notice = useNotice();
  const c = data.course!;
  const [f, setF] = useState({ code: c.code, name: c.name ?? '', rules: c.rules ?? '', ai_policy: c.ai_policy ?? '', teaching_style: c.teaching_style ?? '', colour: c.colour ?? '' });
  useEffect(() => { setF({ code: c.code, name: c.name ?? '', rules: c.rules ?? '', ai_policy: c.ai_policy ?? '', teaching_style: c.teaching_style ?? '', colour: c.colour ?? '' }); }, [c.id]);

  async function save() {
    const { error } = await supabase.from('courses').update({ code: f.code.trim().toUpperCase() || c.code, name: f.name.trim() || null, rules: f.rules.trim() || null, ai_policy: f.ai_policy.trim() || null, teaching_style: f.teaching_style || null, colour: f.colour || null }).eq('id', c.id);
    if (error) notice("Couldn't save", error.message); else { notice('Saved'); data.reload(); }
  }
  async function del() {
    if (!(await confirm(`Delete ${c.code}?`, 'This deletes its files, deadlines, chats, sheets and papers. It cannot be undone.', 'Delete course'))) return;
    const { data: mats } = await supabase.from('materials').select('storage_path').eq('course_id', c.id);
    const paths = (mats ?? []).map((m) => m.storage_path).filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from('materials').remove(paths);
    await supabase.from('courses').delete().eq('id', c.id);
    router.back();
  }

  return (
    <View style={{ gap: space.md }}>
      <Card style={{ gap: space.md }}>
        <Field label="Course code" value={f.code} onChangeText={(v) => setF({ ...f, code: v })} autoCapitalize="characters" />
        <Field label="Course name" value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
        <View style={{ gap: 6 }}>
          <T variant="small" muted>Colour</T>
          <Row>{COURSE_COLOURS.map((col) => (
            <Pressable key={col} onPress={() => setF({ ...f, colour: col })} accessibilityLabel={`Colour ${col}`}
              style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: col, borderWidth: f.colour === col ? 3 : 0, borderColor: t.text }} />
          ))}</Row>
        </View>
        <View style={{ gap: 6 }}>
          <T variant="small" muted>Teaching style for this course</T>
          <Row>
            {[{ key: '', name: 'Use my default' }, ...STYLE_OPTIONS].map((s) => (
              <Pressable key={s.key} onPress={() => setF({ ...f, teaching_style: s.key })} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: f.teaching_style === s.key ? t.accent : t.border }}>
                <T variant="small">{s.name}</T>
              </Pressable>
            ))}
          </Row>
        </View>
        <Field label="Course rules for the tutor" placeholder="e.g. Closed book, no calculator. Derivations are examined. Use the prof's notation." value={f.rules} onChangeText={(v) => setF({ ...f, rules: v })} multiline style={{ minHeight: 90, textAlignVertical: 'top' }} />
        <Field label="AI policy from the syllabus" placeholder="e.g. AI allowed for learning, not for graded code" value={f.ai_policy} onChangeText={(v) => setF({ ...f, ai_policy: v })} multiline />
        <Button title="Save" onPress={save} />
      </Card>
      <Button title="Delete course" kind="danger" onPress={del} />
    </View>
  );
}

// Type-ahead for universities and colleges in Canada and the UK. Any name can still be typed in.
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Field, Icon, ic } from '@/components/ui';
import { font, radius, space, useTheme } from '@/lib/theme';
import SCHOOLS from '@/lib/schools.json';

type School = { n: string; c: 'CA' | 'GB'; a?: string };
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const INDEX = (SCHOOLS as School[]).map((s) => ({ ...s, key: norm(s.n), alias: norm(s.a ?? '') }));

export function searchSchools(q: string, country?: 'CA' | 'GB', limit = 6) {
  const nq = norm(q);
  if (nq.length < 2) return [];
  const words = nq.split(' ');
  const scored: { s: School; score: number }[] = [];
  for (const s of INDEX) {
    let score = 0;
    if (s.alias && s.alias.split(' ').some((a) => a === nq)) score = 100;
    else if (s.key.startsWith(nq)) score = 80;
    else if (s.key.split(' ').some((w) => w.startsWith(nq))) score = 60;
    else if (words.every((w) => s.key.includes(w) || s.alias.includes(w))) score = 40;
    if (!score) continue;
    if (country && s.c === country) score += 15;
    scored.push({ s, score: score - s.n.length / 100 });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.s);
}

export function SchoolPicker({ value, onChange, country, label = 'University or college' }: { value: string; onChange: (v: string) => void; country?: 'CA' | 'GB'; label?: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const results = useMemo(() => searchSchools(value, country), [value, country]);
  const exact = results.some((r) => r.n === value);
  return (
    <View style={{ gap: 6, zIndex: 10 }}>
      <Field label={label} placeholder="Start typing, e.g. McGill" value={value} autoCorrect={false}
        onChangeText={(v) => { onChange(v); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && results.length > 0 && !exact && (
        <View style={{ backgroundColor: t.surface, borderRadius: radius.md, overflow: 'hidden' }}>
          {results.map((r, i) => (
            <Pressable key={r.n} onPress={() => { onChange(r.n); setOpen(false); }}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
                flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.md,
                borderTopWidth: i ? 1 : 0, borderColor: t.bg, backgroundColor: pressed || hovered ? t.accentSoft : 'transparent',
              })}>
              <Icon name={ic('building.columns.fill', 'account_balance')} size={18} color={t.accent} />
              <Text style={{ flex: 1, color: t.text, fontFamily: font.medium, fontSize: 15 }}>{r.n}</Text>
              <Text style={{ color: t.muted, fontFamily: font.semi, fontSize: 12 }}>{r.c === 'CA' ? 'Canada' : 'UK'}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

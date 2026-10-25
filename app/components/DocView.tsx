import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Rich } from './Rich';
import { LinkText, T } from './ui';
import { radius, space, useTheme, tint } from '@/lib/theme';

/** A sheet, or a practice paper with each answer folded under its question. */
export function DocView({ kind, body }: { kind: string; body: string }) {
  const t = useTheme();
  const [openAll, setOpenAll] = useState(false);
  const [opened, setOpened] = useState<Set<number>>(new Set());
  if (kind !== 'paper') return <Rich text={body} />;

  const chunks = body.split(/^[ \t]*=+[ \t]*ANSWER[ \t]*=+[ \t]*$/im);
  const parts: { q: string; a?: string }[] = [{ q: chunks[0] }];
  for (let i = 1; i < chunks.length; i++) {
    const [a, ...rest] = chunks[i].split(/^[ \t]*=+[ \t]*END ANSWER[ \t]*=+[ \t]*$/im);
    parts[parts.length - 1].a = a;
    parts.push({ q: rest.join('\n') });
  }
  const toggle = (i: number) => setOpened((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T variant="small" muted>Try each question first, then open its answer.</T>
        <LinkText title={openAll ? 'Hide all answers' : 'Show all answers'} onPress={() => setOpenAll(!openAll)} />
      </View>
      {parts.map((p, i) => (
        <View key={i} style={{ gap: space.sm }}>
          {p.q.trim() ? <Rich text={p.q} /> : null}
          {p.a !== undefined && (
            <View style={{ backgroundColor: tint(t.good, t.dark ? 0.12 : 0.07), borderRadius: radius.md, overflow: 'hidden' }}>
              <Pressable onPress={() => toggle(i)} style={{ padding: space.md }} accessibilityRole="button">
                <T style={{ color: t.good, fontWeight: '600' }}>{openAll || opened.has(i) ? 'Hide answer' : 'Show answer'}</T>
              </Pressable>
              {(openAll || opened.has(i)) && <View style={{ paddingHorizontal: space.md, paddingBottom: space.md }}><Rich text={p.a} /></View>}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

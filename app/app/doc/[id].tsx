import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DocView } from '@/components/DocView';
import { Button, Card, IconButton, ic, Pill, Row, Screen, T } from '@/components/ui';
import { useMenu, useNotice } from '@/components/Menu';
import type { Doc } from '@/lib/data';
import { downloadMarkdown, downloadPdf, shareLink, stopSharing } from '@/lib/export';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/lib/theme';

const KIND: Record<Doc['kind'], string> = { weekly_sheet: 'Revision sheet', exam_sheet: 'Exam cheat sheet', derivation_sheet: 'Derivation sheet', paper: 'Practice paper' };

export default function DocScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { open, confirm } = useMenu();
  const notice = useNotice();
  const [doc, setDoc] = useState<(Doc & { courses: { code: string } | null }) | null>(null);

  useEffect(() => { supabase.from('documents').select('*, courses(code)').eq('id', id).maybeSingle().then(({ data }) => setDoc(data as any)); }, [id]);
  if (!doc) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;

  const title = doc.title ?? KIND[doc.kind];
  const subtitle = `${doc.courses?.code ?? ''} · ${KIND[doc.kind]} · made ${new Date(doc.created_at).toLocaleDateString()}`;

  async function pdf() { try { const m = await downloadPdf(title, subtitle, doc!.body ?? ''); if (m) notice('Downloaded', m); } catch (e) { notice("Couldn't make the PDF", (e as Error).message); } }
  async function share() {
    const url = await shareLink(doc!.id, doc!.share_token, title).catch(() => null);
    if (!url) { notice('Share links need the website', "They work once the Scrawlie website is live. For now, share the PDF instead."); return; }
    setDoc({ ...doc!, share_token: url.split('/').pop()! });
  }

  function menu() {
    open(title, [
      { label: 'Download PDF', onPress: pdf },
      { label: 'Download Markdown (for Notion, Obsidian…)', onPress: () => downloadMarkdown(title, doc!.body ?? '') },
      { label: 'Copy all (equations as LaTeX)', onPress: async () => { await Clipboard.setStringAsync(doc!.body ?? ''); notice('Copied'); } },
      { label: doc!.share_token ? 'Share link again' : 'Share by link', onPress: share },
      ...(doc!.share_token ? [{ label: 'Stop sharing', onPress: async () => { await stopSharing(doc!.id); setDoc({ ...doc!, share_token: null }); notice('Link turned off'); } }] : []),
      { label: 'Report a problem', onPress: async () => { await supabase.from('reports').insert({ document_id: doc!.id, excerpt: (doc!.body ?? '').slice(0, 500), reason: 'document' }); notice('Thanks', "We've recorded your report."); } },
      { label: 'Delete', destructive: true, onPress: async () => { if (await confirm(`Delete ${title}?`, 'This cannot be undone.', 'Delete')) { await supabase.from('documents').delete().eq('id', doc!.id); router.back(); } } },
      { label: 'Cancel' },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: KIND[doc.kind], headerRight: () => <IconButton icon={ic('ellipsis', 'more_horiz')} label="More" size={36} onPress={menu} /> }} />
      <View style={{ gap: 4 }}>
        <T variant="title">{title}</T>
        <Row>{doc.courses?.code ? <Pill label={doc.courses.code} color={t.accent} /> : null}<T variant="small" muted>{new Date(doc.created_at).toLocaleDateString()}</T>{doc.share_token ? <Pill label="Shared by link" color={t.accent} /> : null}</Row>
      </View>
      <Row style={{ flexWrap: 'nowrap' }}>
        <Button title="PDF" small icon={ic('arrow.down.doc.fill', 'download')} onPress={pdf} style={{ flex: 1 }} />
        <Button title="Share" small kind="soft" icon={ic('link', 'link')} onPress={share} style={{ flex: 1 }} />
        <Button title="Copy" small kind="soft" icon={ic('doc.on.doc', 'content_copy')} onPress={async () => { await Clipboard.setStringAsync(doc.body ?? ''); notice('Copied', 'Equations are kept as LaTeX.'); }} style={{ flex: 1 }} />
      </Row>
      <DocView kind={doc.kind} body={doc.body ?? ''} />
      {doc.meta?.skipped?.length ? (
        <Card style={{ gap: space.sm }}>
          <T variant="label" muted>Left out as not important for the exam</T>
          {doc.meta.skipped.map((s: string) => <T key={s} variant="small">• {s}</T>)}
          <T variant="small" muted>Add any of these to your revisit list from the course's Memory section.</T>
        </Card>
      ) : null}
    </Screen>
  );
}

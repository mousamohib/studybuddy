// Download and share for sheets and papers: PDF (phone), HTML (web), Markdown, and share links.
import * as Clipboard from 'expo-clipboard';
import { File as FSFile, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import katex from 'katex';
import { marked } from 'marked';
import { Platform, Share } from 'react-native';
import { supabase } from './supabase';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Markdown + maths → standalone HTML. Maths is MathML so it needs no fonts or network. */
export function toHtml(title: string, subtitle: string, markdown: string): string {
  const math: { tex: string; display: boolean }[] = [];
  const keep = (tex: string, display: boolean) => `@@M${math.push({ tex, display }) - 1}@@`;
  const src = markdown
    .replace(/^[ \t]*=+[ \t]*(END )?ANSWER[ \t]*=+[ \t]*$/gim, (m) => (/END/i.test(m) ? '\n---\n' : '\n**Answer**\n'))
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => keep(t, true)).replace(/\\\[([\s\S]+?)\\\]/g, (_, t) => keep(t, true))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, t) => keep(t, false)).replace(/(^|[^\\$])\$([^\s$](?:[^$\n]*?[^\s$\\])?)\$/g, (_, p, t) => p + keep(t, false));
  const body = (marked.parse(src, { async: false, gfm: true }) as string).replace(/@@M(\d+)@@/g, (_, i) => {
    const m = math[+i];
    try { return katex.renderToString(m.tex, { displayMode: m.display, throwOnError: false, output: 'mathml' }); } catch { return `<code>${esc(m.tex)}</code>`; }
  });
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font:13px/1.55 -apple-system,"Segoe UI",Roboto,sans-serif;color:#222;max-width:820px;margin:24px auto;padding:0 20px}h1{font-size:22px;margin:0}h2{font-size:17px;border-bottom:2px solid #2383E2;padding-bottom:3px;margin:20px 0 8px}h3{font-size:15px;margin:14px 0 6px}
.meta{color:#777;font-size:12px;margin:4px 0 16px}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:3px 7px;vertical-align:top}pre{background:#f3f3f1;padding:8px;border-radius:6px;overflow-x:auto}code{font-family:Menlo,monospace;font-size:.92em}
blockquote{border-left:3px solid #2383E2;margin:8px 0;padding-left:10px;color:#555}math[display=block]{margin:8px 0;overflow-x:auto}@media print{body{margin:0;max-width:none}h2{break-after:avoid}table,pre{break-inside:avoid}}</style>
</head><body><h1>${esc(title)}</h1><p class="meta">${esc(subtitle)}</p>${body}</body></html>`;
}

const safeName = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'Scrawlie';

export async function downloadPdf(title: string, subtitle: string, markdown: string) {
  const html = toHtml(title, subtitle, markdown);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a'); a.href = url; a.download = `${safeName(title)}.html`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return 'Saved as a web page. Open it and use Print → Save as PDF.';
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
  return null;
}

export async function downloadMarkdown(title: string, markdown: string) {
  const text = `# ${title}\n\n${markdown}\n`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    const a = document.createElement('a'); a.href = url; a.download = `${safeName(title)}.md`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return;
  }
  const f = new FSFile(Paths.cache, `${safeName(title)}.md`);
  if (f.exists) f.delete();
  f.create();
  f.write(text);
  await Sharing.shareAsync(f.uri, { mimeType: 'text/markdown', dialogTitle: title });
}

/** Creates (or reuses) a share link for a document. Returns null when the website isn't set up yet. */
export async function shareLink(docId: string, existing: string | null, title: string): Promise<string | null> {
  const web = process.env.EXPO_PUBLIC_WEB_URL;
  if (!web) return null;
  let token = existing;
  if (!token) {
    token = Array.from({ length: 28 }, () => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 56)]).join('');
    await supabase.from('documents').update({ share_token: token }).eq('id', docId);
  }
  const url = `${web.replace(/\/$/, '')}/s/${token}`;
  if (Platform.OS === 'web') await Clipboard.setStringAsync(url);
  else await Share.share({ message: `${title}: ${url}`, url });
  return url;
}

export async function stopSharing(docId: string) { await supabase.from('documents').update({ share_token: null }).eq('id', docId); }

'use dom';
// Renders AI answers, sheets and papers: Markdown with maths (KaTeX), tables and code.
// A DOM component: a web view on iPhone/Android, plain HTML on the web. Works in Expo Go.
import katex from 'katex';
import { marked } from 'marked';
import { useMemo } from 'react';

type Colors = { text: string; muted: string; accent: string; surface: string; border: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function render(src: string): string {
  const math: { tex: string; display: boolean }[] = [];
  const keep = (tex: string, display: boolean) => `@@M${math.push({ tex, display }) - 1}@@`;
  let s = src
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => keep(t, true))
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, t) => keep(t, true))
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, t) => keep(t, false))
    .replace(/(^|[^\\$])\$([^\s$](?:[^$\n]*?[^\s$\\])?)\$/g, (_, p, t) => p + keep(t, false));
  s = marked.parse(s, { async: false, gfm: true, breaks: false }) as string;
  // Never trust raw HTML from the model: escape anything that isn't from Markdown itself.
  return s.replace(/@@M(\d+)@@/g, (_, i) => {
    const m = math[+i];
    try { return katex.renderToString(m.tex, { displayMode: m.display, throwOnError: false, output: 'html' }); }
    catch { return `<code>${esc(m.tex)}</code>`; }
  });
}

marked.use({ renderer: { html: ({ text }: { text: string }) => esc(text) } });

export default function RichText({ markdown, colors, fontSize = 15 }: { markdown: string; colors: Colors; fontSize?: number; dom?: import('expo/dom').DOMProps }) {
  const html = useMemo(() => render(markdown || ''), [markdown]);
  const css = `
    :root { color-scheme: light dark; }
    html, body { margin: 0; padding: 0; background: transparent; }
    .rt { color: ${colors.text}; font: ${fontSize}px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow-wrap: anywhere; -webkit-text-size-adjust: 100%; }
    .rt > :first-child { margin-top: 0; } .rt > :last-child { margin-bottom: 0; }
    .rt h1, .rt h2, .rt h3 { line-height: 1.3; margin: 1.2em 0 .4em; } .rt h1 { font-size: 1.35em; } .rt h2 { font-size: 1.2em; } .rt h3 { font-size: 1.05em; }
    .rt p { margin: .55em 0; } .rt ul, .rt ol { padding-left: 1.3em; margin: .5em 0; } .rt li { margin: .2em 0; }
    .rt a { color: ${colors.accent}; }
    .rt code { font-family: ui-monospace, Menlo, monospace; font-size: .9em; background: ${colors.surface}; padding: .1em .3em; border-radius: 4px; }
    .rt pre { background: ${colors.surface}; padding: 10px 12px; border-radius: 8px; overflow-x: auto; }
    .rt pre code { background: none; padding: 0; }
    .rt blockquote { margin: .6em 0; padding-left: 12px; border-left: 3px solid ${colors.accent}; color: ${colors.muted}; }
    .rt table { border-collapse: collapse; display: block; overflow-x: auto; margin: .6em 0; }
    .rt th, .rt td { border: 1px solid ${colors.border}; padding: 4px 8px; text-align: left; vertical-align: top; }
    .rt hr { border: 0; border-top: 1px solid ${colors.border}; margin: 1em 0; }
    .rt .katex-display { overflow-x: auto; overflow-y: hidden; padding: 2px 0; margin: .6em 0; }
  `;
  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css" />
      <style>{css}</style>
      <div className="rt" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

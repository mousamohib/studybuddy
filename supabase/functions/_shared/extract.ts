// Turns uploaded files into text the AI can read.
// PDF (with [p. N] page markers), PowerPoint (with [slide N] markers), Word, zip archives, code/text.
// Photos are returned as images so the caller can have the AI transcribe them.
import { extractText as pdfText, getDocumentProxy } from "npm:unpdf@0.12.1";
import { unzipSync, strFromU8 } from "npm:fflate@0.8.2";

export type Extracted = {
  text: string; images: { name: string; mediaType: string; data: Uint8Array }[]; skipped: string[];
  /** Set for lecture captions/transcripts and for recordings (which still need transcribing). */
  recording?: boolean;
  media?: { name: string; mediaType: string; data: Uint8Array };
};
const MEDIA_EXT: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", flac: "audio/flac", aac: "audio/aac", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm", mpeg: "video/mpeg", mpga: "audio/mpeg" };

/** .vtt / .srt captions → plain text with a [t. mm:ss] marker about every 90 seconds. */
export function fromCaptions(src: string): string {
  const out: string[] = [];
  let lastMark = -1e9, last = "";
  for (const block of src.replace(/\r/g, "").split(/\n{2,}/)) {
    const time = block.match(/(\d{1,2}:)?(\d{1,2}):(\d{2})[.,]\d{1,3}\s*-->/);
    const lines = block.split("\n").filter((l) => l.trim() && !/-->/.test(l) && !/^\d+$/.test(l.trim()) && !/^(WEBVTT|NOTE|STYLE|Kind:|Language:)/.test(l));
    if (!lines.length) continue;
    if (time) {
      const sec = (time[1] ? parseInt(time[1]) * 3600 : 0) + parseInt(time[2]) * 60 + parseInt(time[3]);
      if (sec - lastMark >= 90) { out.push(`\n[t. ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}]`); lastMark = sec; }
    }
    const text = lines.join(" ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text && text !== last) out.push(text);   // auto-captions often repeat the previous line
    last = text;
  }
  return out.join(" ").replace(/ \n/g, "\n").trim();
}

const TEXT_EXT = /\.(txt|md|tex|py|java|c|cc|cpp|h|hpp|js|jsx|ts|tsx|m|csv|json|html|css|xml|ya?ml|sh|go|rs|kt|swift|sql|r|rb|php|scala|ipynb|ini|toml|cfg|asm|s|v|vhd|sv|lua|jl)$/i;
const TEXT_NAMES = /(^|\/)(Makefile|Dockerfile|README|LICENSE|CMakeLists\.txt)$/i;
const IMAGE_EXT: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
const SKIP_DIR = /(^|\/)(__MACOSX|\.git|node_modules|\.idea|\.vscode|__pycache__|target|bin|out|build|dist)(\/|$)|(^|\/)\._|\.DS_Store$/;
const MAX_CHARS = 1_500_000;

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&");

async function fromPdf(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await pdfText(pdf, { mergePages: false });
  return (text as string[]).map((t, i) => `[p. ${i + 1}]\n${t.replace(/[ \t]+/g, " ").trim()}`).join("\n\n");
}

function fromPptx(files: Record<string, Uint8Array>): string {
  const slides = Object.keys(files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  return slides.map((k, i) => {
    const xml = strFromU8(files[k]);
    const paras = xml.split(/<\/a:p>/).map((p) => [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1])).join("")).filter((s) => s.trim());
    const notesKey = `ppt/notesSlides/notesSlide${k.match(/(\d+)\.xml$/)![1]}.xml`;
    const notes = files[notesKey] ? [...strFromU8(files[notesKey]).matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1])).join(" ").trim() : "";
    return `[slide ${i + 1}]\n${paras.join("\n")}${notes && !/^\d+$/.test(notes) ? `\n(Speaker notes: ${notes})` : ""}`;
  }).join("\n\n");
}

function fromDocx(files: Record<string, Uint8Array>): string {
  const xml = files["word/document.xml"] ? strFromU8(files["word/document.xml"]) : "";
  return xml.split(/<\/w:p>/).map((p) => [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => decodeXml(m[1])).join("")).filter((s) => s.trim()).join("\n");
}

function notebook(src: string): string {
  try {
    const j = JSON.parse(src);
    return (j.cells ?? []).map((c: { cell_type: string; source: string | string[] }) => `[${c.cell_type}]\n${Array.isArray(c.source) ? c.source.join("") : c.source}`).join("\n\n");
  } catch { return src; }
}

const ext = (name: string) => (name.split(".").pop() ?? "").toLowerCase();

export async function extract(bytes: Uint8Array, name: string, depth = 0): Promise<Extracted> {
  const e = ext(name);
  const out: Extracted = { text: "", images: [], skipped: [] };
  if (e === "vtt" || e === "srt") { out.text = fromCaptions(new TextDecoder().decode(bytes)); out.recording = true; }
  else if (MEDIA_EXT[e]) { out.media = { name, mediaType: MEDIA_EXT[e], data: bytes }; out.recording = true; }
  else if (e === "pdf") out.text = await fromPdf(bytes);
  else if (e === "pptx") out.text = fromPptx(unzipSync(bytes));
  else if (e === "docx") out.text = fromDocx(unzipSync(bytes));
  else if (IMAGE_EXT[e]) out.images.push({ name, mediaType: IMAGE_EXT[e], data: bytes });
  else if (e === "zip" && depth === 0) {
    const files = unzipSync(bytes);
    const names = Object.keys(files).filter((n) => !n.endsWith("/") && !SKIP_DIR.test(n)).sort();
    const parts: string[] = [];
    for (const n of names) {
      const inner = await extract(files[n], n, 1).catch(() => null);
      if (!inner || (!inner.text && !inner.images.length)) { out.skipped.push(n); continue; }
      if (inner.text) parts.push(`===== FILE: ${n} =====\n${inner.text}`);
      out.images.push(...inner.images.slice(0, 5));
      if (parts.join("").length > MAX_CHARS) { out.skipped.push("(rest left out: archive too large)"); break; }
    }
    out.text = `Contents of ${name}:\n${names.map((n) => `- ${n}`).join("\n")}\n\n${parts.join("\n\n")}`;
  } else if (TEXT_EXT.test(name) || TEXT_NAMES.test(name)) {
    const s = new TextDecoder().decode(bytes);
    if (/\u0000/.test(s.slice(0, 2000))) out.skipped.push(name);
    else out.text = e === "ipynb" ? notebook(s) : s;
    // A .txt transcript (Zoom/Panopto/Teams exports): mostly spoken sentences, often with timestamps or "transcript" in the name.
    if (e === "txt" && (/transcript|caption|recording|lecture.?\d/i.test(name) || (s.match(/\b\d{1,2}:\d{2}(:\d{2})?\b/g)?.length ?? 0) > 20)) out.recording = true;
  } else out.skipped.push(name);
  if (out.text.length > MAX_CHARS) out.text = out.text.slice(0, MAX_CHARS) + "\n[…file shortened]";
  return out;
}

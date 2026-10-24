// Turns uploaded files into text the AI can read.
// PDF (with [p. N] page markers), PowerPoint (with [slide N] markers), Word, zip archives, code/text.
// Photos are returned as images so the caller can have the AI transcribe them.
import { extractText as pdfText, getDocumentProxy } from "npm:unpdf@0.12.1";
import { unzipSync, strFromU8 } from "npm:fflate@0.8.2";

export type Extracted = { text: string; images: { name: string; mediaType: string; data: Uint8Array }[]; skipped: string[] };

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
  if (e === "pdf") out.text = await fromPdf(bytes);
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
  } else out.skipped.push(name);
  if (out.text.length > MAX_CHARS) out.text = out.text.slice(0, MAX_CHARS) + "\n[…file shortened]";
  return out;
}

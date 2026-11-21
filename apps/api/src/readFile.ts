// POST /api/read-file: reads a file of the learner's notes (a PDF, slides
// from PowerPoint or Keynote saved as .pptx, a Word document or plain text)
// and returns its text, so Fenny can learn from it.
//
// Word, PowerPoint and text files are read here with no AI: they are zip
// files of XML (or plain text), so the words come straight out. A PDF goes
// to the model, which reads the pages (scans and diagrams included).
import { unzipSync, strFromU8 } from "fflate";
import { ProviderError } from "./openai";
import { chatPricesFor } from "./pricing";
import { chatJSON, hasKeyFor, modelFor } from "./engine/chat";

type Env = Record<string, string | undefined>;

/** Base64 of about 3 MB, under Vercel's 4.5 MB request limit. */
export const MAX_FILE_CHARS = 4_200_000;
/** Notes longer than this are cut, so a whole textbook doesn't swamp a call. */
export const MAX_TEXT = 60_000;

export interface ReadFileResult {
  title: string;
  text: string;
  readable: boolean;
  pages: number;
  cost: { usd: number; pence: number };
}

const NONE = { usd: 0, pence: 0 };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const unescape = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

/** The text runs inside one XML part, joined per paragraph. */
function paragraphs(xml: string, para: string, run: string): string[] {
  const out: string[] = [];
  for (const p of xml.split(new RegExp(`</${para}>`))) {
    const bits = [...p.matchAll(new RegExp(`<${run}(?:\\s[^>]*)?>([^<]*)</${run}>`, "g"))].map((m) => unescape(m[1]));
    const line = bits.join("").replace(/\s+/g, " ").trim();
    if (line) out.push(line);
  }
  return out;
}

export function readDocx(bytes: Uint8Array): { text: string; pages: number } {
  const files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" });
  const xml = files["word/document.xml"];
  if (!xml) throw new Error("Not a Word document");
  const lines = paragraphs(strFromU8(xml), "w:p", "w:t");
  return { text: lines.join("\n"), pages: 1 };
}

export function readPptx(bytes: Uint8Array): { text: string; pages: number } {
  const files = unzipSync(bytes, { filter: (f) => /^ppt\/slides\/slide\d+\.xml$/.test(f.name) });
  const names = Object.keys(files).sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  if (!names.length) throw new Error("No slides found");
  const text = names
    .map((n, i) => {
      const lines = paragraphs(strFromU8(files[n]), "a:p", "a:t");
      return lines.length ? `# Slide ${i + 1}\n${lines.join("\n")}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
  return { text, pages: names.length };
}

/** A name for the notes from their first real line. */
export function titleFrom(text: string, fallback: string): string {
  const first = text
    .split("\n")
    .map((l) => l.replace(/^#+\s*(Slide \d+)?/i, "").replace(/^[-*\s]+/, "").trim())
    .find((l) => l.length > 2 && l.length <= 70);
  return (first ?? fallback).slice(0, 80);
}

const PDF_PROMPT = `You read a PDF of a university student's study notes: lecture slides, a handout, a chapter or their own notes.

Copy what it says, faithfully, in reading order, page by page.
- Keep headings, bullet points and numbered lists, using simple markdown (#, -, 1.).
- Write maths and chemistry in plain text: x^2, sqrt(b^2 - 4ac), H2O.
- For a diagram or chart, write one short line in square brackets saying what it shows and its labels.
- Ignore page numbers, running headers, footers and watermarks. Never add facts that are not there.

title: what the notes are about in 2 to 5 words, the way a student would name the topic.
readable: false only if this is not study material or has no readable text.`;

const SCHEMA = {
  type: "object",
  properties: { title: { type: "string" }, text: { type: "string" }, readable: { type: "boolean" } },
  required: ["title", "text", "readable"],
  additionalProperties: false,
};

async function readPdf(cfg: { apiKey: string; model: string; env: Env; fetchImpl?: typeof fetch }, base64: string, name: string, topic?: string): Promise<ReadFileResult> {
  const hint = topic?.trim() ? `\n\nThe student says the topic is: ${topic.trim().slice(0, 120)}` : "";
  let r;
  try {
    r = await chatJSON<{ title?: string; text?: string; readable?: boolean }>(
      { apiKey: cfg.apiKey, anthropicKey: cfg.env.ANTHROPIC_API_KEY, model: cfg.model, reasoningEffort: "low", fetchImpl: cfg.fetchImpl },
      [
        { role: "developer", content: PDF_PROMPT + hint },
        { role: "user", content: [{ type: "file", file: { filename: name || "notes.pdf", file_data: `data:application/pdf;base64,${base64}` } }] },
      ],
      { name: "notes", schema: SCHEMA },
      16000,
    );
  } catch (e) {
    throw new ProviderError("Reader", 502, e instanceof Error ? e.message.slice(0, 500) : String(e));
  }
  const v = r.value;
  const prices = chatPricesFor(cfg.model, cfg.env);
  const cached = r.usage.prompt_tokens_details?.cached_tokens ?? 0;
  const inTok = Math.max(0, (r.usage.prompt_tokens ?? 0) - cached);
  const usd = (inTok * prices.chatInPerM + cached * prices.chatCachedInPerM + (r.usage.completion_tokens ?? 0) * prices.chatOutPerM) / 1e6;
  const text = (v.text ?? "").trim().slice(0, MAX_TEXT);
  const readable = v.readable !== false && !!text;
  return { title: (v.title ?? "").trim().slice(0, 80), text: readable ? text : "", readable, pages: 0, cost: { usd, pence: usd * (Number(cfg.env.GBP_PER_USD) || 0.76) * 100 } };
}

/** Which reader a file needs, from its name. */
export function kindOf(name: string): "pdf" | "docx" | "pptx" | "text" | null {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "pptx") return "pptx";
  if (["txt", "md", "markdown", "text", "csv", "rtf"].includes(ext)) return "text";
  return null;
}

export async function handleReadFile(req: Request, env: Env = process.env, fetchImpl?: typeof fetch): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "Use POST" });
  if (env.PROTOTYPE_TOKEN && req.headers.get("authorization") !== `Bearer ${env.PROTOTYPE_TOKEN}`) return json(401, { error: "Unauthorised" });
  let body: { name?: string; data?: string; topic?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  const name = (body.name ?? "").slice(0, 200);
  const data = (body.data ?? "").replace(/^data:[^;]+;base64,/, "");
  if (!data) return json(400, { error: "data is required" });
  if (data.length > MAX_FILE_CHARS) return json(413, { error: "That file is too big. Try one under 3 MB, or split it." });
  const kind = kindOf(name);
  if (!kind) return json(415, { error: "Fenny can read PDFs, PowerPoint (.pptx), Word (.docx) and text files. For Keynote or Pages, export as PDF first." });
  const fallback = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "My notes";
  try {
    if (kind === "pdf") {
      const model = modelFor(env, env.READ_PAGE_MODEL, "claude-sonnet-5-5");
      if (!hasKeyFor(env, model)) return json(500, { error: "No AI key is set on the server" });
      const r = await readPdf({ apiKey: env.OPENAI_API_KEY ?? "", model, env, fetchImpl }, data, name, body.topic);
      return json(200, { ...r, title: r.title || fallback });
    }
    const bytes = Uint8Array.from(Buffer.from(data, "base64"));
    const got = kind === "docx" ? readDocx(bytes) : kind === "pptx" ? readPptx(bytes) : { text: strFromU8(bytes), pages: 1 };
    const text = got.text.replace(/\r\n/g, "\n").trim().slice(0, MAX_TEXT);
    const out: ReadFileResult = { title: titleFrom(text, fallback), text, readable: !!text, pages: got.pages, cost: NONE };
    return json(200, out);
  } catch (e) {
    console.error("read-file", e);
    return json(422, { error: "I couldn't read that file. If it's Keynote or Pages, export it as a PDF and try again." });
  }
}

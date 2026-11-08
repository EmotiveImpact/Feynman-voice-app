// POST /api/read-page: reads one scanned page of the learner's notes (a
// photo of handwriting, a printed handout, a textbook page or a slide) and
// returns the text, so Fenny can learn from it. One page per request keeps
// each upload small and lets the phone read several pages at once.
//
// A vision model reads the page because handwriting, equations and diagrams
// are beyond small on-device text readers. Costs a fraction of a penny a page.
import { ProviderError } from "./openai";
import { chatPricesFor } from "./pricing";
import { chatJSON, hasKeyFor, modelFor } from "./engine/chat";

type Env = Record<string, string | undefined>;

/** Base64 JPEG, about 1.5 MB at most after the phone shrinks it. */
const MAX_IMAGE_CHARS = 4_000_000;

export interface ReadPageResult {
  /** A short name for what the page is about, e.g. "Enzyme kinetics". */
  title: string;
  /** The page's text in reading order, as plain text with simple markdown. */
  text: string;
  /** False when the photo is not notes or is too blurry to read. */
  readable: boolean;
  cost: { usd: number; pence: number };
}

export const READ_PAGE_PROMPT = `You read one photo of a university student's study notes: handwriting, a printed handout, a textbook page or a lecture slide.

Copy what the page says, faithfully, in reading order.
- Keep headings, bullet points and numbered lists, using simple markdown (#, -, 1.).
- Write maths and chemistry in plain text: x^2, sqrt(b^2 - 4ac), H2O, Vmax / (Km + [S]).
- For a diagram, chart or drawing, write one short line in square brackets saying what it shows and its labels, e.g. [Diagram: enzyme with active site; substrate fits like a key; labels "active site", "substrate"].
- Keep crossings-out out. Mark a word you cannot read as [?]. Never guess or add facts that are not on the page.
- Ignore page furniture such as page numbers, running headers and watermarks.

title: what the page is about in 2 to 5 words, the way a student would name the topic.
readable: false only if the photo is not study material or is too blurry or dark to read; then text is "".`;

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    text: { type: "string" },
    readable: { type: "boolean" },
  },
  required: ["title", "text", "readable"],
  additionalProperties: false,
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function readPage(
  cfg: { apiKey: string; model: string; env: Env; fetchImpl?: typeof fetch },
  imageBase64: string,
  topic?: string,
): Promise<ReadPageResult> {
  const hint = topic?.trim() ? `\n\nThe student says the topic is: ${topic.trim().slice(0, 120)}` : "";
  let r;
  try {
    r = await chatJSON<Partial<ReadPageResult>>(
      { apiKey: cfg.apiKey, anthropicKey: cfg.env.ANTHROPIC_API_KEY, model: cfg.model, reasoningEffort: "low", fetchImpl: cfg.fetchImpl },
      [
        { role: "developer", content: READ_PAGE_PROMPT + hint },
        { role: "user", content: [{ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" } }] },
      ],
      { name: "page", schema: SCHEMA },
      4000,
    );
  } catch (e) {
    throw new ProviderError("Vision", 502, e instanceof Error ? e.message.slice(0, 500) : String(e));
  }
  const parsed = r.value;
  const prices = chatPricesFor(cfg.model, cfg.env);
  const cached = r.usage.prompt_tokens_details?.cached_tokens ?? 0;
  const inTok = Math.max(0, (r.usage.prompt_tokens ?? 0) - cached);
  const outTok = r.usage.completion_tokens ?? 0;
  const usd = (inTok * prices.chatInPerM + cached * prices.chatCachedInPerM + outTok * prices.chatOutPerM) / 1e6;
  const gbp = Number(cfg.env.GBP_PER_USD) || 0.76;
  const readable = parsed.readable !== false && !!parsed.text?.trim();
  return {
    title: (parsed.title ?? "").trim().slice(0, 80),
    text: readable ? (parsed.text ?? "").trim() : "",
    readable,
    cost: { usd, pence: usd * gbp * 100 },
  };
}

export async function handleReadPage(req: Request, env: Env = process.env, fetchImpl?: typeof fetch): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "Use POST" });
  if (env.PROTOTYPE_TOKEN && req.headers.get("authorization") !== `Bearer ${env.PROTOTYPE_TOKEN}`) return json(401, { error: "Unauthorised" });
  let body: { image?: string; topic?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  const image = (body.image ?? "").replace(/^data:image\/\w+;base64,/, "");
  if (!image) return json(400, { error: "image is required" });
  if (image.length > MAX_IMAGE_CHARS) return json(413, { error: "That photo is too big" });
  const model = modelFor(env, env.READ_PAGE_MODEL);
  if (!hasKeyFor(env, model)) return json(500, { error: "No AI key is set on the server" });
  try {
    return json(200, await readPage({ apiKey: env.OPENAI_API_KEY ?? "", model, env, fetchImpl }, image, body.topic));
  } catch (e) {
    console.error("read-page", e);
    return json(502, { error: "Could not read that page" });
  }
}

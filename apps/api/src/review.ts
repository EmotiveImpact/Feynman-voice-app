// After the call: gap analysis (POST /api/analyse) and "Show me"
// (POST /api/show-me). See docs/behavioural-design.md.
//
// Analysis reads the call's transcript (and the learner's notes, when they
// have added some) and returns what they explained well, quoted in their own
// words, then the gaps. The first gap is always the one the learner named
// when asked "Which bit felt shakiest to you?", titled in their words.
//
// "Show me" gives a short explanation of one gap, from their notes when there
// are any. The app always follows it with "Now tell Fenny in your own words",
// so the explaining is still theirs. Fenny itself never explains. The same
// endpoint serves the in-call offer ("Want a quick explanation, then tell me in
// your own words?") after the learner is stuck twice.
import { ProviderError } from "./openai";
import { chatPricesFor, pricesFromEnv } from "./pricing";
import { chatJSON, hasKeyFor, modelFor } from "./engine/chat";

type Env = Record<string, string | undefined>;

export interface CallTurn {
  speaker: "learner" | "student";
  text: string;
}

export interface AnalyseRequest {
  topic: string;
  goal?: string;
  notes?: string;
  turns: CallTurn[];
  /** Their answer to "Which bit felt shakiest to you?", in their words. */
  shakiest?: string;
  /** What they said the first time they explained this topic, for "then and now". */
  firstAttempt?: string;
  /** The gap this call went back over, when it was opened from a gap card. */
  focus?: string;
  /** Key ideas from the conversation engine that never came up in the call. */
  missedIdeas?: string[];
}

export interface Strength {
  title: string;
  /** Their own words from the call, verbatim. */
  quote: string;
}

export interface Gap {
  kind: "gap" | "skipped" | "muddled";
  title: string;
  /** What they said or left out, without giving the answer away. */
  detail: string;
  /** Where in their notes this lives, if they have notes. Empty otherwise. */
  source: string;
  /** True for the card the learner named themselves. */
  named: boolean;
  /**
   * For "muddled" only: the right version in one plain sentence, so a
   * misconception Fenny did not catch is never left standing. Empty otherwise.
   */
  correction: string;
}

export interface Analysis {
  strengths: Strength[];
  gaps: Gap[];
  thenAndNow: { then: string; now: string } | null;
  /** For a call opened from a gap card: did they explain that part clearly this time? */
  focusExplained: boolean;
}

export interface ShowMeRequest {
  topic: string;
  gap: { title: string; detail?: string };
  notes?: string;
  turns?: CallTurn[];
}

export interface ShowMe {
  explanation: string;
  fromNotes: boolean;
}

const MAX_TRANSCRIPT_CHARS = 24_000;
const MAX_NOTES_CHARS = 30_000;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function guard(req: Request, env: Env): Response | null {
  if (req.method !== "POST") return json(405, { error: "Use POST" });
  if (env.PROTOTYPE_TOKEN && req.headers.get("authorization") !== `Bearer ${env.PROTOTYPE_TOKEN}`) {
    return json(401, { error: "Missing or wrong prototype token" });
  }
  if (!hasKeyFor(env, reviewModel(env))) return json(500, { error: "No AI key is set on the server" });
  return null;
}

/** The call as plain lines, newest kept if it runs long. */
export function transcriptText(turns: CallTurn[]): string {
  const lines = turns
    .filter((t) => t && typeof t.text === "string" && t.text.trim())
    .map((t) => `${t.speaker === "learner" ? "LEARNER" : "FENNY"}: ${t.text.trim()}`);
  let text = lines.join("\n");
  if (text.length > MAX_TRANSCRIPT_CHARS) text = "…" + text.slice(-MAX_TRANSCRIPT_CHARS);
  return text;
}

function clip(s: string | undefined, n: number) {
  const t = (s ?? "").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
}

export const ANALYSE_PROMPT = `You review a recording of a university student explaining a topic out loud to Fenny, a curious beginner who only asks questions. Your job is to show the student, kindly and exactly, what came across clearly and where the gaps are, so they can go back and explain those parts again.

Return:
- strengths: up to four things they explained well. "title" is a short plain label for the idea. "quote" is their own words from the transcript, copied exactly (trim to one sentence, at most 25 words). Only include something if they really did explain it. Never invent a quote.
- gaps: up to four parts that need another go, most important first.
  - kind "gap": they touched it but left out a step, a reason or a definition.
  - kind "muddled": something they said does not hold up, or contradicts their notes.
  - kind "skipped": an important part (from their notes or their goal) that never came up.
  - "title": one short line a student would recognise, such as 'You said it "binds weakly", but not why.' Use their words in quotes where you can.
  - "detail": one or two sentences on what they said or left out, so they know where to look. Do NOT give the answer or the missing fact. Point at it as a question or a pointer instead. If they have notes, you may say which part of their notes covers it.
  - "source": where it lives in their notes in a few words (for example "Notes: competitive inhibition"), or "" if they have no notes.
  - "named": false for every gap you find yourself.
  - "correction": for "muddled" only, the right version in one plain sentence, from their notes when they have them, so a wrong idea is never left standing. "" for every other kind.
- thenAndNow: only when an earlier attempt is given. "then" is a short line from the earlier attempt and "now" a line from this call about the same idea that shows the change, both quoted exactly. Use null if there is no earlier attempt or no clear pair.

If they named the part that felt shakiest, do not repeat that same part in gaps; the app adds it as the first card in their words. Instead, give its detail in "shakiestDetail": one or two sentences on what they said about it, without the answer. If they did not name one, make "shakiestDetail" "".

If the call went back over one particular part (the focus), set "focusExplained" to true only if this time they explained that part clearly and correctly in their own words. Otherwise, and when there is no focus, false.

If the call is too short to judge, return what you can and keep the lists short. Never pad.
Write in British English, plain and warm. Never shame them. No markdown, no emoji.`;

const ANALYSE_SCHEMA = {
  type: "object",
  properties: {
    strengths: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, quote: { type: "string" } },
        required: ["title", "quote"],
        additionalProperties: false,
      },
    },
    gaps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["gap", "skipped", "muddled"] },
          title: { type: "string" },
          detail: { type: "string" },
          source: { type: "string" },
          named: { type: "boolean" },
          correction: { type: "string" },
        },
        required: ["kind", "title", "detail", "source", "named", "correction"],
        additionalProperties: false,
      },
    },
    shakiestDetail: { type: "string" },
    focusExplained: { type: "boolean" },
    thenAndNow: {
      anyOf: [
        {
          type: "object",
          properties: { then: { type: "string" }, now: { type: "string" } },
          required: ["then", "now"],
          additionalProperties: false,
        },
        { type: "null" },
      ],
    },
  },
  required: ["strengths", "gaps", "shakiestDetail", "focusExplained", "thenAndNow"],
  additionalProperties: false,
} as const;

export const SHOW_ME_PROMPT = `A university student is learning a topic by explaining it out loud. They got stuck on one part and tapped "Show me". Give them a short, clear explanation of just that part, so they can go back and explain it in their own words.

Rules:
- If their notes are given, explain it from their notes, using the notes' own terms. Do not add facts the notes do not support. If the notes do not cover it, say so in one short sentence first, then explain it briefly from general knowledge.
- If no notes are given, explain it briefly from general knowledge at the level of a first-year university course, and do not mention notes at all.
- About 20 to 30 seconds read aloud: 50 to 80 words, plain spoken English. One idea, the missing step, not the whole topic.
- Include one everyday analogy, taken from their notes or their own words when they have one.
- No lists, no markdown, no emoji. Do not quiz them or tell them to explain it back; the app does that.
- British English.`;

const SHOW_ME_SCHEMA = {
  type: "object",
  properties: { explanation: { type: "string" }, coveredByNotes: { type: "boolean" } },
  required: ["explanation", "coveredByNotes"],
  additionalProperties: false,
} as const;

/** One structured chat call. Returns the parsed JSON and its cost in pence. */
async function chatJson<T>(
  env: Env,
  system: string,
  user: string,
  schemaName: string,
  schema: object,
  maxTokens: number,
  fetchImpl?: typeof fetch,
): Promise<{ data: T; pence: number }> {
  const model = reviewModel(env);
  let r;
  try {
    r = await chatJSON<T>(
      { apiKey: env.OPENAI_API_KEY ?? "", anthropicKey: env.ANTHROPIC_API_KEY, model, reasoningEffort: env.OPENAI_REVIEW_REASONING_EFFORT ?? "low", fetchImpl },
      [
        { role: "developer", content: system },
        { role: "user", content: user },
      ],
      { name: schemaName, schema },
      maxTokens,
    );
  } catch (e) {
    throw new ProviderError("Chat", 502, e instanceof Error ? e.message.slice(0, 500) : String(e));
  }
  const u = r.usage;
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  const p = chatPricesFor(model, env);
  const usd = (Math.max(0, (u.prompt_tokens ?? 0) - cached) * p.chatInPerM + cached * p.chatCachedInPerM + (u.completion_tokens ?? 0) * p.chatOutPerM) / 1e6;
  return { data: r.value, pence: usd * pricesFromEnv(env).gbpPerUsd * 100 };
}

/** Gap analysis and "Show me" run on Claude Haiku when its key is set. */
function reviewModel(env: Env): string {
  return modelFor(env, env.REVIEW_MODEL ?? env.OPENAI_REVIEW_MODEL);
}

async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** Trim the model's lists and add the learner's own gap first. */
export function shapeAnalysis(
  raw: { strengths?: Strength[]; gaps?: Gap[]; shakiestDetail?: string; focusExplained?: boolean; thenAndNow?: { then: string; now: string } | null },
  shakiest: string | undefined,
): Analysis {
  const strengths = (raw.strengths ?? [])
    .filter((s) => s.title?.trim() && s.quote?.trim())
    .map((s) => ({ title: s.title.trim(), quote: unquote(s.quote) }))
    .slice(0, 4);
  const found = (raw.gaps ?? [])
    .filter((g) => g.title?.trim())
    .map((g) => {
      const kind = (["gap", "skipped", "muddled"] as const).includes(g.kind) ? g.kind : "gap";
      return { ...g, kind, named: false, correction: kind === "muddled" ? (g.correction ?? "").trim() : "" };
    })
    .slice(0, 4);
  const named = shakiest?.trim();
  const gaps: Gap[] = named
    ? [{ kind: "gap", title: named, detail: raw.shakiestDetail?.trim() ?? "", source: "You named it", named: true, correction: "" }, ...found.slice(0, 3)]
    : found;
  const tn = raw.thenAndNow;
  return { strengths, gaps, focusExplained: raw.focusExplained === true, thenAndNow: tn && tn.then?.trim() && tn.now?.trim() ? { then: unquote(tn.then), now: unquote(tn.now) } : null };
}

/** The app adds its own quote marks, so take off any the model added. */
export function unquote(s: string): string {
  return s.trim().replace(/^["'\u201C\u2018]+|["'\u201D\u2019]+$/g, "").trim();
}

export async function handleAnalyse(req: Request, env: Env = process.env, fetchImpl?: typeof fetch): Promise<Response> {
  const bad = guard(req, env);
  if (bad) return bad;
  const body = await readJson<AnalyseRequest>(req);
  if (!body) return json(400, { error: "Body must be JSON" });
  if (!Array.isArray(body.turns)) return json(400, { error: "turns is required" });
  const transcript = transcriptText(body.turns);
  if (!body.turns.some((t) => t?.speaker === "learner" && t.text?.trim())) return json(400, { error: "Nothing was said in this call" });

  const parts = [
    `Topic: ${clip(body.topic, 200) || "not given"}`,
    body.goal?.trim() ? `What they want to be able to explain: ${clip(body.goal, 400)}` : "",
    body.shakiest?.trim() ? `The part they said felt shakiest, in their words: ${clip(body.shakiest, 300)}` : "They did not name a part that felt shakiest.",
    body.missedIdeas?.length
      ? `Key ideas this topic needs that never came up in the call (good candidates for "skipped" gaps, if they matter for this topic and goal):\n${body.missedIdeas.slice(0, 8).map((i) => `- ${clip(i, 200)}`).join("\n")}`
      : "",
    body.focus?.trim() ? `This call went back over one part (the focus): ${clip(body.focus, 300)}` : "",
    body.notes?.trim() ? `<notes>\n${clip(body.notes, MAX_NOTES_CHARS)}\n</notes>` : "They have not added notes for this topic.",
    body.firstAttempt?.trim() ? `<earlier_attempt>\n${clip(body.firstAttempt, 3000)}\n</earlier_attempt>` : "",
    `<transcript>\n${transcript}\n</transcript>`,
  ].filter(Boolean);
  try {
    const t0 = Date.now();
    const { data, pence } = await chatJson<Parameters<typeof shapeAnalysis>[0]>(env, ANALYSE_PROMPT, parts.join("\n\n"), "gap_analysis", ANALYSE_SCHEMA, 2500, fetchImpl);
    return json(200, { ...shapeAnalysis(data, body.shakiest), pence, ms: Date.now() - t0 });
  } catch (e) {
    if (e instanceof ProviderError) return json(502, { error: e.message, detail: e.detail });
    if (e instanceof SyntaxError) return json(502, { error: "The analysis came back malformed. Try again." });
    throw e;
  }
}

export async function handleShowMe(req: Request, env: Env = process.env, fetchImpl?: typeof fetch): Promise<Response> {
  const bad = guard(req, env);
  if (bad) return bad;
  const body = await readJson<ShowMeRequest>(req);
  if (!body) return json(400, { error: "Body must be JSON" });
  if (!body.gap?.title?.trim()) return json(400, { error: "gap.title is required" });
  const notes = body.notes?.trim();
  const said = body.turns?.length ? transcriptText(body.turns.filter((t) => t.speaker === "learner")).slice(-3000) : "";
  const user = [
    `Topic: ${clip(body.topic, 200) || "not given"}`,
    `The part they are stuck on: ${clip(body.gap.title, 300)}`,
    body.gap.detail?.trim() ? `What they said or missed: ${clip(body.gap.detail, 600)}` : "",
    said ? `<what_they_said>\n${said}\n</what_they_said>` : "",
    notes ? `<notes>\n${clip(notes, MAX_NOTES_CHARS)}\n</notes>` : "No notes were given.",
  ]
    .filter(Boolean)
    .join("\n\n");
  try {
    const { data, pence } = await chatJson<{ explanation: string; coveredByNotes: boolean }>(env, SHOW_ME_PROMPT, user, "show_me", SHOW_ME_SCHEMA, 600, fetchImpl);
    const explanation = (data.explanation ?? "").trim();
    if (!explanation) return json(502, { error: "No explanation came back. Try again." });
    const result: ShowMe = { explanation, fromNotes: Boolean(notes) && data.coveredByNotes !== false };
    return json(200, { ...result, pence });
  } catch (e) {
    if (e instanceof ProviderError) return json(502, { error: e.message, detail: e.detail });
    if (e instanceof SyntaxError) return json(502, { error: "The explanation came back malformed. Try again." });
    throw e;
  }
}

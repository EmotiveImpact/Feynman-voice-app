// POST /api/lesson: a short "learn it first" lesson for one idea the learner
// is stuck on, built from their own notes. It powers Teach me: two or three
// bites, each with a simple picture and one puzzle, then the learner goes back
// and explains it to Fenny. Fenny never teaches; this lesson is the notes
// speaking, shown on screen.
//
// Request:  { topic, idea, notes?, said?, level? }   said = what the learner tried to say
//           level = "simple" (a five year old could follow), "standard" (a bright
//           12 year old could follow, the default) or "deep" (university terms)
// Response: { lesson, model, cached, cost, timingMs }
//
// Built on Claude (LESSON_BRAIN=claude, the default once ANTHROPIC_API_KEY is
// set) with OpenAI as the fallback brain. Lessons are cached in memory per
// topic, idea and notes, so a second learner tap costs nothing.
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { chatJSON } from "./engine/chat";
import { CLAUDE_PRICES, openAIPricesFromEnv, type CostLine } from "./pricing";
import { checkFilm, checkGuess, FILM_PROMPT, FILM_SCHEMA, GUESS_SCHEMA, type FilmBeat, type Guess } from "./film";
import { checkPlay, checkScene, FAMILIES, PLAY_SCHEMA, SCENE_PROMPT, SCENE_SCHEMA, type Play, type Scene } from "./scene";

type Env = Record<string, string | undefined>;

export const PICTURES = ["flow", "compare", "cycle", "layers", "parts", "none"] as const;
export const PUZZLES = ["true_false", "choose", "fill_gap", "order", "match"] as const;

export interface Puzzle {
  kind: (typeof PUZZLES)[number];
  /** The question, or for fill_gap a sentence with ___ where the gap is. */
  prompt: string;
  /**
   * true_false: ["True","False"]. choose and fill_gap: the choices.
   * order: the steps in the right order (the app shuffles them).
   * match: the left-hand items.
   */
  options: string[];
  /**
   * true_false, choose, fill_gap: one entry, the right option.
   * order: the same as options. match: the right-hand items, in the same order as options.
   */
  answer: string[];
  /** One friendly sentence shown after they answer. */
  why: string;
}

export interface Bite {
  title: string;
  text: string;
  /** The simple diagram, used when there is no scene or the app can't draw it. */
  picture: { kind: (typeof PICTURES)[number]; labels: string[] };
  /** A live drawing from the kit in scene.ts, or null. */
  scene: Scene | null;
  /** A slider that changes the scene, on at most one bite. */
  play: Play | null;
  /** One short sentence under the drawing that states its point. */
  caption: string;
  /** Words copied from the notes that back this bite up, or "" with no notes. */
  quote: string;
  /** True when quote was found in the notes. */
  fromNotes: boolean;
  puzzle: Puzzle;
  /** What Fenny says while the scene draws itself, one sentence per part. */
  film: FilmBeat[];
  /** "What happens next?", asked before the last sentence, on at most one bite. */
  guess: Guess | null;
}

export interface Lesson {
  idea: string;
  bites: Bite[];
  /** One line that ties it together, shown on the finish screen. */
  recap: string;
  /** What Fenny asks when they come back, e.g. "So how does a cell decide what gets in?" */
  explainBack: string;
}

export const LEVELS = ["simple", "standard", "deep"] as const;
export type Level = (typeof LEVELS)[number];

/** How simply to explain, told to the writer with each lesson so the instructions stay cached. */
export const LEVEL_TEXT: Record<Level, string> = {
  simple:
    "Level: simplest. Write it so a five year old could follow: tiny everyday words, short sentences, one concrete everyday comparison in each bite, and no technical words at all (say what the thing does instead). Keep only the core of the idea, and keep it true. Puzzles are easy checks of that core.",
  standard:
    "Level: plain. Write it so a bright 12 year old could follow: short everyday words, an everyday comparison when it helps, and any technical word explained in plain words the first time it appears. Keep it accurate to university level: simple words, not a simpler truth.",
  deep:
    "Level: university. The student already gets the basic idea, so go one layer deeper: use the proper technical terms (each explained briefly), show the mechanism and why it works, and include one nuance or common misconception. Still short, plain sentences. Puzzles test the deeper detail.",
};

export interface LessonRequest {
  topic: string;
  idea: string;
  notes?: string;
  said?: string;
  /** How simply to explain. Defaults to "standard". */
  level?: Level;
}

const SYSTEM = `You write tiny lessons for Fenny, a learning app for UK university students. The student tried to explain an idea and got stuck, so before they try again they get a bite-sized lesson, like Brilliant or Duolingo, then they explain it back in their own words.

Write 2 or 3 bites that build up to the idea. Each bite:
- title: 2 to 5 words.
- text: at most 45 words. Plain, warm, concrete. One thought per bite. Pitch every bite, the recap and the puzzles at the Level given with the request, the Feynman way.
- picture: a fallback diagram, used when scene is null or cannot be drawn. Pick the simplest diagram that shows the bite, and give its labels (2 to 5, each 1 to 3 words). flow = things in sequence, labels in order. compare = two sides, labels [left, right] or [left, right, what differs]. cycle = a loop, labels in order. layers = a stack from top to bottom. parts = a whole then its parts, first label is the whole. none = no diagram helps.
- quote: when notes are given, copy a short phrase (5 to 25 words) from the notes, word for word, that backs this bite up. With no notes, use "".
- puzzle: one quick check of that bite, answerable in a few seconds. Use a mix of kinds across the lesson, and make the last one the hardest.
  true_false: options ["True","False"], answer is one of them.
  choose: 3 options, answer is the right option, copied exactly.
  fill_gap: prompt is a sentence with ___ for the missing word or phrase, 3 options, answer is the right option.
  order: 3 or 4 steps; options and answer are both the steps in the right order.
  match: 3 pairs; options are the left items, answer the matching right items in the same order. Every left item and every right item must be different, because each one is a card the student taps once.
  why: one short sentence on why the answer is right.

Then recap (one sentence that ties the bites together, just as plain) and explainBack (the question Fenny, a curious student, asks when they return, in under 15 words).

Rules:
- Teach only what the notes say when notes are given. Never add facts the notes do not support. With no notes, stick to standard first-year university understanding.
- If the student said something wrong, the bites should quietly fix it without naming their mistake.
- British English. Proper sentences with ordinary punctuation. No dashes as pauses, no semicolons, no emoji, no markdown.
- Wrong options must be believable, never silly.

${SCENE_PROMPT}

${FILM_PROMPT}`;

const CLAUDE_SYSTEM = `${SYSTEM}

Write each scene as JSON text holding the scene object, for example {"family":"stairs","steps":["Seed","Shoot","Tree"],"at":2}, or the text null when no device fits.`;

const str = { type: "string" };
const strs = { type: "array", items: str };
export const LESSON_SCHEMA = {
  type: "object",
  properties: {
    // Chosen before the bites are written, so the writer plans three different
    // pictures instead of reaching for the same device each time.
    devices: { type: "array", items: { type: "string", enum: [...FAMILIES, "none"] } },
    bites: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: str,
          text: str,
          picture: {
            type: "object",
            properties: { kind: { type: "string", enum: [...PICTURES] }, labels: strs },
            required: ["kind", "labels"],
            additionalProperties: false,
          },
          scene: SCENE_SCHEMA,
          play: PLAY_SCHEMA,
          caption: str,
          film: FILM_SCHEMA,
          guess: GUESS_SCHEMA,
          quote: str,
          puzzle: {
            type: "object",
            properties: { kind: { type: "string", enum: [...PUZZLES] }, prompt: str, options: strs, answer: strs, why: str },
            required: ["kind", "prompt", "options", "answer", "why"],
            additionalProperties: false,
          },
        },
        required: ["title", "text", "picture", "scene", "play", "caption", "film", "guess", "quote", "puzzle"],
        additionalProperties: false,
      },
    },
    recap: str,
    explainBack: str,
  },
  required: ["devices", "bites", "recap", "explainBack"],
  additionalProperties: false,
} as const;

/**
 * Claude's structured output refuses a grammar as large as the fourteen scene
 * shapes, so Claude writes the scene as JSON text instead, and checkScene reads
 * it like any other scene. Everything else is the same schema.
 */
const biteItems = LESSON_SCHEMA.properties.bites.items;
export const CLAUDE_LESSON_SCHEMA = {
  ...LESSON_SCHEMA,
  properties: {
    ...LESSON_SCHEMA.properties,
    bites: { ...LESSON_SCHEMA.properties.bites, items: { ...biteItems, properties: { ...biteItems.properties, scene: str } } },
  },
} as const;

/** A scene written as JSON text (Claude) or as an object (OpenAI). */
function sceneOf(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

type Draft = { bites: (Omit<Bite, "fromNotes" | "scene" | "play" | "caption" | "film" | "guess"> & { scene?: unknown; play?: unknown; caption?: string; film?: unknown; guess?: unknown })[]; recap: string; explainBack: string };

/** Lower case, plain quotes, single spaces, no punctuation: for checking quotes against notes. */
function flat(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”'"`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function quoteInNotes(quote: string, notes?: string): boolean {
  const q = flat(quote);
  return !!notes && q.split(" ").length >= 3 && flat(notes).includes(q);
}

/** Checks the shape the model returned and fixes what is safe to fix. Throws on anything the app could not show. */
export function checkLesson(d: Draft, req: LessonRequest): Lesson {
  if (!Array.isArray(d.bites) || d.bites.length < 1) throw new Error("Lesson has no bites");
  const bites = d.bites.slice(0, 3).map((b, i): Bite => {
    const p = b.puzzle;
    const where = `bite ${i + 1}`;
    if (!p.options.length || !p.answer.length) throw new Error(`${where}: puzzle has no options`);
    if (p.kind === "true_false") {
      p.options = ["True", "False"];
      const a = /^t/i.test(p.answer[0]) ? "True" : "False";
      p.answer = [a];
    } else if (p.kind === "choose" || p.kind === "fill_gap") {
      if (!p.options.includes(p.answer[0])) throw new Error(`${where}: answer is not one of the options`);
      p.answer = [p.answer[0]];
      if (p.kind === "fill_gap" && !p.prompt.includes("___")) throw new Error(`${where}: fill_gap has no ___`);
    } else if (p.kind === "order") {
      if (p.options.length < 3) throw new Error(`${where}: order needs 3 steps`);
      p.answer = [...p.options];
    } else if (p.kind === "match") {
      if (p.options.length < 2 || p.options.length !== p.answer.length) throw new Error(`${where}: match pairs do not line up`);
      // Each side is a set of cards tapped once, so a repeat can't be matched.
      if (new Set(p.options).size !== p.options.length || new Set(p.answer).size !== p.answer.length) throw new Error(`${where}: match has repeated items, every card must be different`);
    }
    const scene = checkScene(sceneOf(b.scene));
    const film = checkFilm(b.film, b.text);
    return {
      ...b,
      scene,
      play: checkPlay(b.play, scene),
      caption: String(b.caption ?? "").trim(),
      quote: req.notes?.trim() ? b.quote : "",
      fromNotes: quoteInNotes(b.quote, req.notes),
      film,
      // A guess needs a picture to watch.
      guess: scene ? checkGuess(b.guess, film) : null,
    };
  });
  // One guess per lesson: a question to predict, not a quiz.
  let guessed = false;
  for (const b of bites) {
    if (b.guess && guessed) b.guess = null;
    if (b.guess) guessed = true;
  }
  // One slider per lesson keeps it a moment, not a game.
  let played = false;
  for (const b of bites) {
    if (b.play && played) b.play = null;
    if (b.play) played = true;
  }
  return { idea: req.idea, bites, recap: d.recap, explainBack: d.explainBack };
}

function userMessage(req: LessonRequest, retry?: string): string {
  const notes = req.notes?.trim();
  return [
    `Topic: ${req.topic}`,
    `The idea they need: ${req.idea}`,
    LEVEL_TEXT[req.level ?? "standard"],
    req.said?.trim() ? `What they tried to say: ${req.said.trim()}` : "",
    notes ? `<notes>\n${notes}\n</notes>` : "No notes. Use standard first-year university understanding.",
    retry ? `Your last try had a problem: ${retry} Please fix it.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export interface LessonResult {
  lesson: Lesson;
  model: string;
  cost: CostLine[];
}

/** Sonnet 5.5 prices per million tokens, checked 2026-11-06: $2 in, $0.20 cached in, $10 out. */
function claudePrices(env: Env, model: string) {
  const n = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);
  const base = CLAUDE_PRICES[model] ?? CLAUDE_PRICES["claude-sonnet-5-5"];
  return { in: n(env.CLAUDE_PRICE_IN, base.in), cachedIn: n(env.CLAUDE_PRICE_CACHED_IN, base.cachedIn), out: n(env.CLAUDE_PRICE_OUT, base.out) };
}

async function draftClaude(env: Env, req: LessonRequest, retry?: string, fetchImpl?: typeof fetch): Promise<{ draft: Draft; model: string; cost: CostLine }> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, ...(fetchImpl ? { fetch: fetchImpl } : {}), maxRetries: 1 });
  const model = env.LESSON_MODEL ?? "claude-sonnet-5-5";
  const r = await client.beta.messages.create({
    model,
    max_tokens: Number(env.LESSON_MAX_TOKENS) || 7000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // The instructions are the same for every lesson, so they are cached.
    system: [{ type: "text", text: CLAUDE_SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: (env.LESSON_EFFORT ?? "low") as "low" | "medium" | "high", format: { type: "json_schema", schema: CLAUDE_LESSON_SCHEMA } },
    messages: [{ role: "user", content: userMessage(req, retry) }],
  });
  if (r.stop_reason === "refusal") throw new Error("Claude declined to write this lesson");
  if (r.stop_reason === "max_tokens") throw new Error("Lesson ran out of room");
  const text = r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const p = claudePrices(env, model);
  const u = r.usage;
  const fresh = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) * 1.25;
  const cached = u.cache_read_input_tokens ?? 0;
  const usd = (fresh * p.in + cached * p.cachedIn + u.output_tokens * p.out) / 1e6;
  return {
    draft: JSON.parse(text) as Draft,
    model: r.model,
    cost: { label: `${r.model} lesson (${u.input_tokens} in, ${cached} cached, ${u.output_tokens} out)`, usd } as CostLine,
  };
}

async function draftOpenAI(env: Env, req: LessonRequest, retry?: string, fetchImpl?: typeof fetch): Promise<{ draft: Draft; model: string; cost: CostLine }> {
  const model = env.LESSON_OPENAI_MODEL ?? env.OPENAI_CHAT_MODEL ?? "gpt-5.4-mini";
  const r = await chatJSON<Draft>(
    { apiKey: env.OPENAI_API_KEY!, model, reasoningEffort: "low", fetchImpl },
    [
      { role: "developer", content: SYSTEM },
      { role: "user", content: userMessage(req, retry) },
    ],
    { name: "lesson", schema: LESSON_SCHEMA },
    8000,
  );
  const p = openAIPricesFromEnv(env);
  const cached = r.usage.prompt_tokens_details?.cached_tokens ?? 0;
  const fresh = Math.max(0, (r.usage.prompt_tokens ?? 0) - cached);
  const out = r.usage.completion_tokens ?? 0;
  const usd = (fresh * p.chatInPerM + cached * p.chatCachedInPerM + out * p.chatOutPerM) / 1e6;
  return { draft: r.value, model, cost: { label: `${model} lesson (${fresh} in, ${cached} cached, ${out} out)`, usd } as CostLine };
}

export function lessonBrain(env: Env): "claude" | "openai" {
  const chosen = env.LESSON_BRAIN?.toLowerCase();
  if (chosen === "claude" || chosen === "openai") return chosen;
  return env.ANTHROPIC_API_KEY ? "claude" : "openai";
}

const cache = new Map<string, LessonResult>();

/**
 * Builds a checked lesson. If the first try comes back broken, or with most
 * quotes missing from the notes, it asks once more with the problem named.
 */
export async function buildLesson(env: Env, req: LessonRequest, fetchImpl?: typeof fetch): Promise<LessonResult & { cached: boolean }> {
  const brain = lessonBrain(env);
  const key = createHash("sha256")
    .update([brain, req.level ?? "standard", req.topic.trim().toLowerCase(), req.idea.trim().toLowerCase(), req.notes?.trim() ?? ""].join("\0"))
    .digest("hex");
  const hit = cache.get(key);
  if (hit) return { ...hit, cached: true };

  let draft = brain === "claude" ? draftClaude : draftOpenAI;
  const cost: CostLine[] = [];
  let problem: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    let r: Awaited<ReturnType<typeof draftOpenAI>>;
    try {
      r = await draft(env, req, problem, fetchImpl);
    } catch (e) {
      // If Claude is down or its key is refused, the learner still gets a
      // lesson: switch to OpenAI for the rest of this request.
      if (draft !== draftClaude || !env.OPENAI_API_KEY) throw e;
      console.error("lesson: Claude failed, using OpenAI", (e as Error).message);
      draft = draftOpenAI;
      r = await draft(env, req, problem, fetchImpl);
    }
    cost.push(r.cost);
    try {
      const lesson = checkLesson(r.draft, req);
      const missing = lesson.bites.filter((b) => !b.fromNotes).length;
      if (req.notes?.trim() && missing > lesson.bites.length / 2 && attempt === 0) {
        problem = "Most quotes were not copied word for word from the notes.";
        continue;
      }
      const result = { lesson, model: r.model, cost };
      // Only lessons that do not depend on what this learner said are shared.
      if (!req.said?.trim()) cache.set(key, result);
      return { ...result, cached: false };
    } catch (e) {
      if (attempt === 1) throw e;
      problem = (e as Error).message + ".";
    }
  }
  throw new Error("Could not build a lesson");
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function handleLesson(req: Request, env: Env = process.env, fetchImpl?: typeof fetch): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "Use POST" });
  if (env.PROTOTYPE_TOKEN && req.headers.get("authorization") !== `Bearer ${env.PROTOTYPE_TOKEN}`) return json(401, { error: "Unauthorised" });
  let body: LessonRequest;
  try {
    body = (await req.json()) as LessonRequest;
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  if (!body.topic?.trim() || !body.idea?.trim()) return json(400, { error: "topic and idea are required" });
  if ((body.notes?.length ?? 0) > 200_000) return json(413, { error: "Notes are too long" });
  if (body.level !== undefined && !LEVELS.includes(body.level)) return json(400, { error: `level must be one of ${LEVELS.join(", ")}` });
  const brain = lessonBrain(env);
  if (brain === "claude" && !env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY) return json(500, { error: "ANTHROPIC_API_KEY is not set on the server" });
  if (brain === "openai" && !env.OPENAI_API_KEY) return json(500, { error: "OPENAI_API_KEY is not set on the server" });
  const t0 = Date.now();
  try {
    const r = await buildLesson(env, body, fetchImpl);
    const usd = r.cached ? 0 : r.cost.reduce((s, c) => s + c.usd, 0);
    return json(200, { lesson: r.lesson, model: r.model, cached: r.cached, cost: { lines: r.cached ? [] : r.cost, usd }, timingMs: Date.now() - t0 });
  } catch (e) {
    console.error("lesson", e);
    return json(502, { error: "Could not build the lesson. Please try again." });
  }
}

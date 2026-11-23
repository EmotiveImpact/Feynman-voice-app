import { NdjsonReader } from "@feynman/audio";
import type { PhonemeChunk } from "@feynman/kitten-tts";
import type { Play, Scene } from "./teach/scene/types";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";
const TOKEN = process.env.EXPO_PUBLIC_PROTOTYPE_TOKEN ?? "";

export interface Turn {
  speaker: "learner" | "student";
  text: string;
  /** For Fenny's lines: the move the server's engine made, handed back next turn so it keeps its place. */
  move?: string;
}

export interface TurnResponse {
  transcript: string;
  question: string;
  speech: PhonemeChunk[];
  audioSeconds: number;
  brain: "openai" | "gemini";
  cost: { pence: number; usd: number; lines: { label: string; pence: number }[] };
  timingMs: { brain: number; phonemes: number; transcribe?: number; chat?: number };
}

export async function sendTurn(input: {
  audioBase64: string;
  audioSeconds: number;
  history: Turn[];
  topic: string;
}, signal?: AbortSignal): Promise<TurnResponse> {
  if (!API_URL) throw new Error("Set EXPO_PUBLIC_API_URL in apps/mobile/.env");
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/turn`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ ...input, mimeType: "audio/wav" }),
    signal,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Server returned ${res.status}`);
  return body as TurnResponse;
}

// Live call mode -----------------------------------------------------------

export type LiveVoice = "phonon" | "sonic" | "kitten";
export type LiveEars = "auto" | "openai" | "cartesia";

export type LiveEvent =
  | { type: "transcript"; text: string }
  | { type: "sentence"; index: number; text: string; speech?: PhonemeChunk[]; audio?: string; sampleRate?: number }
  | {
      type: "done";
      /** The engine's move for this reply, when the engine answered. */
      move?: string;
      transcript: string;
      question: string;
      voice: LiveVoice;
      stt: "openai" | "cartesia";
      cost: { pence: number; usd: number; lines: { label: string; pence: number }[] };
      timingMs: { transcribe: number; brain: number; firstSentence: number; total: number };
    }
  | { type: "error"; error: string; detail?: string }
  /** Fenny's conversation engine: the move it made this turn. "wrap" is the goodbye. */
  | { type: "engine"; move: string; covered: string[]; ideas: { id: string; idea: string; label?: string }[]; verdict?: string }
  /** They clearly don't know this bit yet: show Teach me. */
  | { type: "teach_offer"; gap: { title: string } }
  /** They said yes to the offer: open teach mode now. */
  | { type: "teach"; gap: { title: string } };

/** Base URL of the Phonon model bundle the API serves for iPhones to download. */
export const PHONON_BUNDLE_URL = API_URL ? `${API_URL.replace(/\/$/, "")}/phonon/31m-en-0.6.0` : "";

/**
 * Send one finished turn and receive the reply as a stream of events, so the
 * student can start speaking its first sentence before the rest is written.
 */
export async function streamLiveTurn(
  input: {
    audioBase64: string;
    audioSeconds: number;
    history: Turn[];
    topic: string;
    voice: LiveVoice;
    ears: LiveEars;
    /** What this phone can handle. "wait": the server may say the learner isn't finished. */
    features?: string[];
    /** Their scanned notes on this topic, so Fenny can spot what they leave out. */
    notes?: string;
    /** A gap they are going back over, kept apart from the topic. */
    focus?: string;
  },
  onEvent: (e: LiveEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!API_URL) throw new Error("Set EXPO_PUBLIC_API_URL in apps/mobile/.env");
  const { ears, ...rest } = input;
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/live-turn`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ ...rest, mimeType: "audio/wav", ...(ears === "auto" ? {} : { stt: ears }) }),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Server returned ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const lines = new NdjsonReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    lines.push(decoder.decode(value, { stream: true }), (e) => onEvent(e as LiveEvent));
  }
  lines.flush((e) => onEvent(e as LiveEvent));
}

// Scanned notes -----------------------------------------------------------

export interface ReadPage {
  title: string;
  text: string;
  readable: boolean;
  cost: { usd: number; pence: number };
}

/** Read one scanned page (base64 JPEG) on the server: handwriting, handouts, slides. */
export async function readPage(imageBase64: string, topic?: string, signal?: AbortSignal): Promise<ReadPage> {
  if (!API_URL) throw new Error("Set EXPO_PUBLIC_API_URL in apps/mobile/.env");
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/read-page`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ image: imageBase64, topic }),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Server returned ${res.status}`);
  return body as ReadPage;
}

// Teach me -----------------------------------------------------------------

export type PictureKind = "flow" | "compare" | "cycle" | "layers" | "parts" | "none";
export type PuzzleKind = "true_false" | "choose" | "fill_gap" | "order" | "match";

export interface LessonPuzzle {
  kind: PuzzleKind;
  prompt: string;
  options: string[];
  answer: string[];
  why: string;
}

export interface LessonBite {
  title: string;
  text: string;
  picture: { kind: PictureKind; labels: string[] };
  /** A live drawing from the kit, or null (older servers leave it out). */
  scene?: Scene | null;
  /** A slider that changes the scene, on at most one bite. */
  play?: Play | null;
  /** One short sentence under the drawing that states its point. */
  caption?: string;
  quote: string;
  fromNotes: boolean;
  puzzle: LessonPuzzle;
  /** What Fenny says while the drawing builds, one sentence per part (older servers leave it out). */
  film?: { say: string; cue: string }[];
  /** "What happens next?", asked before the last sentence, on at most one bite. */
  guess?: { ask: string; options: string[]; answer: string } | null;
}

export interface Lesson {
  idea: string;
  bites: LessonBite[];
  recap: string;
  explainBack: string;
}

/** A short lesson on one idea the learner is stuck on, built on the server from their notes. */
/** How simply a lesson explains: a five year old, a bright 12 year old, or university level. */
export type LessonLevel = "simple" | "standard" | "deep";

export async function fetchLesson(input: { topic: string; idea: string; notes?: string; said?: string; level?: LessonLevel }, signal?: AbortSignal): Promise<Lesson> {
  if (!API_URL) throw new Error("Set EXPO_PUBLIC_API_URL in apps/mobile/.env");
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/lesson`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(input),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Server returned ${res.status}`);
  return (body as { lesson: Lesson }).lesson;
}

/** One line in Fenny's voice, without a turn (the opening question, a lesson bite). */
export async function speakLine(
  input: { text: string; voice: LiveVoice },
  signal?: AbortSignal,
): Promise<{ text: string; audio?: string; sampleRate?: number; speech?: PhonemeChunk[] }> {
  if (!API_URL) throw new Error("Set EXPO_PUBLIC_API_URL in apps/mobile/.env");
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/speak`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(input),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Server returned ${res.status}`);
  return body as { text: string; audio?: string; sampleRate?: number; speech?: PhonemeChunk[] };
}

// Teach me this thing -------------------------------------------------------

export interface LookAngle {
  /** One of the learner's subjects, or "everyday". */
  subject: string;
  /** Fenny's opening question: curious, naive, asks them to explain. */
  question: string;
  /** The topic card title. */
  topic: string;
}

export interface Look {
  thing: string;
  clear: boolean;
  retry: string;
  reaction: string;
  angles: LookAngle[];
}

/** One photo of a real thing: what it is and how Fenny would ask about it, for these subjects. */
export async function lookAt(input: { image: string; subjects: string[]; guess?: string }, signal?: AbortSignal): Promise<Look> {
  if (!API_URL) throw new Error("Set EXPO_PUBLIC_API_URL in apps/mobile/.env");
  const res = await fetch(`${API_URL.replace(/\/$/, "")}/api/look`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(input),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Server returned ${res.status}`);
  return (body as { look: Look }).look;
}

// After the call -------------------------------------------------------------

export interface Strength {
  title: string;
  /** Their own words from the call. */
  quote: string;
}

export interface Gap {
  kind: "gap" | "skipped" | "muddled";
  title: string;
  detail: string;
  source: string;
  /** The one they named themselves when asked which bit felt shakiest. */
  named: boolean;
  /** For "muddled": the right version, so a misconception is never left standing. */
  correction?: string;
}

export interface Analysis {
  strengths: Strength[];
  gaps: Gap[];
  thenAndNow: { then: string; now: string } | null;
  focusExplained: boolean;
  pence: number;
}

async function postJson<T>(path: string, body: object, signal?: AbortSignal): Promise<T> {
  if (!API_URL) throw new Error("Set EXPO_PUBLIC_API_URL in apps/mobile/.env");
  const res = await fetch(`${API_URL.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
    signal,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((out as { error?: string }).error ?? `Server returned ${res.status}`);
  return out as T;
}

/** What came across clearly and where the gaps are, from the call's transcript. */
export function analyseCall(
  input: { topic: string; goal?: string; notes?: string; turns: Turn[]; shakiest?: string; firstAttempt?: string; focus?: string; missedIdeas?: string[] },
  signal?: AbortSignal,
): Promise<Analysis> {
  return postJson("/api/analyse", input, signal);
}

/** A short explanation of one gap, from their notes when they have added some. */
export function showMe(
  input: { topic: string; gap: { title: string; detail?: string }; notes?: string; turns?: Turn[] },
  signal?: AbortSignal,
): Promise<{ explanation: string; fromNotes: boolean }> {
  return postJson("/api/show-me", input, signal);
}

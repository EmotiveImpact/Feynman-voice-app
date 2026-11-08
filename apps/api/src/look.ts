// POST /api/look: "Teach me this thing". The learner points the camera at a
// real object; this names it and writes the curious question Fenny opens
// with, picked to fit the learner's subjects. Fenny never explains: the
// question asks the learner to do the explaining.
//
// Request:  { image: base64 JPEG, subjects?: string[], guess?: string }
//           guess = what an on-device model (Cactus Mirage, later) thinks it is.
// Response: { look: Look, model, cost, timingMs }
//
// Server vision (gpt-5.4-mini) for now. Mirage has no React Native package
// yet; when it does, the phone can react instantly and send its guess here
// to be confirmed.
import { chatPricesFor, type CostLine } from "./pricing";
import { chatJSON, hasKeyFor, modelFor } from "./engine/chat";

type Env = Record<string, string | undefined>;

/** About 3 MB of JPEG once decoded: well under Vercel's 4.5 MB body limit. */
const MAX_BASE64 = 4_000_000;

export interface LookAngle {
  /** Which of the learner's subjects this angle comes from, or "everyday". */
  subject: string;
  /** Fenny's opening question, curious and naive, asking them to explain. */
  question: string;
  /** A short topic card title, e.g. "How a bike chain drives the wheel". */
  topic: string;
}

export interface Look {
  /** What it is, in a few plain words, e.g. "bike chain". "" when unclear. */
  thing: string;
  /** False when the photo is too dark, blurred, or shows nothing to explain. */
  clear: boolean;
  /** A friendly line for when it is not clear, e.g. "It's a bit dark. Try again near a light?" */
  retry: string;
  /** Fenny's first reaction, before the question, e.g. "A bike chain, nice!" */
  reaction: string;
  /** Two or three angles, best first, each tied to a different subject where possible. */
  angles: LookAngle[];
}

export const LOOK_SYSTEM = `You are the eyes of Fenny, a curious student in a learning app for UK university students. The app uses the Feynman Technique: the learner explains, Fenny asks naive questions, and Fenny never explains anything itself.

The learner has pointed their camera at something real and wants to teach Fenny about it. Look at the photo and:

1. thing: name the main object in a few plain words (for example "bike chain", "centrifuge", "kettle", "oak leaf", "suspension bridge"). If it is a diagram, poster or whiteboard, name what it shows ("diagram of the heart").
2. clear: false if the photo is too dark, too blurred, or shows nothing worth explaining. Then give a short, kind retry line and leave angles empty.
3. reaction: Fenny's first reaction in under 8 words, warm and curious, in your own words for this exact thing, like "A bike chain, nice!", "Oh, I've always wondered about these." or "Wait, is that a centrifuge?" Vary it. Never say "Ooh". No question here.
4. angles: 2 or 3 different ways in, best first. Each has:
   - subject: one of the learner's subjects that genuinely fits, or "everyday" if none do. Use a different subject for each angle where you can. A biologist and a physicist looking at the same tree should get different questions.
   - question: what Fenny asks to get the learner explaining. Under 22 words. Curious, a little naive, about how or why it works, never a quiz with one right word. It must not contain the answer or any hint of it.
   - topic: a topic card title in under 8 words, like "How a bike chain drives the wheel".

Rules:
- Never explain the thing, and never put facts about how it works in any field.
- People: never identify or guess who a person is, and never comment on their looks. If a person is the main subject, pick an object, a body part in general terms, or the activity instead, or mark it not clear.
- If it is something unsafe to touch or poke (a plug socket, a hot hob, a chemical), keep the questions about how it works, never about trying things.
- British English. Plain punctuation. No dashes as pauses, no semicolons, no emoji, no markdown.`;

const str = { type: "string" };
export const LOOK_SCHEMA = {
  type: "object",
  properties: {
    thing: str,
    clear: { type: "boolean" },
    retry: str,
    reaction: str,
    angles: {
      type: "array",
      items: {
        type: "object",
        properties: { subject: str, question: str, topic: str },
        required: ["subject", "question", "topic"],
        additionalProperties: false,
      },
    },
  },
  required: ["thing", "clear", "retry", "reaction", "angles"],
  additionalProperties: false,
} as const;

/** Spoken lines must not pause on dashes (see speakable.ts); keep the card tidy too. */
function tidy(s: unknown, max: number): string {
  return String(s ?? "")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Checks the model's answer and trims what is safe to trim. */
export function checkLook(raw: Partial<Look>, subjects: string[] = []): Look {
  // Use the learner's own spelling of their subject, so the app can match it.
  const own = (s: string) => subjects.find((x) => x.trim().toLowerCase() === s.toLowerCase())?.trim() ?? (s.toLowerCase() === "everyday" ? "everyday" : s);
  const angles = (Array.isArray(raw.angles) ? raw.angles : [])
    .map((a) => ({ subject: own(tidy(a?.subject, 40)) || "everyday", question: tidy(a?.question, 200), topic: tidy(a?.topic, 70) }))
    .filter((a) => a.question && a.topic)
    .slice(0, 3);
  const clear = !!raw.clear && angles.length > 0;
  return {
    thing: clear ? tidy(raw.thing, 60) : "",
    clear,
    retry: clear ? "" : tidy(raw.retry, 140) || "I couldn't quite see it. Try again a bit closer?",
    reaction: tidy(raw.reaction, 80),
    angles: clear ? angles : [],
  };
}

export function userText(subjects: string[], guess?: string): string {
  const s = subjects.map((x) => x.trim()).filter(Boolean).slice(0, 6);
  return [
    s.length ? `The learner studies: ${s.join(", ")}.` : "The learner hasn't told us their subjects.",
    guess?.trim() ? `A quick on-device guess says this is "${guess.trim().slice(0, 60)}". It may be wrong, so trust the photo.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function lookAt(
  env: Env,
  input: { image: string; subjects: string[]; guess?: string },
  fetchImpl?: typeof fetch,
): Promise<{ look: Look; model: string; cost: CostLine[] }> {
  const model = modelFor(env, env.LOOK_MODEL);
  let r;
  try {
    r = await chatJSON<Partial<Look>>(
      { apiKey: env.OPENAI_API_KEY ?? "", anthropicKey: env.ANTHROPIC_API_KEY, model, reasoningEffort: env.LOOK_EFFORT ?? "low", fetchImpl },
      [
        { role: "developer", content: LOOK_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: userText(input.subjects, input.guess) },
            // "low" detail is one small tile on OpenAI: plenty to name an object, and cheap.
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${input.image}`, detail: env.LOOK_DETAIL ?? "low" } },
          ],
        },
      ],
      { name: "look", schema: LOOK_SCHEMA },
      1200,
    );
  } catch (e) {
    if (e instanceof Error && /declined/.test(e.message)) throw new Error("The model declined this photo");
    throw e;
  }
  const look = checkLook(r.value, input.subjects);
  const u = r.usage;
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  const fresh = Math.max(0, (u.prompt_tokens ?? 0) - cached);
  const out = u.completion_tokens ?? 0;
  const p = chatPricesFor(model, env);
  const usd = (fresh * p.chatInPerM + cached * p.chatCachedInPerM + out * p.chatOutPerM) / 1e6;
  return { look, model, cost: [{ label: `${model} look (${fresh} in, ${cached} cached, ${out} out)`, usd } as CostLine] };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function handleLook(req: Request, env: Env = process.env, fetchImpl?: typeof fetch): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "Use POST" });
  if (env.PROTOTYPE_TOKEN && req.headers.get("authorization") !== `Bearer ${env.PROTOTYPE_TOKEN}`) return json(401, { error: "Unauthorised" });
  let body: { image?: string; subjects?: unknown; guess?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  const image = (body.image ?? "").replace(/^data:image\/\w+;base64,/, "");
  if (!image) return json(400, { error: "image is required" });
  if (image.length > MAX_BASE64) return json(413, { error: "Photo is too big" });
  if (!hasKeyFor(env, modelFor(env, env.LOOK_MODEL))) return json(500, { error: "No AI key is set on the server" });
  const subjects = Array.isArray(body.subjects) ? body.subjects.filter((s): s is string => typeof s === "string") : [];
  const t0 = Date.now();
  try {
    const r = await lookAt(env, { image, subjects, guess: body.guess }, fetchImpl);
    const usd = r.cost.reduce((s, c) => s + c.usd, 0);
    return json(200, { look: r.look, model: r.model, cost: { lines: r.cost, usd }, timingMs: Date.now() - t0 });
  } catch (e) {
    console.error("look", e);
    return json(502, { error: "Fenny couldn't see that one. Please try again." });
  }
}

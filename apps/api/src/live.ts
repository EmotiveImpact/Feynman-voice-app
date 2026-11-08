// POST /api/live-turn: the streamed turn behind live call mode.
//
// The phone sends one finished turn of the learner's speech. The reply is a
// stream of newline-separated JSON events, so the phone can start speaking
// the first sentence while the brain is still writing the rest:
//
//   {"type":"transcript","text":"..."}
//   {"type":"sentence","index":0,"text":"...","speech":[...]}            voice "kitten": phonemes for the phone
//   {"type":"sentence","index":0,"text":"...","audio":"<base64>",...}    voice "sonic": 16-bit PCM from Cartesia
//   {"type":"sentence","index":0,"text":"..."}                           voice "phonon": the phone speaks it
//   {"type":"engine","move":"wait"}                                     the learner stopped mid-thought: no sentence, keep listening
//   {"type":"done","question":"...","cost":{...},"timingMs":{...}}
//   {"type":"error","error":"..."}                                       instead of done, if something fails
import { askStudent, GeminiError, type PastTurn } from "./gemini";
import { speakSonic, SONIC_SAMPLE_RATE, transcribeCartesia } from "./cartesia";
import { ProviderError, transcribeOpenAI } from "./openai";
import { chatPricesFor, costOf, openAIPricesFromEnv, pricesFromEnv, wavSeconds, type CostLine } from "./pricing";
import { notesBlock, STUDENT_SYSTEM_PROMPT } from "./prompt";
import { SentenceSplitter } from "./sentences";
import { speakable } from "./speakable";
import { toSpeechChunks } from "./speech";
import { engineTurn, pickFresh, seedOf } from "./engine/engine";
import { keyIdeas } from "./engine/ideas";
import { unfinished } from "./engine/policy";
import { hasKeyFor, modelFor } from "./engine/chat";

const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
const ALLOWED_MIME = new Set(["audio/wav", "audio/x-wav", "audio/aac", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/flac", "audio/webm"]);
export const VOICES = ["phonon", "sonic", "kitten"] as const;
export type Voice = (typeof VOICES)[number];

export interface LiveTurnRequest {
  audioBase64: string;
  mimeType: string;
  audioSeconds: number;
  history?: PastTurn[];
  topic?: string;
  notes?: string;
  /** Who speaks the student's reply. Defaults to "phonon". */
  voice?: Voice;
  /** Who hears the learner, for side-by-side tests. Defaults to the server's choice. */
  stt?: "cartesia" | "openai";
  /** What this phone can do, e.g. "show_me" for the in-call explanation card. */
  features?: string[];
  /**
   * A gap the learner is going back over (a call opened from a gap card). Kept
   * apart from topic so the topic's key ideas, cached by topic, stay the same.
   */
  focus?: string;
}

type Env = Record<string, string | undefined>;
type Event = Record<string, unknown> & { type: string };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** Which service hears the learner. Cartesia Ink once a key is set, OpenAI until then. */
/** One cost line for a chat call made by the engine. */
function engineCost(model: string, u: ChatUsage, p: ReturnType<typeof openAIPricesFromEnv>): CostLine {
  const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
  const freshIn = Math.max(0, (u.prompt_tokens ?? 0) - cached);
  const out = u.completion_tokens ?? 0;
  return {
    label: `${model} engine (${freshIn} in, ${cached} cached, ${out} out)`,
    usd: (freshIn * p.chatInPerM + cached * p.chatCachedInPerM + out * p.chatOutPerM) / 1e6,
  };
}

export function sttProvider(env: Env): "cartesia" | "openai" {
  const chosen = env.STT?.toLowerCase();
  if (chosen === "cartesia" || chosen === "openai") return chosen;
  return env.CARTESIA_API_KEY ? "cartesia" : "openai";
}

export async function handleLiveTurn(req: Request, env: Env = process.env, fetchImpl?: typeof fetch): Promise<Response> {
  if (req.method !== "POST") return json(405, { error: "Use POST" });
  if (env.PROTOTYPE_TOKEN && req.headers.get("authorization") !== `Bearer ${env.PROTOTYPE_TOKEN}`) {
    return json(401, { error: "Missing or wrong prototype token" });
  }
  const brain = (env.BRAIN ?? "openai").toLowerCase();
  if (brain !== "openai" && brain !== "gemini") return json(500, { error: `Unknown BRAIN ${brain}` });
  const fennyModelChoice = modelFor(env, env.FENNY_MODEL);
  if (brain === "openai" && !hasKeyFor(env, fennyModelChoice)) return json(500, { error: `No key on the server for ${fennyModelChoice}` });
  if (brain === "gemini" && !env.GEMINI_API_KEY) return json(500, { error: "GEMINI_API_KEY is not set on the server" });
  let body: LiveTurnRequest;
  try {
    body = (await req.json()) as LiveTurnRequest;
  } catch {
    return json(400, { error: "Body must be JSON" });
  }
  const stt = body.stt === "cartesia" || body.stt === "openai" ? body.stt : sttProvider(env);
  if (stt === "cartesia" && !env.CARTESIA_API_KEY) return json(400, { error: "Cartesia ears need CARTESIA_API_KEY on the server" });
  if (stt === "openai" && !env.OPENAI_API_KEY) return json(400, { error: "OpenAI ears need OPENAI_API_KEY on the server" });
  if (!body.audioBase64 || typeof body.audioBase64 !== "string") return json(400, { error: "audioBase64 is required" });
  if (!ALLOWED_MIME.has(body.mimeType)) return json(400, { error: `Unsupported mimeType ${body.mimeType}` });
  if (body.audioBase64.length * 0.75 > MAX_AUDIO_BYTES) return json(413, { error: "Turn is too long. Keep it under a minute." });
  const voice: Voice = VOICES.includes(body.voice as Voice) ? (body.voice as Voice) : "phonon";
  if (voice === "sonic" && !env.CARTESIA_API_KEY) return json(400, { error: "The Sonic voice needs CARTESIA_API_KEY on the server" });

  const audio = Uint8Array.from(Buffer.from(body.audioBase64, "base64"));
  const speakingSeconds = Number(body.audioSeconds) || 0;
  const recordedSeconds = wavSeconds(audio) ?? speakingSeconds;
  // The engine works out where the call is from the whole call; the model
  // only sees the recent turns.
  const callHistory = (body.history ?? []).slice(-100);
  const history = callHistory.slice(-20);
  const f = fetchImpl ?? fetch;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: Event) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      const t0 = Date.now();
      const timing: Record<string, number> = {};
      const lines: CostLine[] = [];
      const p = openAIPricesFromEnv(env);
      const credit = Number(env.CARTESIA_USD_PER_CREDIT) || 0.00003;
      const useEngine = brain === "openai" && (env.FENNY_ENGINE ?? "on") !== "off";
      // Fenny's engine can run on another model, e.g. FENNY_MODEL=claude-haiku-5-5.
      // With a Claude key on the server it defaults to Claude Haiku.
      const fennyModel = fennyModelChoice;
      const fp = chatPricesFor(fennyModel, env);
      const chatCfg = { apiKey: env.OPENAI_API_KEY!, anthropicKey: env.ANTHROPIC_API_KEY, model: fennyModel, reasoningEffort: env.OPENAI_REASONING_EFFORT ?? "none", fetchImpl: f };
      // The topic's key ideas, built while we listen (cached after the first turn).
      // Fenny's line knows the focus; the key ideas are built from the topic alone.
      const focus = typeof body.focus === "string" ? body.focus.trim().slice(0, 300) : "";
      const talkTopic = focus ? `${body.topic ?? ""}. They are going back over one part they found shaky, so ask about it: ${focus}` : body.topic;
      const ideasReady = useEngine ? keyIdeas(chatCfg, body.topic?.trim() || "a topic of their choice", body.notes) : undefined;
      ideasReady?.catch(() => {});
      try {
        // 1. Hear the learner.
        let transcript: string;
        if (stt === "cartesia") {
          transcript = (await transcribeCartesia({ apiKey: env.CARTESIA_API_KEY!, fetchImpl: f }, audio, body.mimeType)).text;
          lines.push({ label: `Cartesia Ink (${recordedSeconds.toFixed(1)}s audio)`, usd: recordedSeconds * credit });
        } else {
          const model = env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe";
          transcript = (await transcribeOpenAI({ apiKey: env.OPENAI_API_KEY!, transcribeModel: model, fetchImpl: f }, audio, body.mimeType)).text;
          lines.push({ label: `${model} (${recordedSeconds.toFixed(1)}s audio)`, usd: (recordedSeconds / 60) * p.transcribeUsdPerMin });
        }
        timing.transcribe = Date.now() - t0;
        send({ type: "transcript", text: transcript });

        // 2. Voice each sentence as soon as it exists, in order.
        let index = 0;
        let voiced: Promise<void> = Promise.resolve();
        let firstSentenceMs: number | undefined;
        let sonicChars = 0;
        const speak = (raw: string) => {
          // Every voice gets the same clean line: no dashes or symbols.
          const text = speakable(raw);
          if (!text) return;
          const i = index++;
          firstSentenceMs ??= Date.now() - t0;
          const work =
            voice === "sonic"
              ? speakSonic({ apiKey: env.CARTESIA_API_KEY!, voiceId: env.SONIC_VOICE_ID ?? "62ae83ad-4f6a-430b-af41-a9bede9286ca", model: env.SONIC_MODEL, speed: env.SONIC_SPEED ? Number(env.SONIC_SPEED) : undefined, fetchImpl: f }, text).then(
                  (pcm) => {
                    sonicChars += text.length;
                    return { audio: Buffer.from(pcm).toString("base64"), sampleRate: SONIC_SAMPLE_RATE, encoding: "pcm_s16le" };
                  },
                )
              : voice === "kitten"
                ? toSpeechChunks(text).then((speech) => ({ speech }))
                : Promise.resolve({});
          // Start the voice work now, but send events in sentence order. The
          // empty catches only mark the promises as handled: a failure still
          // surfaces at `await voiced` below.
          work.catch(() => {});
          voiced = voiced.then(async () => send({ type: "sentence", index: i, text, ...(await work) }));
          voiced.catch(() => {});
        };

        // 3. Ask the question, streaming.
        const t1 = Date.now();
        let question: string;
        /** The engine's move, sent back in "done" so the phone can hand it back next turn. */
        let engineMove: string | undefined;
        // The learner stopped mid-thought: keep listening instead of answering.
        // A phone that sends "wait" holds the turn and resends it longer;
        // older phones get a short nudge to carry on.
        const holdOn = useEngine && unfinished(transcript);
        const wantsWait = (body.features ?? []).includes("wait");
        let waited = false;
        if (holdOn && wantsWait) {
          const { usage: ideasUsage } = await ideasReady!;
          if (ideasUsage) lines.push(engineCost(fennyModel, ideasUsage, fp));
          question = "";
          waited = true;
          send({ type: "engine", move: "wait" });
        } else if (holdOn) {
          const { ideas, usage: ideasUsage } = await ideasReady!;
          if (ideasUsage) lines.push(engineCost(fennyModel, ideasUsage, fp));
          const mine = history.filter((t) => t.speaker === "student").map((t) => t.text);
          question = pickFresh(["Go on.", "Keep going.", "Mm, carry on.", "I'm listening."], mine.slice(-4), seedOf(transcript));
          engineMove = "listen";
          speak(question);
          send({ type: "engine", move: "listen", covered: [], ideas });
        } else if (useEngine) {
          // Fenny's conversation engine: code picks the allowed moves, the model
          // picks one and says one line, the line is checked, then spoken.
          const { ideas, usage: ideasUsage } = await ideasReady!;
          const r = await engineTurn(chatCfg, {
            transcript,
            history,
            callHistory,
            topic: talkTopic,
            notes: body.notes,
            ideas,
            limits: { canShowMe: (body.features ?? []).includes("show_me"), canTeach: (body.features ?? []).includes("teach") },
          });
          question = r.say;
          engineMove = r.move;
          // Sentence by sentence, so the phone can leave a breath between a
          // reaction ("Oh, nice.") and the question that follows it.
          // Even a short reaction gets its own piece here, so it lands on its own.
          const lineSplitter = new SentenceSplitter(4);
          [...lineSplitter.push(question + " "), ...lineSplitter.flush()].forEach(speak);
          send({ type: "engine", move: r.move, covered: r.covered, ideas: r.ideas, verdict: r.verdict });
          if (r.move === "show_me" && r.gap) send({ type: "show_me", gap: r.gap });
          // Teach me: the phone shows the button on an offer, and opens teach mode on "teach".
          if ((r.move === "offer_teach" || r.move === "teach") && r.gap) send({ type: r.move === "teach" ? "teach" : "teach_offer", gap: r.gap });
          for (const u of ideasUsage ? [ideasUsage, ...r.usage] : r.usage) lines.push(engineCost(fennyModel, u, fp));
        } else if (brain === "openai") {
          const splitter = new SentenceSplitter();
          const r = await streamQuestionOpenAI(
            {
              apiKey: env.OPENAI_API_KEY!,
              model: env.OPENAI_CHAT_MODEL ?? "gpt-5.4-mini",
              reasoningEffort: env.OPENAI_REASONING_EFFORT ?? "none",
              fetchImpl: f,
            },
            { transcript, history, topic: talkTopic, notes: body.notes },
            (delta) => splitter.push(delta).forEach(speak),
          );
          splitter.flush().forEach(speak);
          question = r.text;
          const u = r.usage;
          const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
          const freshIn = Math.max(0, (u.prompt_tokens ?? 0) - cached);
          const out = u.completion_tokens ?? 0;
          lines.push({
            label: `${env.OPENAI_CHAT_MODEL ?? "gpt-5.4-mini"} (${freshIn} in, ${cached} cached, ${out} out)`,
            usd: (freshIn * p.chatInPerM + cached * p.chatCachedInPerM + out * p.chatOutPerM) / 1e6,
          });
        } else {
          // Gemini is not streamed yet: send the whole question as one piece.
          const r = await askStudent(
            { apiKey: env.GEMINI_API_KEY!, model: env.GEMINI_MODEL ?? "gemini-3.8-flash", thinkingLevel: env.GEMINI_THINKING_LEVEL, fetchImpl: f },
            { audioBase64: body.audioBase64, mimeType: body.mimeType, history, topic: talkTopic, notes: body.notes },
          );
          question = r.question;
          const splitter = new SentenceSplitter();
          [...splitter.push(question + " "), ...splitter.flush()].forEach(speak);
          const c = costOf(r.usage, pricesFromEnv(env));
          lines.push({ label: `Gemini (${c.audioInTokens} audio in, ${c.textInTokens} text in, ${c.outTokens} out)`, usd: c.usd });
        }
        if (index === 0 && !waited) speak(speakable(question) || "Sorry, could you say that again?");
        timing.brain = Date.now() - t1;
        await voiced;
        if (sonicChars) lines.push({ label: `Cartesia Sonic (${sonicChars} characters)`, usd: sonicChars * credit });

        const gbpPerUsd = pricesFromEnv(env).gbpPerUsd;
        const usd = lines.reduce((n, l) => n + l.usd, 0);
        const pence = usd * gbpPerUsd * 100;
        send({
          type: "done",
          transcript,
          question: waited ? "" : speakable(question) || "Sorry, could you say that again?",
          ...(engineMove ? { move: engineMove } : {}),
          voice,
          stt,
          brain,
          audioSeconds: speakingSeconds,
          recordedSeconds,
          cost: {
            usd,
            pence,
            lines: lines.map((l) => ({ ...l, pence: l.usd * gbpPerUsd * 100 })),
            pencePerLearnerMinute: speakingSeconds > 0 ? pence / (speakingSeconds / 60) : null,
          },
          timingMs: { ...timing, firstSentence: firstSentenceMs ?? 0, total: Date.now() - t0 },
        });
      } catch (e) {
        const detail = e instanceof ProviderError || e instanceof GeminiError ? e.detail : undefined;
        if (!(e instanceof ProviderError || e instanceof GeminiError)) console.error(e);
        send({ type: "error", error: e instanceof Error ? e.message : String(e), detail });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" },
  });
}

interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
}

/** The live student's instructions: the same rules, but plain text out, so it can stream. */
export function liveSystemPrompt(topic?: string, notes?: string): string {
  return (
    STUDENT_SYSTEM_PROMPT.replace(/\n\nAlso return a faithful transcript[^]*$/, "") +
    "\n\nYou receive a transcript of what they said, so ignore small transcription slips." +
    "\nReply with only the words you would say out loud. This is a live voice call." +
    (topic ? `\n\nThe topic they are explaining: ${topic}` : "") +
    notesBlock(notes)
  );
}

/** Ask gpt-5.4-mini for the question and pass the text on as it streams in. */
export async function streamQuestionOpenAI(
  cfg: { apiKey: string; model: string; reasoningEffort?: string; fetchImpl?: typeof fetch },
  input: { transcript: string; history: PastTurn[]; topic?: string; notes?: string },
  onDelta: (text: string) => void,
): Promise<{ text: string; usage: ChatUsage }> {
  const f = cfg.fetchImpl ?? fetch;
  const body: Record<string, unknown> = {
    model: cfg.model,
    stream: true,
    stream_options: { include_usage: true },
    max_completion_tokens: 300,
    messages: [
      { role: "developer", content: liveSystemPrompt(input.topic, input.notes) },
      ...input.history.map((t) => ({ role: t.speaker === "learner" ? "user" : "assistant", content: t.text })),
      { role: "user", content: input.transcript || "(silence)" },
    ],
  };
  if (cfg.reasoningEffort) body.reasoning_effort = cfg.reasoningEffort;
  const res = await f("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) throw new ProviderError("OpenAI chat", res.status, (await res.text()).slice(0, 500));

  let text = "";
  let usage: ChatUsage = {};
  const decoder = new TextDecoder();
  let pending = "";
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += decoder.decode(value, { stream: true });
    const lines = pending.split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (!data || data === "[DONE]") continue;
      const chunk = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; usage?: ChatUsage };
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        text += delta;
        onDelta(delta);
      }
      if (chunk.usage) usage = chunk.usage;
    }
  }
  return { text: text.trim(), usage };
}

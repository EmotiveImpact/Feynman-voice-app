// Real-cost check on Claude: a simulated 10-turn call (Fenny on Haiku), three
// lessons (Sonnet), and a gap analysis (Haiku). Prints pence per thing.
//   ANTHROPIC_API_KEY=... npx tsx scripts/claude-cost-check.ts
import { chatJSON, type ChatCfg } from "../src/engine/chat";
import { engineTurn } from "../src/engine/engine";
import { buildLesson } from "../src/lesson";
import { handleAnalyse } from "../src/review";
import { chatPricesFor } from "../src/pricing";
import type { PastTurn } from "../src/gemini";

const env = { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY! } as Record<string, string | undefined>;
const GBP = 0.76;
const fenny: ChatCfg = { apiKey: "", anthropicKey: env.ANTHROPIC_API_KEY, model: process.env.FENNY_MODEL ?? "claude-haiku-5-5", reasoningEffort: "none" };
const pence = (model: string, u: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } }) => {
  const p = chatPricesFor(model, {});
  const c = u.prompt_tokens_details?.cached_tokens ?? 0;
  return ((Math.max(0, (u.prompt_tokens ?? 0) - c) * p.chatInPerM + c * p.chatCachedInPerM + (u.completion_tokens ?? 0) * p.chatOutPerM) / 1e6) * GBP * 100;
};

async function call(topic: string, turns: number) {
  const history: PastTurn[] = [];
  let p = 0, ms = 0, words = 0;
  let said = `So ${topic}, let me try to explain it from the start.`;
  for (let i = 0; i < turns; i++) {
    const t0 = Date.now();
    const r = await engineTurn(fenny, { transcript: said, history: history.slice(-20), callHistory: history, topic });
    ms += Date.now() - t0;
    for (const u of r.usage) p += pence(fenny.model, u);
    words += said.split(/\s+/).length;
    history.push({ speaker: "learner", text: said }, { speaker: "student", text: r.say } as PastTurn);
    console.log(`  Fenny [${r.move}]: ${r.say}`);
    // The simulated learner (Haiku too, not counted in Fenny's cost).
    const l = await chatJSON<{ say: string }>(
      { ...fenny, model: "claude-haiku-5-5" },
      [
        { role: "developer", content: `You are a UK university student explaining ${topic} out loud to a curious friend. You half understand it. Reply in 40 to 90 spoken words, natural, sometimes unsure.` },
        ...history.map((h) => ({ role: h.speaker === "learner" ? "assistant" : "user", content: h.text })),
      ],
      { name: "s", schema: { type: "object", properties: { say: { type: "string" } }, required: ["say"], additionalProperties: false } },
    );
    said = l.value.say;
  }
  // Speaking at about 150 words a minute, plus Fenny's lines and pauses: about 1 minute per 2 turns.
  const minutes = words / 150 + turns * 0.15;
  return { p, ms: ms / turns, minutes };
}

const lessonCases = [
  { topic: "Osmosis", idea: "Why water moves towards the side with more solute", said: "Water moves to where there is less stuff dissolved." },
  { topic: "Supply and demand", idea: "What happens to price and quantity when demand rises", said: "If more people want it the price goes up and less gets sold." },
  { topic: "Photosynthesis", idea: "Why plants need light for the light-dependent reactions", said: "Light gives them energy I think, to make sugar." },
];

const main = async () => {
  console.log("CALL (Fenny on", fenny.model + ")");
  const c = await call("osmosis", 10);
  console.log(`  brain: ${c.p.toFixed(3)}p for 10 turns, ~${c.minutes.toFixed(1)} min => ${(c.p / c.minutes).toFixed(3)}p/min, avg turn ${Math.round(c.ms)}ms`);

  console.log("LESSONS (Sonnet 5.5)");
  for (const L of lessonCases) {
    const t0 = Date.now();
    const r = await buildLesson(env, L);
    const usd = r.cost.reduce((s, x) => s + x.usd, 0);
    console.log(`  ${L.topic}: ${r.model}, ${(usd * GBP * 100).toFixed(2)}p, ${((Date.now() - t0) / 1000).toFixed(1)}s, ${r.lesson.steps?.length ?? "?"} steps`);
  }

  console.log("GAP ANALYSIS (Haiku)");
  const res = await handleAnalyse(new Request("https://x/api/analyse", { method: "POST", body: JSON.stringify({
    topic: "Osmosis",
    turns: [
      { speaker: "learner", text: "Osmosis is water moving across a membrane to where there is more stuff dissolved." },
      { speaker: "student", text: "Why does it go that way?" },
      { speaker: "learner", text: "Because the water wants to even things out, I think. And the membrane only lets water through." },
    ],
  }) }), env);
  const j = (await res.json()) as { cost?: { pence?: number }; analysis?: unknown; error?: string };
  console.log(" ", res.status, JSON.stringify(j).slice(0, 400));
};
main();

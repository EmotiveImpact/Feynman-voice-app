// Builds real lessons across subjects and prints which drawing each bite got.
//   ANTHROPIC_API_KEY=... npx tsx apps/api/scripts/drawing-variety.ts out.json [topics]
import { writeFileSync } from "node:fs";
import { buildLesson, type LessonRequest } from "../src/lesson";

const ALL: LessonRequest[] = [
  { topic: "Osmosis", idea: "Why water moves towards the side with more solute" },
  { topic: "Supply and demand", idea: "What happens to price when demand rises" },
  { topic: "The causes of the First World War", idea: "How alliances turned a local crisis into a wider war" },
  { topic: "Photosynthesis", idea: "How plants turn light into sugar" },
  { topic: "Recursion", idea: "How a function can call itself and still finish" },
  { topic: "Contract law", idea: "What makes a promise a binding contract" },
  { topic: "The heart", idea: "How blood moves through the heart" },
  { topic: "Cognitive dissonance", idea: "Why people change their beliefs to match what they did" },
  { topic: "Inflation", idea: "Why prices rise when too much money chases too few goods" },
  { topic: "Macbeth", idea: "How ambition leads Macbeth to ruin" },
];
const out = process.argv[2] ?? "variety.json";
const pick = process.argv[3]?.split(",");
const cases = pick ? ALL.filter((c) => pick.some((p) => c.topic.toLowerCase().includes(p))) : ALL;
const env = { ...process.env };
const results = await Promise.all(
  cases.map(async (c) => {
    const t = Date.now();
    try {
      const r = await buildLesson(env, c, undefined, null);
      return { ...c, ms: Date.now() - t, model: r.model, lesson: r.lesson };
    } catch (e) {
      return { ...c, error: (e as Error).message };
    }
  }),
);
writeFileSync(out, JSON.stringify(results, null, 2));
for (const r of results) {
  if ("error" in r) { console.log(`${r.topic}: ERROR ${r.error}`); continue; }
  console.log(`\n${r.topic} (${r.ms} ms)`);
  r.lesson.bites.forEach((b, i) => console.log(`  ${i + 1}. ${b.scene?.family ?? "NO SCENE -> " + b.picture.kind}  | ${b.caption}`));
}

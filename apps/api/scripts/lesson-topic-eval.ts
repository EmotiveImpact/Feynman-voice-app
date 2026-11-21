// Lesson topic eval: writes real Teach me lessons and checks each one stays on its topic.
//   ANTHROPIC_API_KEY=... npx tsx scripts/lesson-topic-eval.ts [simple,standard,deep] [reps]
// Catches the "control panel lesson that turned into a lift" kind of drift. Two checks per lesson:
//   1. offTopic(), the same rule the server runs on every lesson.
//   2. A judge (Claude Haiku) that reads the lesson and marks every bite and every puzzle.
// Exits with code 1 when any lesson fails, so it can guard a prompt change.
import Anthropic from "@anthropic-ai/sdk";
import { buildLesson, offTopic, type Lesson, type LessonRequest, type Level } from "../src/lesson";

const CASES: (Omit<LessonRequest, "level"> & { name: string })[] = [
  { name: "control-panel-basics", topic: "Control panel", idea: "The basics of Control panel" },
  { name: "control-panel-press", topic: "Control panels", idea: "How a control panel turns a button press into an action" },
  { name: "osmosis", topic: "Osmosis", idea: "Why water moves towards the side with more solute" },
  { name: "supply-demand", topic: "Supply and demand", idea: "What happens to price and quantity when demand rises" },
  { name: "ww1", topic: "The causes of the First World War", idea: "How the alliance system turned a local crisis into a wider war" },
  { name: "recursion", topic: "Recursion", idea: "Why a recursive function needs a base case" },
  { name: "contract-law", topic: "Offer and acceptance", idea: "The difference between an offer and an invitation to treat" },
];

interface Verdict {
  bites: { on_topic: boolean; puzzle_tests_topic: boolean; comparison: string; comparison_tied_back: boolean }[];
  drifted_to: string;
  note: string;
}

const JUDGE = `You check bite-sized lessons from a UK university study app. Each lesson must teach the given topic and idea, at every level of simplicity. Mark strictly.
For each bite, in order:
- on_topic: true when the bite teaches part of the idea about the topic itself. False when it mostly talks about something else, such as an everyday comparison.
- puzzle_tests_topic: true when the puzzle's question and right answer are about the topic, so it would make sense in a quiz on the topic for someone who never saw this lesson. False when it tests a comparison or something else.
- comparison: the everyday thing the bite compares the topic to, or "" when none.
- comparison_tied_back: true when there is no comparison, or the bite says plainly how it maps back to the topic.
drifted_to: "" when the lesson stays on the topic, otherwise the other subject it drifted to.
note: one short sentence.`;

const SCHEMA = {
  type: "object",
  properties: {
    bites: {
      type: "array",
      items: {
        type: "object",
        properties: { on_topic: { type: "boolean" }, puzzle_tests_topic: { type: "boolean" }, comparison: { type: "string" }, comparison_tied_back: { type: "boolean" } },
        required: ["on_topic", "puzzle_tests_topic", "comparison", "comparison_tied_back"],
        additionalProperties: false,
      },
    },
    drifted_to: { type: "string" },
    note: { type: "string" },
  },
  required: ["bites", "drifted_to", "note"],
  additionalProperties: false,
} as const;

async function judge(client: Anthropic, c: LessonRequest, lesson: Lesson): Promise<Verdict> {
  const shown = lesson.bites.map((b, i) => ({ bite: i + 1, title: b.title, text: b.text, drawing: b.scene ?? b.picture, puzzle: { prompt: b.puzzle.prompt, options: b.puzzle.options, answer: b.puzzle.answer } }));
  const r = await client.messages.create({
    model: process.env.JUDGE_MODEL ?? "claude-haiku-5-5",
    max_tokens: 1500,
    system: JUDGE,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: `Topic: ${c.topic}\nIdea: ${c.idea}\nLevel: ${c.level}\nWhat the topic means here: ${lesson.meaning}\n\nLesson:\n${JSON.stringify({ bites: shown, recap: lesson.recap }, null, 1)}` }],
  } as never);
  const text = (r as { content: { type: string; text?: string }[] }).content.flatMap((b) => (b.type === "text" ? [b.text ?? ""] : [])).join("");
  return JSON.parse(text) as Verdict;
}

const key = process.env.ANTHROPIC_API_KEY ?? process.env.FENNY_ANTHROPIC_KEY;
if (!key) throw new Error("Set ANTHROPIC_API_KEY");
const env = { ...process.env, ANTHROPIC_API_KEY: key, LESSON_BRAIN: "claude" };
const client = new Anthropic({ apiKey: key });
const levels = (process.argv[2] ?? "simple,standard").split(",") as Level[];
const reps = Number(process.argv[3] ?? 1);

let failed = 0;
let total = 0;
const rows: string[] = [];
const jobs = CASES.flatMap((c) => levels.flatMap((level) => Array.from({ length: reps }, (_, rep) => ({ ...c, level, rep }))));
await Promise.all(
  jobs.map(async (c) => {
    // A distinct idea per rep keeps the server's lesson cache out of the way.
    const req: LessonRequest = { topic: c.topic, idea: c.rep ? `${c.idea} ` + " ".repeat(c.rep) : c.idea, level: c.level };
    try {
      const { lesson, cost } = await buildLesson(env, req);
      const rule = offTopic(lesson, req);
      const v = await judge(client, req, lesson);
      const offBites = v.bites.filter((b) => !b.on_topic).length;
      const offPuzzles = v.bites.filter((b) => !b.puzzle_tests_topic).length;
      const loose = v.bites.filter((b) => !b.comparison_tied_back).length;
      const comparisons = v.bites.filter((b) => b.comparison).length;
      const ok = !rule.length && !offBites && !offPuzzles && !loose && !v.drifted_to;
      total++;
      if (!ok) failed++;
      rows.push(
        [
          ok ? "PASS" : "FAIL",
          `${c.name} (${c.level})`,
          `bites off topic ${offBites}/${lesson.bites.length}`,
          `puzzles off topic ${offPuzzles}`,
          `comparisons ${comparisons}, loose ${loose}`,
          v.drifted_to ? `drifted to ${v.drifted_to}` : "",
          rule.length ? `rule: ${rule.join(" ")}` : "",
          `tries ${cost.length}`,
          `| ${lesson.bites.map((b) => b.title).join(" / ")}`,
          `| ${v.note}`,
        ]
          .filter(Boolean)
          .join("  "),
      );
    } catch (e) {
      total++;
      failed++;
      rows.push(`ERROR ${c.name} (${c.level}) ${(e as Error).message}`);
    }
  }),
);
rows.sort().forEach((r) => console.log(r));
console.log(`\n${total - failed} of ${total} lessons stayed on topic.`);
process.exit(failed ? 1 : 0);

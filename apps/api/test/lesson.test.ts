import { describe, expect, it } from "vitest";
import { checkLesson, handleLesson, oneDevice, quoteInNotes } from "../src/lesson";

const NOTES = "The cell membrane is a phospholipid bilayer. It is selectively permeable, so small non-polar molecules pass through freely while ions need channel proteins.";

const draft = () => ({
  bites: [
    {
      title: "A picky border",
      text: "The membrane lets some things through and keeps others out.",
      picture: { kind: "compare", labels: ["Gets in", "Kept out"] },
      quote: "It is selectively permeable",
      puzzle: { kind: "true_false", prompt: "Ions slip through the membrane on their own.", options: ["yes", "no"], answer: ["false"], why: "Ions need channel proteins." },
    },
    {
      title: "Doors for ions",
      text: "Charged ions need a protein door to cross.",
      picture: { kind: "flow", labels: ["Ion", "Channel", "Inside"] },
      quote: "while ions need channel proteins",
      puzzle: { kind: "fill_gap", prompt: "Ions cross through ___ proteins.", options: ["channel", "fat", "sugar"], answer: ["channel"], why: "Channels let charged things through." },
    },
  ],
  recap: "The membrane is picky, and ions need doors.",
  explainBack: "So how does a cell choose what gets in?",
});

const req = { topic: "Cell membranes", idea: "The membrane is selectively permeable", notes: NOTES };

describe("lesson checks", () => {
  it("finds quotes in the notes despite case and punctuation", () => {
    expect(quoteInNotes("it is Selectively permeable", NOTES)).toBe(true);
    expect(quoteInNotes("membranes are made of sugar", NOTES)).toBe(false);
    expect(quoteInNotes("anything", undefined)).toBe(false);
  });

  it("tidies true or false answers and marks bites backed by the notes", () => {
    const l = checkLesson(draft() as never, req);
    expect(l.bites[0].puzzle.options).toEqual(["True", "False"]);
    expect(l.bites[0].puzzle.answer).toEqual(["False"]);
    expect(l.bites.every((b) => b.fromNotes)).toBe(true);
  });

  it("rejects an answer that is not one of the options", () => {
    const d = draft();
    d.bites[1].puzzle.answer = ["glue"];
    expect(() => checkLesson(d as never, req)).toThrow(/not one of the options/);
  });

  it("rejects a match puzzle with a repeated card", () => {
    const d = draft();
    (d.bites[1] as { puzzle: object }).puzzle = { kind: "match", prompt: "Match them up.", options: ["Oxygen", "Glucose", "Carbon dioxide"], answer: ["Into cells", "Into cells", "Out of cells"], why: "." };
    expect(() => checkLesson(d as never, req)).toThrow(/repeated/);
  });
});

function openAIFetch(replies: object[]): typeof fetch {
  let i = 0;
  return (async () => {
    const value = replies[Math.min(i++, replies.length - 1)];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }], usage: { prompt_tokens: 1000, completion_tokens: 500 } }));
  }) as unknown as typeof fetch;
}

const post = (body: object) => new Request("https://x/api/lesson", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/lesson", () => {
  it("builds a lesson on the OpenAI brain when no Claude key is set", async () => {
    const res = await handleLesson(post({ ...req, idea: "idea one" }), { OPENAI_API_KEY: "k" }, openAIFetch([draft()]));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.lesson.bites).toHaveLength(2);
    expect(j.cached).toBe(false);
    expect(j.cost.usd).toBeGreaterThan(0);
  });

  it("asks again when the quotes are not from the notes, then serves the cache", async () => {
    const bad = draft();
    bad.bites.forEach((b) => (b.quote = "words that are not in the notes at all"));
    const env = { OPENAI_API_KEY: "k" };
    const res = await handleLesson(post({ ...req, idea: "idea two" }), env, openAIFetch([bad, draft()]));
    const j = await res.json();
    expect(j.cost.lines).toHaveLength(2);
    expect(j.lesson.bites[0].fromNotes).toBe(true);
    const again = await (await handleLesson(post({ ...req, idea: "idea two" }), env, openAIFetch([]))).json();
    expect(again.cached).toBe(true);
    expect(again.cost.usd).toBe(0);
  });

  it("uses Claude when the key is set", async () => {
    let sent: Record<string, unknown> = {};
    const claudeFetch = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string);
      return new Response(
        JSON.stringify({
          id: "m", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: "end_turn",
          content: [{ type: "text", text: JSON.stringify(draft()) }],
          usage: { input_tokens: 900, output_tokens: 700, cache_read_input_tokens: 800 },
        }),
        { headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    const res = await handleLesson(post({ ...req, idea: "idea three" }), { ANTHROPIC_API_KEY: "a" }, claudeFetch);
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.model).toBe("claude-sonnet-5-5");
    expect(sent.model).toBe("claude-sonnet-5-5");
    expect(sent.fallbacks).toBe("default");
    expect((sent.output_config as { format: { type: string } }).format.type).toBe("json_schema");
  });

  it("falls back to OpenAI when Claude refuses the key", async () => {
    const mixed = (async (url: string) => {
      if (String(url).includes("anthropic")) {
        return new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      return openAIFetch([draft()])(url);
    }) as unknown as typeof fetch;
    const res = await handleLesson(post({ ...req, idea: "idea four" }), { ANTHROPIC_API_KEY: "bad", OPENAI_API_KEY: "k" }, mixed);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.model).not.toMatch(/claude/);
    expect(j.lesson.bites).toHaveLength(2);
  });

  it("tells the writer how simply to explain, and keeps each level's lesson apart", async () => {
    const sent: string[] = [];
    const f = (async (_u: unknown, init?: RequestInit) => {
      sent.push(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(draft()) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    }) as unknown as typeof fetch;
    for (const level of ["simple", "deep", undefined]) await handleLesson(post({ ...req, idea: "level idea", level }), { OPENAI_API_KEY: "k" }, f);
    expect(sent).toHaveLength(3);
    expect(sent[0]).toContain("five year old");
    expect(sent[1]).toContain("Level: university");
    expect(sent[2]).toContain("12 year old");
    expect((await handleLesson(post({ ...req, level: "toddler" }), { OPENAI_API_KEY: "k" })).status).toBe(400);
  });

  it("needs a topic and an idea", async () => {
    expect((await handleLesson(post({ topic: "x" }), { OPENAI_API_KEY: "k" })).status).toBe(400);
  });
});

describe("variety of drawings", () => {
  const pair = (a: string, b: string) => ({ family: "pair", left: { label: a, shape: "line", count: 1, note: "" }, right: { label: b, shape: "curve", count: 1, note: "" }, lit: "right" });
  const stairs = { family: "stairs", steps: ["Ion", "Channel", "Inside"], at: 1 };
  const withScenes = (a: object, b: object) => {
    const d = draft() as unknown as { bites: Record<string, unknown>[] };
    d.bites[0].scene = a;
    d.bites[1].scene = b;
    return d;
  };

  it("spots a lesson that draws every bite the same way", () => {
    expect(oneDevice(checkLesson(withScenes(pair("In", "Out"), pair("Ion", "Fat")) as never, req))).toBe("pair");
    expect(oneDevice(checkLesson(withScenes(pair("In", "Out"), stairs) as never, req))).toBe("");
    expect(oneDevice(checkLesson(draft() as never, req))).toBe("");
  });

  it("asks once for different drawings", async () => {
    const res = await handleLesson(post({ ...req, idea: "idea variety" }), { OPENAI_API_KEY: "k" }, openAIFetch([withScenes(pair("In", "Out"), pair("Ion", "Fat")), withScenes(pair("In", "Out"), stairs)]));
    const j = await res.json();
    expect(j.cost.lines).toHaveLength(2);
    expect(j.lesson.bites.map((b: { scene: { family: string } }) => b.scene.family)).toEqual(["pair", "stairs"]);
  });

  it("keeps the first lesson when the second try breaks", async () => {
    const broken = draft();
    broken.bites[1].puzzle.answer = ["nonsense"];
    const res = await handleLesson(post({ ...req, idea: "idea spare" }), { OPENAI_API_KEY: "k" }, openAIFetch([withScenes(pair("In", "Out"), pair("Ion", "Fat")), broken]));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.lesson.bites[0].scene.family).toBe("pair");
  });
});

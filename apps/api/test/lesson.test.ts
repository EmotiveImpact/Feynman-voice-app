import { describe, expect, it } from "vitest";
import { buildLesson, checkLesson, handleLesson, keyWords, offTopic, oneDevice, quoteInNotes } from "../src/lesson";
import { catalogueKey, normalise, type LessonStore } from "../src/lessonStore";

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
    expect(sent[0]).toContain("Level: simplest. Same topic, same idea, plainer words.");
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

describe("staying on the topic", () => {
  // What Edem saw: a "simpler" lesson on control panels that became a lesson about a lift.
  const panel = { topic: "Control panels", idea: "How a control panel turns a button press into an action" };
  const bite = (over: Record<string, unknown>) => ({
    title: "Your press is a message",
    text: "When you press a button on a control panel, the panel reads it as a message and decides what happens.",
    picture: { kind: "flow", labels: ["Press", "Panel", "Action"] },
    quote: "",
    comparison: "",
    puzzle: { kind: "choose", prompt: "What does the control panel do with your press?", options: ["Decides what happens", "Ignores it", "Stores it forever"], answer: ["Decides what happens"], why: "The panel reads the press and picks the action." },
    ...over,
  });
  const lessonOf = (...bites: Record<string, unknown>[]) => checkLesson({ bites, recap: "A control panel turns a press into an action.", explainBack: "So what does a control panel do?" } as never, panel);

  it("passes a lesson about the topic itself", () => {
    expect(offTopic(lessonOf(bite({}), bite({ title: "The panel decides" })), panel)).toEqual([]);
  });

  it("catches a puzzle that tests the comparison instead of the topic", () => {
    const lift = bite({
      title: "Your push becomes a job",
      comparison: "lift",
      text: "Think of a lift. You press a button and the lift moves.",
      puzzle: { kind: "choose", prompt: "What happens after you press?", options: ["Lift moves", "Nothing", "The doors fall off"], answer: ["Lift moves"], why: "Your press becomes a job." },
    });
    const problems = offTopic(lessonOf(bite({}), lift), panel);
    expect(problems.join(" ")).toMatch(/Bite 2's puzzle tests the comparison \(lift\)/);
    expect(problems.join(" ")).toMatch(/never ties that back to Control panels/);
  });

  it("allows one comparison that is tied back and kept out of the puzzle", () => {
    const tied = bite({ comparison: "doorbell", text: "A doorbell press is a message. A control panel works the same way: your press tells the panel what you want." });
    expect(offTopic(lessonOf(tied, bite({})), panel)).toEqual([]);
  });

  it("catches a comparison in every bite, and a comparison drawn instead of the topic", () => {
    const a = bite({ comparison: "doorbell", text: "A control panel is like a doorbell." });
    const b = bite({ comparison: "teacher", text: "The control panel is like a teacher.", scene: { family: "things", layout: "chain", items: [{ thing: "teacher", label: "Teacher", size: 1, tone: "", mark: "" }, { thing: "hand", label: "Hand", size: 1, tone: "", mark: "" }], parts: [], lit: 0 } });
    const problems = offTopic(lessonOf(a, b), panel).join(" ");
    expect(problems).toMatch(/2 bites use an everyday comparison \(doorbell, teacher\)/);
  });

  it("does not count a word the topic owns as a comparison", () => {
    const lifts = { topic: "Lift control systems", idea: "How a lift decides which floor to go to" };
    const l = checkLesson({ bites: [bite({ comparison: "lift", text: "A lift control system reads each press.", puzzle: { kind: "true_false", prompt: "The lift goes to every floor in the order pressed.", options: ["True", "False"], answer: ["False"], why: "It groups calls." } })], recap: "Lift control systems group calls.", explainBack: "How does a lift choose?" } as never, lifts);
    expect(offTopic(l, lifts)).toEqual([]);
  });

  it("catches a lesson that never names the topic", () => {
    const l = checkLesson({ bites: [bite({ title: "Doors", text: "Doors open and shut.", puzzle: { kind: "true_false", prompt: "Doors open.", options: ["True", "False"], answer: ["True"], why: "They do." } })], recap: "Doors open.", explainBack: "What do doors do?" } as never, panel);
    expect(offTopic(l, panel).join(" ")).toMatch(/never names Control panels/);
  });

  it("counts words of the same family as naming the topic", () => {
    const rec = { topic: "Recursion", idea: "Why a recursive function needs a base case" };
    const l = checkLesson({ bites: [bite({ title: "Calls itself", text: "A recursive function calls itself on a smaller problem.", puzzle: { kind: "true_false", prompt: "A recursive function needs a base case.", options: ["True", "False"], answer: ["True"], why: "Or it never stops." } })], recap: "Each call gets smaller until the base case.", explainBack: "Why does it need a base case?" } as never, rec);
    expect(offTopic(l, rec)).toEqual([]);
  });

  it("reads plurals as the same word", () => {
    expect([...keyWords("Control panels, membranes and the basics of switches in osmosis")]).toEqual(["control", "panel", "membrane", "switch", "osmosis"]);
  });

  it("asks again when the lesson drifts, and serves the fixed one", async () => {
    const drifted = { bites: [bite({ comparison: "lift", text: "A lift moves when pressed.", puzzle: { kind: "true_false", prompt: "The lift moves when you press.", options: ["True", "False"], answer: ["True"], why: "It does." } })], recap: "Like a lift.", explainBack: "What does a control panel do?" };
    const fixed = { bites: [bite({})], recap: "A control panel turns a press into an action.", explainBack: "What does a control panel do?" };
    const sent: string[] = [];
    const replies = [drifted, fixed];
    const f = (async (_u: unknown, init?: RequestInit) => {
      sent.push(String(init?.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(replies.shift()) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    }) as unknown as typeof fetch;
    const res = await handleLesson(post({ ...panel, level: "simple" }), { OPENAI_API_KEY: "k" }, f);
    const j = await res.json();
    expect(j.cost.lines).toHaveLength(2);
    expect(sent[1]).toContain("drifted off the topic");
    expect(j.lesson.bites[0].comparison).toBe("");
  });
});

describe("lesson catalogue", () => {
  type Row = Parameters<LessonStore["save"]>[0] & { id: number; retired?: string; served: number };
  function fakeStore() {
    const rows: Row[] = [];
    const store: LessonStore = {
      async find(key) {
        const r = [...rows].reverse().find((x) => x.key === key && x.shared && !x.retired);
        return r ? { id: r.id, model: r.model, lesson: r.lesson } : null;
      },
      async save(row) {
        rows.push({ ...row, id: rows.length + 1, served: 0 });
      },
      async served(id) {
        rows[id - 1].served++;
      },
      async retire(id, reason) {
        rows[id - 1].retired = reason;
      },
    };
    return { rows, store };
  }
  const topicDraft = () => {
    const d = draft();
    d.bites.forEach((b) => (b.quote = ""));
    return d;
  };
  let calls = 0;
  const counting = (replies: object[]) => {
    const f = openAIFetch(replies);
    return (async (...a: Parameters<typeof fetch>) => {
      calls++;
      return f(...a);
    }) as typeof fetch;
  };

  it("matches topics regardless of case and punctuation", () => {
    expect(normalise("  Cell Membranes! ")).toBe("cell membranes");
    expect(catalogueKey("Cell membranes", "Selective, permeability", "simple")).toBe(catalogueKey("cell MEMBRANES", "selective permeability", "simple"));
    expect(catalogueKey("Cell membranes", "x", "simple")).not.toBe(catalogueKey("Cell membranes", "x", "deep"));
  });

  it("saves a general lesson as shared and reuses it for the next learner at no cost", async () => {
    const { rows, store } = fakeStore();
    calls = 0;
    const body = { topic: "Cell membranes", idea: "catalogue reuse idea", level: "simple" };
    const first = await buildLesson({ OPENAI_API_KEY: "k" }, body as never, counting([topicDraft()]), store);
    expect(first.cached).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0].shared).toBe(true);
    expect(rows[0].notesHash).toBeNull();
    // A different server instance (empty memory) with the Claude brain still finds it.
    const res = await handleLesson(post({ ...body, topic: "CELL MEMBRANES" }), { ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "k" }, counting([topicDraft()]), store);
    const j = await res.json();
    expect(j.cached).toBe(true);
    expect(j.cost.usd).toBe(0);
    expect(calls).toBe(1);
    expect(rows[0].served).toBe(1);
  });

  it("keeps a lesson from someone's notes private and never stores the notes", async () => {
    const { rows, store } = fakeStore();
    await buildLesson({ OPENAI_API_KEY: "k" }, { ...req, idea: "private notes idea" }, openAIFetch([draft()]), store);
    expect(rows).toHaveLength(1);
    expect(rows[0].shared).toBe(false);
    expect(rows[0].notesHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(rows[0])).not.toContain("phospholipid bilayer");
    expect(await store.find(catalogueKey(req.topic, "private notes idea", "standard"), 60)).toBeNull();
  });

  it("keeps a lesson shaped by what the learner said private", async () => {
    const { rows, store } = fakeStore();
    await buildLesson({ OPENAI_API_KEY: "k" }, { topic: "Cell membranes", idea: "said idea", said: "it is like a wall" }, openAIFetch([topicDraft()]), store);
    expect(rows[0].shared).toBe(false);
  });

  it("retires a saved lesson that fails today's on-topic check and writes a fresh one", async () => {
    const { rows, store } = fakeStore();
    const body = { topic: "Control panels", idea: "retire idea" };
    const lift = checkLesson(topicDraft() as never, body);
    await store.save({ key: catalogueKey(body.topic, body.idea, "standard"), shared: true, topic: body.topic, idea: body.idea, level: "standard", notesHash: null, model: "old", lesson: lift, cost: [], problems: [] });
    const r = await buildLesson({ OPENAI_API_KEY: "k" }, body, openAIFetch([topicDraft()]), store);
    expect(r.cached).toBe(false);
    expect(rows[0].retired).toMatch(/never names Control panels/);
    expect(rows[1].problems.length).toBeGreaterThan(0);
    expect(rows[1].shared).toBe(false);
  });

  it("still writes the lesson when the catalogue is down", async () => {
    const broken: LessonStore = {
      find: async () => {
        throw new Error("db down");
      },
      save: async () => {
        throw new Error("db down");
      },
      served: async () => {},
      retire: async () => {},
    };
    const r = await buildLesson({ OPENAI_API_KEY: "k" }, { topic: "Cell membranes", idea: "db down idea" }, openAIFetch([topicDraft()]), broken);
    expect(r.lesson.bites).toHaveLength(2);
  });
});

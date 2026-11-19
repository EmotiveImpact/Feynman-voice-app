import { describe, expect, it } from "vitest";
import { checkPlay, checkScene, FAMILIES, SCENE_PROMPT, THING_NAMES } from "../src/scene";
import { THINGS } from "../../mobile/src/teach/scene/things";

const play = (does: string, target = "x") => ({ prompt: "p", low: "a", high: "b", readouts: ["a", "b", "c"], changes: [{ target, does }] });

describe("the writer's examples", () => {
  // Every example in the prompt must pass the checks unchanged in kind, so the
  // writer is never shown a scene the app would throw away.
  const examples = SCENE_PROMPT.split("\n")
    .map((l) => /^[^{]+: (\{"family".*?\})(?: play (\{.*\}))?$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m);
  it("covers every family", () => {
    const seen = new Set(examples.map((m) => JSON.parse(m[1]).family));
    for (const f of FAMILIES) if (!["fan", "spiral", "radial", "funnel", "brace"].includes(f)) expect(seen.has(f), f).toBe(true);
  });
  it.each(examples.map((m) => [JSON.parse(m[1]).family + ": " + m[0].split(":")[0], m]))("%s passes the checks", (_name, m) => {
    const raw = JSON.parse((m as RegExpExecArray)[1]);
    const s = checkScene(raw);
    expect(s?.family).toBe(raw.family);
    const p = (m as RegExpExecArray)[2];
    if (p) expect(checkPlay(JSON.parse(p), s)).not.toBeNull();
  });
});

describe("the newer devices", () => {
  it("only lets a funnel narrow", () => {
    expect(checkScene({ family: "funnel", stages: [{ label: "Applied", value: 100 }, { label: "Offer", value: 140 }], lit: 0 })).toBeNull();
    const f = checkScene({ family: "funnel", stages: [{ label: "Applied", value: 100 }, { label: "Offer", value: 40 }], lit: 9 });
    expect(f?.family === "funnel" && f.lit).toBe(1);
  });
  it("makes shares add up to 100", () => {
    const c = checkScene({ family: "cutaway", whole: "Air", parts: [{ label: "Nitrogen", share: 7.8 }, { label: "Oxygen", share: 2.1 }, { label: "Other", share: 0.1 }], lit: 1 });
    expect(c?.family === "cutaway" && c.parts.map((x) => x.share)).toEqual([78, 21, 1]);
  });
  it("drops overlapping brace groups", () => {
    const b = checkScene({ family: "brace", items: ["Li", "Na", "K", "F", "Cl"], groups: [{ label: "Metals", from: 0, to: 2 }, { label: "Wrong", from: 2, to: 4 }, { label: "Halogens", from: 3, to: 4 }], lit: 2 });
    expect(b?.family === "brace" && b.groups.map((g) => g.label)).toEqual(["Metals", "Halogens"]);
  });
  it("keeps whole words when it shortens a label", () => {
    const s = checkScene({ family: "spiral", stages: ["Plan", "Build", "Test"], turns: 3, label: "Understanding grows deeper with practice" });
    expect(s?.family === "spiral" && s.label).toBe("Understanding grows deeper");
  });
  it("never cuts a word in half, and drops a dangling comma", () => {
    const m = checkScene({ family: "mirror", leftTitle: "Nucleus", rightTitle: "Around it", pairs: [{ left: "Proton, positive", right: "Electron, negatively charged" }, { left: "Neutron", right: "Pulled in" }], lit: 0 });
    expect(m?.family === "mirror" && m.pairs[0].right).toBe("Electron");
    const z = checkScene({ family: "zoom", levels: [{ label: "Atom", size: "1e-10 m" }, { label: "Electron region", size: "1e-12 m" }], at: 1 });
    expect(z?.family === "zoom" && z.levels[1].label).toBe("Electron region");
  });
  it("never ends a cut label on a little joining word", () => {
    const f = checkScene({ family: "funnel", stages: [{ label: "Visitors", value: 1000 }, { label: "Add to cart and pay later", value: 100 }], lit: 1 });
    expect(f?.family === "funnel" && f.stages[1].label).toBe("Add to cart");
    const g = checkScene({ family: "funnel", stages: [{ label: "Visitors", value: 1000 }, { label: "Add to basket quickly", value: 100 }], lit: 1 });
    expect(g?.family === "funnel" && g.stages[1].label).toBe("Add to basket");
    const h = checkScene({ family: "funnel", stages: [{ label: "Visitors", value: 1000 }, { label: "Put into the basket", value: 100 }], lit: 1 });
    expect(h?.family === "funnel" && h.stages[1].label).toBe("Put");
  });
  it("blanks slider targets for devices that light parts in order", () => {
    const t = checkScene({ family: "timeline", events: [{ label: "A", when: "1900", t: 1900 }, { label: "B", when: "1950", t: 1950 }], scale: "even", at: 1 });
    expect(checkPlay(play("step", "B"), t)?.changes[0]).toEqual({ target: "", does: "step" });
    expect(checkPlay(play("grow"), t)).toBeNull();
  });
});

describe("things", () => {
  it("knows exactly the things the app can draw", () => {
    expect([...THING_NAMES].sort()).toEqual(Object.keys(THINGS).sort());
  });
  it("drops things it cannot draw and keeps the layout's limits", () => {
    const v = checkScene({ family: "things", layout: "versus", items: [{ thing: "dragon", label: "Dragon", size: 1 }, { thing: "virus", label: "Virus", size: 1 }, { thing: "bacterium", label: "Bacterium", size: 1 }, { thing: "cell", label: "Cell", size: 1 }], lit: 7 });
    expect(v?.family === "things" && v.items.map((t) => t.thing)).toEqual(["virus", "bacterium"]);
    expect(v?.family === "things" && v.lit).toBe(1);
    expect(checkScene({ family: "things", layout: "chain", items: [{ thing: "seed", label: "Seed", size: 1 }], lit: 0 })).toBeNull();
    expect(checkScene({ family: "things", layout: "row", items: [{ thing: "iceberg", label: "Most costs are hidden", size: 1 }], lit: 0 })?.family).toBe("things");
  });
  it("puts a scale smallest first, and refuses one with no real sizes", () => {
    const s = checkScene({ family: "things", layout: "scale", items: [{ thing: "mountain", label: "Everest", size: 8849 }, { thing: "person", label: "Climber", size: 1.8 }], lit: 0 });
    expect(s?.family === "things" && s.items.map((t) => t.label)).toEqual(["Climber", "Everest"]);
    expect(checkScene({ family: "things", layout: "scale", items: [{ thing: "mountain", label: "A", size: 1 }, { thing: "person", label: "B", size: 1 }], lit: 0 })).toBeNull();
  });
  it("lets units count in little pictures, only ones it can draw", () => {
    const u = checkScene({ family: "units", lit: 4, label: "get a side effect", rest: "do not", thing: "person" });
    expect(u?.family === "units" && u.thing).toBe("person");
    const w = checkScene({ family: "units", lit: 4, label: "get a side effect", rest: "do not", thing: "unicorn" });
    expect(w?.family === "units" && w.thing).toBe("");
  });
  it("steps through things and speeds an orbit", () => {
    const o = checkScene({ family: "things", layout: "orbit", items: [{ thing: "sun", label: "Sun", size: 1 }, { thing: "earth", label: "Earth", size: 1 }], lit: 1 });
    expect(checkPlay(play("speed", "Earth"), o)?.changes[0]).toEqual({ target: "", does: "speed" });
    expect(checkPlay(play("weigh"), o)).toBeNull();
  });
});

describe("things with named parts", () => {
  const base = { family: "things", layout: "parts", items: [{ thing: "heart", label: "Heart", size: 1 }], lit: 0 };
  it("keeps one thing and up to four parts, each spot once", () => {
    const s = checkScene({ ...base, items: [...base.items, { thing: "brain", label: "Brain", size: 1 }], parts: [{ label: "Right atrium", at: "top left" }, { label: "Left atrium", at: "top left" }, { label: "Left ventricle", at: "bottom right" }, { label: "Aorta", at: "top" }, { label: "Septum", at: "centre" }, { label: "Apex", at: "bottom" }] }) as any;
    expect(s.items).toHaveLength(1);
    expect(s.parts.map((p: any) => p.label)).toEqual(["Right atrium", "Left ventricle", "Aorta", "Septum"]);
  });
  it("falls back to the plain drawing with fewer than two parts", () => {
    const s = checkScene({ ...base, parts: [{ label: "Aorta", at: "top" }] }) as any;
    expect(s.layout).toBe("row");
    expect(s.parts).toEqual([]);
  });
  it("gives other layouts no parts", () => {
    const s = checkScene({ family: "things", layout: "versus", items: [{ thing: "virus", label: "Virus", size: 1 }, { thing: "bacterium", label: "Bacterium", size: 1 }], parts: [{ label: "x", at: "top" }], lit: 0 }) as any;
    expect(s.parts).toEqual([]);
  });
});

describe("the v10 devices", () => {
  it("needs two real forces", () => {
    expect(checkScene({ family: "forces", object: "Book", forces: [{ label: "Weight", dir: "down", size: 9 }, { label: "Push", dir: "sideways", size: 2 }], result: "Still" })).toBeNull();
    const f = checkScene({ family: "forces", object: "Book", forces: [{ label: "Weight", dir: "down", size: 9 }, { label: "Table", dir: "up", size: 3 }], result: "Still" });
    expect(f?.family === "forces" && f.forces.map((x) => x.size)).toEqual([5, 3]);
  });
  it("fills in the signs of an equation and keeps long words whole", () => {
    const e = checkScene({ family: "equation", terms: [{ label: "Force", note: "" }, { label: "Mass", note: "" }, { label: "Acceleration", note: "" }], signs: ["equals"], lit: 7 });
    expect(e?.family === "equation" && e.signs).toEqual(["equals", "equals"]);
    expect(e?.family === "equation" && e.terms[2].label).toBe("Acceleration");
    expect(e?.family === "equation" && e.lit).toBe(2);
  });
  it("refuses a table with holes and keeps what each cell says", () => {
    const base = { family: "matrix", rowTitle: "You", colTitle: "Them", rows: ["Stay quiet", "Confess"], cols: ["Stay quiet", "Confess"] };
    expect(checkScene({ ...base, cells: ["1 year each", "10 and free", "Free and 10"], litRow: 1, litCol: 1 })).toBeNull();
    const m = checkScene({ ...base, cells: ["1 year each", "10 and free", "Free and 10", "5 years each"], litRow: 5, litCol: 1 });
    expect(m?.family === "matrix" && m.cells).toEqual(["1 year each", "10 and free", "Free and 10", "5 years each"]);
    expect(m?.family === "matrix" && m.litRow).toBe(1);
  });
  it("drops a mapping that points nowhere", () => {
    const b = checkScene({ family: "bridge", leftTitle: "Codon", rightTitle: "Amino acid", left: ["AUG", "UUU"], right: ["Met", "Phe"], maps: [{ from: 0, to: 0 }, { from: 1, to: 9 }], lit: 0 });
    expect(b?.family === "bridge" && b.maps).toEqual([{ from: 0, to: 0 }]);
  });
  it("finds the gap in a pattern", () => {
    const p = checkScene({ family: "pattern", items: ["2", "4", "", "16"], gap: 0, answer: "8", rule: "Doubles" });
    expect(p?.family === "pattern" && p.gap).toBe(2);
  });
  it("keeps a lever's pivot where it can be drawn, and bonds no stronger than triple", () => {
    const l = checkScene({ family: "lever", load: "Rock", effort: "Push", pivot: "Pivot", at: 0.95 });
    expect(l?.family === "lever" && l.at).toBe(0.6);
    const w = checkScene({ family: "bonds", shape: "bent", atoms: ["H", "O", "H"], orders: [1, 5], lit: 0, name: "Water" });
    expect(w?.family === "bonds" && w.orders).toEqual([1, 3]);
  });
  it("needs more than one line of working and at least one reason", () => {
    expect(checkScene({ family: "working", lines: [{ text: "2x + 3 = 11", note: "" }], lit: 0 })).toBeNull();
    expect(checkScene({ family: "case", claim: "Tax sugar", reasons: [], objection: "Hits the poor", lit: 0 })).toBeNull();
  });
  it("names a feedback loop only on a loop", () => {
    const links = [{ from: 0, to: 1, kind: "cause" }, { from: 1, to: 2, kind: "cause" }, { from: 2, to: 0, kind: "cause" }];
    const nodes = ["Fear", "Withdrawals", "Less cash"];
    const loop = checkScene({ family: "links", layout: "loop", nodes, links, feedback: "reinforcing" });
    expect(loop?.family === "links" && loop.feedback).toBe("reinforcing");
    const row = checkScene({ family: "links", layout: "line", nodes, links: links.slice(0, 2), feedback: "reinforcing" });
    expect(row?.family === "links" && row.feedback).toBe("");
  });
  it("keeps the second group of units inside the hundred", () => {
    const u = checkScene({ family: "units", lit: 1, label: "Ill", rest: "Well", thing: "person", also: 150, alsoLabel: "False alarm" });
    expect(u?.family === "units" && u.also).toBe(98);
  });
  it("gives a shape no slider", () => {
    const g = checkScene({ family: "geometry", shape: "circle", labels: ["Radius", "Diameter"], lit: 0 });
    expect(checkPlay(play("step"), g)).toBeNull();
  });
});

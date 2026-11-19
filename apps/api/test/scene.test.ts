import { describe, expect, it } from "vitest";
import { checkPlay, checkScene } from "../src/scene";
import { checkLesson } from "../src/lesson";

describe("scene checks", () => {
  it("keeps a good particles scene and trims what the app cannot draw", () => {
    const s = checkScene({
      family: "particles",
      zones: ["Dilute", "Concentrated", "Extra", "Too many"],
      divider: "laser",
      things: [
        { name: "Water", mark: "dot", count: 40, zone: 0, to: 9, motion: "cross" },
        { name: "water", mark: "blocked", count: 9, zone: 1, to: 1, motion: "still" },
        { name: "salt", mark: "blocked", count: 2, zone: 2, to: 2, motion: "sparkle" },
      ],
    });
    expect(s?.family).toBe("particles");
    if (s?.family !== "particles") return;
    expect(s.zones).toHaveLength(3);
    expect(s.divider).toBe("membrane");
    expect(s.things[0]).toMatchObject({ name: "water", count: 16, to: 2, motion: "cross" });
    expect(s.things[1].name).toBe("water 2");
    expect(s.things[1].count).toBe(3);
    // only one coral group
    expect(s.things[2].mark).toBe("ring");
    expect(s.things[2].motion).toBe("drift");
  });

  it("drops scenes with nothing to draw", () => {
    expect(checkScene(null)).toBeNull();
    expect(checkScene({ family: "links", layout: "line", nodes: ["Only one"], links: [] })).toBeNull();
    expect(checkScene({ family: "graph", x: "x", y: "y", curves: [], highlight: "ride" })).toBeNull();
    expect(checkScene({ family: "painting" })).toBeNull();
  });

  it("falls back to a highlight the graph can show", () => {
    const g = checkScene({ family: "graph", x: "Quantity", y: "Price", curves: [{ name: "D", shape: "fall", label: "D" }], highlight: "crossing" });
    expect(g?.family === "graph" && g.highlight).toBe("ride");
  });

  it("keeps a slider only when it points at something in the scene", () => {
    const scene = checkScene({ family: "graph", x: "Quantity", y: "Price", curves: [{ name: "supply", shape: "rise", label: "S" }, { name: "demand", shape: "fall", label: "D" }], highlight: "crossing" });
    const ok = checkPlay({ prompt: "Raise demand.", low: "Old demand", high: "Demand up", readouts: ["a", "b", "c"], changes: [{ target: "Demand", does: "shift" }] }, scene);
    expect(ok?.changes).toEqual([{ target: "demand", does: "shift" }]);
    expect(checkPlay({ prompt: "x", low: "a", high: "b", readouts: ["a", "b", "c"], changes: [{ target: "price", does: "shift" }] }, scene)).toBeNull();
    expect(checkPlay({ prompt: "x", low: "a", high: "b", readouts: ["a", "b", "c"], changes: [{ target: "demand", does: "appear" }] }, scene)).toBeNull();
    expect(checkPlay({ prompt: "x", low: "a", high: "b", readouts: ["a", "c"], changes: [{ target: "demand", does: "shift" }] }, scene)?.readouts).toHaveLength(3);
  });
});

describe("lessons with scenes", () => {
  it("allows only one slider per lesson", () => {
    const scene = { family: "balance", left: "Defendant", right: "Claimant", leftWeight: 3, rightWeight: 4, middle: "51%" };
    const play = { prompt: "Add evidence.", low: "Weak", high: "Strong", readouts: ["a", "b", "c"], changes: [{ target: "right", does: "weigh" }] };
    const bite = { title: "t", text: "x", picture: { kind: "none", labels: [] }, scene, play, quote: "", puzzle: { kind: "true_false", prompt: "p", options: ["True", "False"], answer: ["True"], why: "w" } };
    const l = checkLesson({ bites: [bite, bite], recap: "r", explainBack: "e" } as never, { topic: "Law", idea: "Burden of proof" });
    expect(l.bites[0].play).not.toBeNull();
    expect(l.bites[1].play).toBeNull();
    expect(l.bites[1].scene?.family).toBe("balance");
  });
});

describe("the newer devices", () => {
  it("checks compare, stairs, spectrum and venn scenes and their sliders", () => {
    const c = checkScene({ family: "compare", style: "circles", items: [{ label: "Earth", value: 1 }, { label: "Sun", value: 109 }, { label: "", value: 3 }] });
    const cut = checkScene({ family: "compare", style: "bars", items: [{ label: "Before (per 1,000)", value: 1 }, { label: "After", value: 2 }] });
    expect(cut?.family === "compare" && cut.items[0].label).toBe("Before");
    expect(c?.family === "compare" && c.items).toHaveLength(2);
    expect(checkPlay({ prompt: "p", low: "a", high: "b", readouts: ["a", "b", "c"], changes: [{ target: "Sun", does: "grow" }] }, c)?.changes[0].target).toBe("sun");
    expect(checkPlay({ prompt: "p", low: "a", high: "b", readouts: ["a", "b", "c"], changes: [{ target: "x", does: "step" }] }, c)?.changes[0].target).toBe("");
    const st = checkScene({ family: "stairs", steps: ["Body", "Safety", "Growth"], at: 9 });
    expect(st?.family === "stairs" && st.at).toBe(2);
    const sp = checkScene({ family: "spectrum", left: "Acid", right: "Alkaline", min: 0, max: 14, marks: [{ label: "Bleach", at: 99 }], at: -3 });
    expect(sp?.family === "spectrum" && [sp.at, sp.marks[0].at]).toEqual([0, 14]);
    const v = checkScene({ family: "venn", a: "Rain", b: "Wind", both: "Both", overlap: 3 });
    expect(v?.family === "venn" && v.overlap).toBe(1);
    expect(checkPlay({ prompt: "p", low: "a", high: "b", readouts: ["a", "b", "c"], changes: [{ target: "Rain", does: "overlap" }] }, v)?.changes[0]).toEqual({ target: "", does: "overlap" });
  });
  it("checks a pair: two small pictures side by side, one lit", () => {
    const p = checkScene({ family: "pair", left: { label: "Mitosis", shape: "split", count: 40, note: "2 identical cells" }, right: { label: "Meiosis", shape: "nonsense", count: 4, note: "" }, lit: "middle" });
    expect(p).toEqual({ family: "pair", left: { label: "Mitosis", shape: "split", count: 8, note: "2 identical cells", tone: "" }, right: { label: "Meiosis", shape: "path", count: 0, note: "", tone: "" }, lit: "right" });
    expect(checkScene({ family: "pair", left: { label: "", shape: "line", count: 0, note: "" }, right: { label: "B", shape: "curve", count: 0, note: "" }, lit: "left" })).toBeNull();
    expect(checkPlay({ prompt: "p", low: "a", high: "b", readouts: ["a", "b", "c"], changes: [{ target: "Meiosis", does: "step" }] }, p)?.changes[0]).toEqual({ target: "", does: "step" });
    expect(checkPlay({ prompt: "p", low: "a", high: "b", readouts: ["a", "b", "c"], changes: [{ target: "", does: "grow" }] }, p)).toBeNull();
  });
});

describe("tree, test, threshold, units and crowd", () => {
  it("keeps a tree to 6 leaves and a lit path that exists", () => {
    const t = checkScene({
      family: "tree",
      root: "Animals",
      branches: [
        { label: "Vertebrates", leaves: ["Mammals", "Birds", "Fish", "Reptiles"] },
        { label: "Invertebrates", leaves: ["Insects", "Molluscs", "Worms"] },
        { label: "Sponges", leaves: [] },
      ],
      lit: { branch: 2, leaf: 1 },
    });
    expect(t?.family).toBe("tree");
    if (t?.family !== "tree") return;
    expect(t.branches.reduce((n, b) => n + b.leaves.length, 0)).toBeLessThanOrEqual(6);
    expect(t.branches[0].leaves).toHaveLength(3);
    // Sponges has no leaves, so the lit path ends at the branch.
    expect(t.lit).toEqual({ branch: 2, leaf: -1 });
    expect(checkScene({ family: "tree", root: "x", branches: [{ label: "only", leaves: [] }], lit: { branch: 0, leaf: 0 } })).toBeNull();
  });

  it("keeps a test's failing gate in range", () => {
    const t = checkScene({ family: "test", case: "Claim", gates: ["Foreseeable", "Proximity", "Fair"], fails: 7, outcome: "No duty" });
    expect(t).toEqual({ family: "test", case: "Claim", gates: ["Foreseeable", "Proximity", "Fair"], fails: 2, outcome: "No duty" });
    const pass = checkScene({ family: "test", case: "Claim", gates: ["A", "B"], fails: -1, outcome: "Liable" });
    expect(pass?.family === "test" && pass.fails).toBe(-1);
  });

  it("keeps threshold, units and crowd values sensible", () => {
    const th = checkScene({ family: "threshold", level: "Voltage", line: "Threshold", at: 3, value: -1 });
    expect(th).toEqual({ family: "threshold", level: "Voltage", line: "Threshold", at: 0.95, value: 0.05 });
    const u = checkScene({ family: "units", lit: 140, label: "get a side effect", rest: "do not" });
    expect(u?.family === "units" && u.lit).toBe(99);
    const c = checkScene({ family: "crowd", x: "Year", y: "Life expectancy", count: 40, crowd: "wobbly", lit: "Russia", litShape: "dip" });
    expect(c).toMatchObject({ family: "crowd", count: 16, crowd: "rise", litShape: "dip" });
  });

  it("gives each new device its slider, and none to a crowd", () => {
    const th = checkScene({ family: "threshold", level: "Evidence", line: "51%", at: 0.5, value: 0.6 });
    const play = { prompt: "Add evidence.", low: "None", high: "Lots", readouts: ["a", "b", "c"], changes: [{ target: "evidence", does: "fill" }] };
    expect(checkPlay(play, th)?.changes).toEqual([{ target: "", does: "fill" }]);
    const crowd = checkScene({ family: "crowd", x: "Year", y: "GDP", count: 10, crowd: "rise", lit: "Japan", litShape: "flat" });
    expect(checkPlay({ ...play, changes: [{ target: "", does: "step" }] }, crowd)).toBeNull();
  });
});

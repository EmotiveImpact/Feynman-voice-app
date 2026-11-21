// Every subject: real maps, the body, circuits, tables, colours, staves, more
// kinds of people, and the rules that keep a picture honest.
import { describe, expect, it } from "vitest";
import { asThing, BODY_PART_VIEWS, checkPlay, checkScene, CIRCUIT_KINDS, KIT_POSES, KIT_WEARS, MAP_REGIONS, SCENE_PROMPT, THING_NAMES } from "../src/scene";
import { BODY_FRAMES, BODY_PARTS } from "../../mobile/src/teach/scene/bodyparts";
import { hasThing } from "../../mobile/src/teach/scene/kit";
import { OUTLINES } from "../../mobile/src/teach/scene/outlines";
import { canDraw, DRAWABLE } from "../../mobile/src/teach/scene/types";

const play = (does: string, target = "") => ({ prompt: "p", low: "a", high: "b", readouts: ["a", "b", "c"], changes: [{ target, does }] });
const place = (label: string, lat: number, lon: number) => ({ label, x: 0, y: 0, lat, lon });

describe("real maps", () => {
  it("the server and the app know the same regions", () => {
    expect(Object.keys(MAP_REGIONS).sort()).toEqual(Object.keys(OUTLINES).sort());
    for (const [name, o] of Object.entries(OUTLINES)) {
      expect(o.coast.length, name).toBeGreaterThan(3);
      expect(o.x >= 0 && o.y >= 0 && o.x + o.w <= 300 && o.y + o.h <= 176, name).toBe(true);
    }
  });

  it("puts a place where its latitude and longitude say", () => {
    const s = checkScene({ family: "map", region: "uk", borders: true, places: [place("London", 51.5, -0.1), place("Edinburgh", 55.95, -3.2)], routes: [{ from: 0, to: 1 }], lit: 0 });
    if (s?.family !== "map") throw new Error("no map");
    expect(s.region).toBe("uk");
    expect(s.borders).toBe(true);
    // London is south and east of Edinburgh.
    expect(s.places[0].x).toBeGreaterThan(s.places[1].x);
    expect(s.places[0].y).toBeLessThan(s.places[1].y);
    expect(s.routes).toEqual([{ from: 0, to: 1 }]);
    expect(canDraw(s)).toBe(true);
  });

  it("leaves off a place that is not on the map, and the routes with it", () => {
    const s = checkScene({ family: "map", region: "uk", borders: false, places: [place("London", 51.5, -0.1), place("New York", 40.7, -74), place("Nowhere", 0, 0)], routes: [{ from: 0, to: 1 }], lit: 1 });
    if (s?.family !== "map") throw new Error("no map");
    expect(s.places.map((p) => p.label)).toEqual(["London"]);
    expect(s.routes).toEqual([]);
    expect(s.lit).toBe(0);
  });

  it("only draws borders on a real map, and a sketch map still needs two places", () => {
    const sketch = checkScene({ family: "map", region: "", borders: true, places: [{ label: "A town", x: 0.2, y: 0.3, lat: 0, lon: 0 }, { label: "B town", x: 0.8, y: 0.6, lat: 0, lon: 0 }], routes: [], lit: 0 });
    if (sketch?.family !== "map") throw new Error("no map");
    expect(sketch.region).toBe("");
    expect(sketch.borders).toBe(false);
    expect(checkScene({ family: "map", region: "", borders: false, places: [{ label: "A town", x: 0.2, y: 0.3 }], routes: [], lit: 0 })).toBeNull();
    expect(checkScene({ family: "map", region: "atlantis", places: [place("London", 51.5, -0.1)], routes: [], lit: 0 })).toBeNull();
    // An older lesson with no region still draws.
    expect(checkScene({ family: "map", places: [{ label: "Britain", x: 0.5, y: 0.8 }, { label: "France", x: 0.6, y: 0.5 }], routes: [], lit: 0 })?.family).toBe("map");
  });

  it("tells the writer never to show borders from another time", () => {
    expect(SCENE_PROMPT).toContain("false for history");
    for (const r of Object.keys(MAP_REGIONS)) expect(SCENE_PROMPT).toContain(r);
  });
});

describe("the body", () => {
  it("the server and the app know the same parts and views", () => {
    expect(Object.keys(BODY_PART_VIEWS).sort()).toEqual(Object.keys(BODY_PARTS).sort());
    for (const [name, q] of Object.entries(BODY_PARTS)) {
      expect(q.v, name).toBe(BODY_PART_VIEWS[name]);
      expect(q.m.length, name).toBeGreaterThan(0);
      expect(q.at.length === 2 || q.at.length === 4, name).toBe(true);
      expect(SCENE_PROMPT, name).toContain(name);
    }
    expect(BODY_FRAMES.body.length).toBeGreaterThan(3);
    expect(BODY_FRAMES.brain.length).toBeGreaterThan(3);
  });

  it("the heart is on the body's left, which is the viewer's right, and the liver on the other side", () => {
    expect(BODY_PARTS.heart.at[0]).toBeGreaterThan(0);
    expect(BODY_PARTS.liver.at[0]).toBeLessThan(0);
    expect(BODY_PARTS.stomach.at[0]).toBeGreaterThan(0);
    expect(BODY_PARTS.appendix.at[0]).toBeLessThan(0);
  });

  it("chooses the view from the parts", () => {
    const organs = checkScene({ family: "body", parts: [{ part: "heart", label: "Heart" }, { part: "Lungs", label: "" }], lit: 0 });
    if (organs?.family !== "body") throw new Error("no body");
    expect(organs.view).toBe("torso");
    expect(organs.parts[1]).toEqual({ part: "lungs", label: "Lungs" });
    const leg = checkScene({ family: "body", parts: [{ part: "femur", label: "Thigh bone" }, { part: "knee", label: "Knee" }, { part: "heart", label: "Heart" }], lit: 1 });
    expect(leg?.family === "body" && leg.view).toBe("whole");
    const brain = checkScene({ family: "body", parts: [{ part: "Broca's area", label: "Broca's area" }, { part: "heart", label: "Heart" }, { part: "hippocampus", label: "Hippocampus" }], lit: 2 });
    if (brain?.family !== "body") throw new Error("no brain");
    expect(brain.view).toBe("brain");
    expect(brain.parts.map((p) => p.part)).toEqual(["brocas_area", "hippocampus"]);
    expect(brain.lit).toBe(1);
    expect(canDraw(brain)).toBe(true);
  });

  it("never points at the nearest part when it does not know the one asked for", () => {
    expect(checkScene({ family: "body", parts: [{ part: "left earlobe", label: "Earlobe" }], lit: 0 })).toBeNull();
    const s = checkScene({ family: "body", parts: [{ part: "windpipe", label: "Windpipe" }, { part: "heart", label: "Heart" }, { part: "heart", label: "Again" }, { part: "tail", label: "Tail" }], lit: 0 });
    expect(s?.family === "body" && s.parts.map((p) => p.part)).toEqual(["trachea", "heart"]);
    expect(checkPlay(play("step"), s)).not.toBeNull();
  });
});

describe("circuits", () => {
  const part = (kind: string, branch = 0, label = "") => ({ kind, label, branch });
  it("needs a supply and something for it to drive", () => {
    expect(checkScene({ family: "circuit", parts: [part("bulb"), part("resistor")], lit: 0 })).toBeNull();
    expect(checkScene({ family: "circuit", parts: [part("cell"), part("battery")], lit: 0 })).toBeNull();
    expect(checkScene({ family: "circuit", parts: [part("cell"), part("toaster")], lit: 0 })).toBeNull();
    expect(checkScene({ family: "circuit", parts: [part("cell"), part("bulb")], lit: 1 })?.family).toBe("circuit");
  });

  it("keeps the supply on the main loop and numbers the branches without gaps", () => {
    const s = checkScene({ family: "circuit", parts: [part("battery", 2), part("switch_closed"), part("bulb", 3, "Lamp 1"), part("bulb", 7, "Lamp 2"), part("voltmeter", 1)], lit: 2 });
    if (s?.family !== "circuit") throw new Error("no circuit");
    expect(s.parts.map((p) => p.branch)).toEqual([0, 0, 2, 2, 1]);
    expect(canDraw(s)).toBe(true);
    expect(checkPlay(play("step"), s)).not.toBeNull();
    expect(checkPlay(play("speed"), s)).not.toBeNull();
    expect(checkPlay(play("grow"), s)).toBeNull();
  });

  it("lists every symbol for the writer", () => {
    for (const k of CIRCUIT_KINDS) expect(SCENE_PROMPT).toContain(k);
  });
});

describe("tables", () => {
  it("keeps a table whose rows fit its columns", () => {
    const s = checkScene({ family: "table", title: "Parler, present tense", cols: ["Person", "Verb"], rows: [["je", "parle"], ["nous", "parlons"], ["oops"], ["", ""]], litRow: 1, litCol: 1 });
    if (s?.family !== "table") throw new Error("no table");
    expect(s.rows).toEqual([["je", "parle"], ["nous", "parlons"]]);
    expect(s.litRow).toBe(1);
    expect(s.litCol).toBe(1);
    expect(canDraw(s)).toBe(true);
  });

  it("keeps a three word heading and lights a whole row", () => {
    const s = checkScene({ family: "table", title: "", cols: ["A", "B", "A AND B"], rows: [["0", "0", "0"], ["1", "1", "1"]], litRow: 9, litCol: -1 });
    if (s?.family !== "table") throw new Error("no table");
    expect(s.cols[2]).toBe("A AND B");
    expect(s.litRow).toBe(1);
    expect(s.litCol).toBe(-1);
    expect(checkPlay(play("step"), s)).not.toBeNull();
  });

  it("needs two columns and a row", () => {
    expect(checkScene({ family: "table", title: "", cols: ["Only"], rows: [["x"]], litRow: 0, litCol: 0 })).toBeNull();
    expect(checkScene({ family: "table", title: "", cols: ["A", "B"], rows: [], litRow: 0, litCol: 0 })).toBeNull();
  });
});

describe("colours", () => {
  it("only keeps swatches with a true colour", () => {
    const s = checkScene({ family: "colours", layout: "row", swatches: [{ name: "Lithium", hex: "#d8343c" }, { name: "Sodium", hex: "yellow" }, { name: "Copper", hex: "#2FB89A" }], lit: 2, note: "Flame test colours" });
    if (s?.family !== "colours") throw new Error("no colours");
    expect(s.swatches).toEqual([{ name: "Lithium", hex: "#D8343C" }, { name: "Copper", hex: "#2FB89A" }]);
    expect(s.lit).toBe(1);
    expect(canDraw(s)).toBe(true);
    expect(checkScene({ family: "colours", layout: "wheel", swatches: [{ name: "Red", hex: "#FF0000" }, { name: "Blue", hex: "#0000FF" }], lit: 0, note: "" })).toBeNull();
  });

  it("is the only place colour is the subject", () => {
    expect(SCENE_PROMPT).toContain("When colour is the subject, use colours");
  });
});

describe("staves", () => {
  it("keeps real pitches the stave can hold", () => {
    const s = checkScene({ family: "stave", clef: "treble", time: "4/4", notes: [{ pitch: "c4", length: "quarter", label: "C" }, { pitch: "H4", length: "quarter", label: "?" }, { pitch: "F♯4", length: "half", label: "F sharp" }, { pitch: "C4+E4+G4+C9", length: "whole", label: "C major" }, { pitch: "", length: "rest", label: "x" }, { pitch: "C1", length: "quarter", label: "low" }], lit: 2 });
    if (s?.family !== "stave") throw new Error("no stave");
    expect(s.notes.map((n) => n.pitch)).toEqual(["C4", "F#4", "C4+E4+G4", ""]);
    expect(s.notes[3]).toEqual({ pitch: "", length: "rest", label: "" });
    expect(canDraw(s)).toBe(true);
    expect(checkPlay(play("step"), s)).not.toBeNull();
  });

  it("is nothing without a note, and drops a time signature it does not know", () => {
    expect(checkScene({ family: "stave", clef: "bass", time: "", notes: [{ pitch: "", length: "rest", label: "" }], lit: 0 })).toBeNull();
    const s = checkScene({ family: "stave", clef: "bass", time: "7/8", notes: [{ pitch: "G2", length: "quarter", label: "G" }], lit: 0 });
    expect(s?.family === "stave" && s.time).toBe("");
  });

  it("has both clefs to draw", () => {
    expect(hasThing("treble_clef")).toBe(true);
    expect(hasThing("bass_clef")).toBe(true);
  });
});

describe("all kinds of people, and care", () => {
  it("builds people who use a wheelchair, a stick or a cane, and wear what they wear", () => {
    for (const p of ["in_wheelchair", "pregnant", "with_stick", "with_cane", "on_crutches", "holding_baby", "signing"]) expect(KIT_POSES, p).toContain(p);
    for (const w of ["headscarf", "turban", "kippah", "long_hair", "curly_hair", "bun", "glasses"]) expect(KIT_WEARS, w).toContain(w);
    expect(asThing("person:in_wheelchair:neutral:glasses:clipboard")).toBe("person:in_wheelchair:neutral:glasses:clipboard");
    expect(hasThing("person:in_wheelchair:neutral:glasses:clipboard")).toBe(true);
    expect(hasThing("person:pregnant:happy:headscarf")).toBe(true);
  });

  it("has the cut-throughs, mouth shapes and arts drawings", () => {
    for (const n of ["heart_section", "eye_section", "skin_section", "synapse", "nephron", "plate_boundary", "piston", "titration", "mouth_open", "mouth_side", "shot_close", "perspective_one", "floor_plan"]) expect(THING_NAMES, n).toContain(n);
  });

  it("gives no picture when a label is in a script the app cannot draw yet", () => {
    const table = (word: string) => checkScene({ family: "table", title: "", cols: ["Word", "Meaning"], rows: [[word, "hello"]], litRow: 0, litCol: 0 });
    expect(table("你好")).toBeNull();
    expect(table("مرحبا")).toBeNull();
    expect(table("नमस्ते")).toBeNull();
    expect(table("nǐ hǎo")?.family).toBe("table");
    expect(table("привет")?.family).toBe("table");
    expect(table("γειά")?.family).toBe("table");
    expect(table("ʃ")?.family).toBe("table");
  });

  it("writes down the rules of care", () => {
    for (const rule of ["Real, named people", "Hard topics", "Draw the structure, never the suffering", "When not to draw", "All kinds of people", "romanised form"]) expect(SCENE_PROMPT, rule).toContain(rule);
  });

  it("the app can draw every new kind of picture", () => {
    for (const f of ["body", "circuit", "table", "colours", "stave"]) expect(DRAWABLE, f).toContain(f);
  });
});

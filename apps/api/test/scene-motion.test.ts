// Movement in the drawn lessons: a person who changes pose, marker gestures,
// and what one picture keeps from the one before.
import { describe, expect, it } from "vitest";
import { checkScene, SCENE_PROMPT, thenOf, type StageScene, type ThingsScene } from "../src/scene";
import { carryPlan, stageSpots, thingsSpots } from "../../mobile/src/teach/scene/carry";
import type { Scene as AppScene } from "../../mobile/src/teach/scene/types";

const app = (s: unknown) => checkScene(s) as unknown as AppScene;
const stage = (actors: unknown[], extra: Record<string, unknown> = {}) => ({ family: "stage", place: "", placeLabel: "", actors, acts: [{ from: 0, to: 0, kind: "says", label: "No" }], lit: 0, ...extra });

describe("a person who changes pose", () => {
  it("keeps the hat, so it stays the same character", () => {
    expect(thenOf("person:asking:worried:cap", "person:sad:sad")).toBe("person:sad:sad:cap");
    expect(thenOf("person:asking:worried:cap", "person:sad:sad:crown")).toBe("person:sad:sad:cap");
  });
  it("is only for built people, and only when something changes", () => {
    expect(thenOf("monarch", "person:kneeling:sad")).toBe("");
    expect(thenOf("person:asking:worried:cap", "factory")).toBe("");
    expect(thenOf("person:asking:worried:cap", "person:asking:worried:cap")).toBe("");
    expect(thenOf("person:asking:worried:cap", "")).toBe("");
    expect(thenOf("person:asking:worried:cap", "person:not_a_pose:sad")).toBe("person:stand:sad:cap");
  });
  it("lets one actor change in a picture, not two", () => {
    const s = checkScene(stage([{ thing: "person:asking:worried:cap", label: "Worker", size: "normal", then: "person:sad:sad" }, { thing: "person:proud:proud:tophat", label: "Owner", size: "big", then: "person:refusing:angry" }])) as StageScene;
    expect(s.actors[0].then).toBe("person:sad:sad:cap");
    expect(s.actors[1].then).toBe("");
  });
  it("leaves older pictures as they were", () => {
    const s = checkScene(stage([{ thing: "monarch", label: "King", size: "normal" }, { thing: "farmer", label: "Peasant", size: "normal" }])) as StageScene;
    expect(s.actors.map((a) => [a.then, a.mark])).toEqual([["", ""], ["", ""]]);
  });
});

describe("marker gestures", () => {
  const things = (items: unknown[], layout = "versus") => checkScene({ family: "things", layout, items, parts: [], lit: 0 }) as ThingsScene;
  it("keeps a cross and a tick", () => {
    const s = things([{ thing: "virus", label: "Virus", size: 1, mark: "cross" }, { thing: "bacterium", label: "Bacterium", size: 1, mark: "tick" }]);
    expect(s.items.map((t) => t.mark)).toEqual(["cross", "tick"]);
  });
  it("drops anything else, and more than two", () => {
    expect(things([{ thing: "virus", label: "Virus", size: 1, mark: "circle" }, { thing: "bacterium", label: "Bacterium", size: 1 }]).items.map((t) => t.mark)).toEqual(["", ""]);
    const row = things([{ thing: "virus", label: "A", size: 1, mark: "cross" }, { thing: "bacterium", label: "B", size: 1, mark: "cross" }, { thing: "cell", label: "C", size: 1, mark: "tick" }], "row");
    expect(row.items.every((t) => t.mark === "")).toBe(true);
  });
  it("never marks a lone thing or an orbit", () => {
    expect(things([{ thing: "virus", label: "Virus", size: 1, mark: "cross" }], "row").items[0].mark).toBe("");
    expect(things([{ thing: "sun", label: "Sun", size: 1, mark: "tick" }, { thing: "earth", label: "Earth", size: 1 }], "orbit").items[0].mark).toBe("");
  });
});

describe("what a picture keeps from the one before", () => {
  const a = app(stage([{ thing: "person:asking:worried:cap", label: "Worker", size: "normal" }, { thing: "person:refusing:angry:tophat", label: "Owner", size: "big" }]));
  it("carries the same person by their hat, into a new pose", () => {
    const b = app({ family: "things", layout: "versus", items: [{ thing: "person:sad:sad:cap", label: "Give in", size: 1 }, { thing: "person:shouting:angry:cap", label: "Strike", size: 1 }], parts: [], lit: 1 });
    const plan = carryPlan(a, b)!;
    expect(plan[0]?.thing).toBe("person:asking:worried:cap");
    // One worker cannot walk to two places.
    expect(plan[1]).toBeNull();
    const spots = stageSpots(a as never);
    expect(plan[0]).toMatchObject({ x: spots[0], y: spots[1], h: spots[2] });
  });
  it("prefers the very same drawing over the same hat", () => {
    const from = app({ family: "things", layout: "versus", items: [{ thing: "person:sad:sad:cap", label: "Give in", size: 1 }, { thing: "person:shouting:angry:cap", label: "Strike", size: 1 }], parts: [], lit: 1 });
    const to = app(stage([{ thing: "person:shouting:angry:cap", label: "Worker", size: "normal" }, { thing: "march", label: "The others", size: "normal" }]));
    const plan = carryPlan(from, to)!;
    expect(plan[0]?.x).toBe(thingsSpots(from as never)[4]);
    expect(plan[1]).toBeNull();
  });
  it("carries a thing with the same name under it, and a place", () => {
    const from = app({ family: "things", layout: "row", items: [{ thing: "factory", label: "The mill", size: 1 }, { thing: "people", label: "Workers", size: 1 }], parts: [], lit: 0 });
    const to = app({ family: "stage", place: "factory", placeLabel: "The mill", actors: [{ thing: "queue", label: "Workers", size: "normal" }], acts: [{ from: 0, to: -1, kind: "goes", label: "To work" }], lit: 0 });
    const plan = carryPlan(from, to)!;
    expect(plan[0]?.thing).toBe("people");
    expect(plan[1]?.thing).toBe("factory");
  });
  it("carries an actor on as they ended, after a change of pose", () => {
    const from = app(stage([{ thing: "person:asking:worried:cap", label: "Worker", size: "normal", then: "person:sad:sad" }, { thing: "person:refusing:angry:tophat", label: "Owner", size: "big" }]));
    const to = app({ family: "things", layout: "row", items: [{ thing: "person:walking:sad:cap", label: "Worker", size: 1 }, { thing: "house", label: "Home", size: 1 }], parts: [], lit: 0 });
    expect(carryPlan(from, to)![0]?.thing).toBe("person:sad:sad:cap");
  });
  it("keeps nothing when nothing is shared, or the pictures have no fixed places", () => {
    const other = app({ family: "things", layout: "row", items: [{ thing: "tree", label: "Oak", size: 1 }, { thing: "seed", label: "Acorn", size: 1 }], parts: [], lit: 0 });
    expect(carryPlan(a, other)).toBeUndefined();
    expect(carryPlan(null, a)).toBeUndefined();
    expect(carryPlan(app({ family: "compare", style: "bars", items: [{ label: "A", value: 1 }, { label: "B", value: 2 }] }), a)).toBeUndefined();
  });
});

describe("the writer is told", () => {
  it("how to make a person change, mark a verdict and keep a character between pictures", () => {
    expect(SCENE_PROMPT).toContain("then (on an actor");
    expect(SCENE_PROMPT).toContain("Movement between pictures");
    expect(SCENE_PROMPT).toContain("mark (on an item of things or an actor of a stage");
    expect(SCENE_PROMPT).toContain("stage may be used for two bites in a row");
  });
});

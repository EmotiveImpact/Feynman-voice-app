// People, scenes and the kit of parts: a person is a pose with any feeling,
// any hat and any thing in its hand; a building is a shell with a sign.
import { describe, expect, it } from "vitest";
import { asThing, checkPlay, checkScene, KIT_MOODS, KIT_POSES, KIT_SHELLS, KIT_WEARS, SCENE_PROMPT, THING_NAMES } from "../src/scene";
import { hasThing, isPerson } from "../../mobile/src/teach/scene/kit";
import { KIT_FACES, KIT_HATS, KIT_POSES as POSES, KIT_SHELLS as SHELLS } from "../../mobile/src/teach/scene/kitparts";
import { canDraw } from "../../mobile/src/teach/scene/types";

const play = (does: string, target = "x") => ({ prompt: "p", low: "a", high: "b", readouts: ["a", "b", "c"], changes: [{ target, does }] });

describe("the kit of parts", () => {
  it("the server and the app know the same parts", () => {
    expect([...KIT_POSES].sort()).toEqual(Object.keys(POSES).sort());
    expect([...KIT_MOODS].sort()).toEqual(Object.keys(KIT_FACES).sort());
    expect([...KIT_WEARS].sort()).toEqual(Object.keys(KIT_HATS).sort());
    expect([...KIT_SHELLS].sort()).toEqual(Object.keys(SHELLS).sort());
  });

  it("every pose has a body, a head and a hand, and a face it knows", () => {
    for (const [name, p] of Object.entries(POSES)) {
      expect(p.m.length, name).toBeGreaterThan(3);
      expect(p.head.length, name).toBe(2);
      expect(p.hand.length, name).toBe(2);
      expect(KIT_FACES[p.mood] || KIT_FACES.happy, name).toBeTruthy();
    }
  });

  it("a part name never clashes with a drawn thing's kit prefix", () => {
    expect(THING_NAMES.some((n) => n.includes(":"))).toBe(false);
  });

  it("tidies a built person part by part", () => {
    expect(asThing("person:refusing:angry:crown")).toBe("person:refusing:angry:crown");
    expect(asThing("person:holding:happy::scroll")).toBe("person:holding:happy::scroll");
    // An unknown part is dropped, not the whole person.
    expect(asThing("person:refusing:furious:crown")).toBe("person:refusing::crown");
    expect(asThing("person:flying:sad")).toBe("person:stand:sad");
    // Something in the hand needs a hand held out.
    expect(asThing("person:::cap:hammer")).toBe("person:holding::cap:hammer");
    expect(asThing("person:person_running:worried")).toBe("person:running:worried");
    expect(asThing(" Person:Kneeling:Sad ")).toBe("person:kneeling:sad");
    expect(asThing("person:waving")).toBe("person:waving");
  });

  it("tidies a built building", () => {
    expect(asThing("place:hall:scales")).toBe("place:hall:scales");
    expect(asThing("place:block:unicorn")).toBe("place:block");
    expect(asThing("place:castle:coin")).toBe("");
  });

  it("keeps drawn things as they are and refuses the rest", () => {
    expect(asThing("monarch")).toBe("monarch");
    expect(asThing("person")).toBe("person");
    expect(asThing("dragon")).toBe("");
    expect(asThing(7)).toBe("");
    expect(asThing("thing:coin")).toBe("");
  });

  it("the app can draw whatever the server lets through", () => {
    for (const n of ["person:refusing:angry:crown", "person:holding:happy::scroll", "person:stand", "place:hall:scales", "place:block", "monarch"]) expect(hasThing(asThing(n)), n).toBe(true);
    expect(hasThing("person:flying")).toBe(false);
    expect(hasThing("place:castle")).toBe(false);
    expect(hasThing("")).toBe(false);
    expect(isPerson("person:walking")).toBe(true);
    expect(isPerson("person_walking")).toBe(true);
    expect(isPerson("place:hall")).toBe(false);
  });

  it("kit names work in a row of things as well as on a stage", () => {
    const s = checkScene({ family: "things", layout: "row", items: [{ thing: "person:cheering:laugh:mortarboard", label: "Graduate", size: 1 }, { thing: "place:hall:book", label: "University", size: 1 }], parts: [], lit: 0 });
    expect(s?.family === "things" && s.items.map((t) => t.thing)).toEqual(["person:cheering:laugh:mortarboard", "place:hall:book"]);
    expect(canDraw(s as never)).toBe(true);
  });

  it("the prompt teaches the kit", () => {
    expect(SCENE_PROMPT).toContain("person:POSE:MOOD:WEARS:HOLDS");
    expect(SCENE_PROMPT).toContain("place:SHELL:SIGN");
    for (const p of KIT_POSES) expect(SCENE_PROMPT).toContain(p);
  });
});

describe("stage: who does what to whom", () => {
  const strike = { family: "stage", place: "place:block:gear", placeLabel: "The factory", actors: [{ thing: "person:refusing:angry:cap", label: "Workers", size: "normal" }, { thing: "person:holding:worried:tophat:banknote", label: "Owner", size: "big" }], acts: [{ from: 0, to: 1, kind: "against", label: "Pay" }, { from: 0, to: 0, kind: "says", label: "No work" }], lit: 0 };

  it("keeps a scene built from the kit", () => {
    const s = checkScene(strike);
    expect(s?.family).toBe("stage");
    if (s?.family !== "stage") return;
    expect(s.place).toBe("place:block:gear");
    expect(s.actors).toHaveLength(2);
    expect(s.acts).toHaveLength(2);
    expect(canDraw(s)).toBe(true);
  });

  it("drops actors it cannot draw, and the scene when nothing is left", () => {
    const s = checkScene({ ...strike, actors: [{ thing: "dragon", label: "Dragon", size: "normal" }, strike.actors[0]], acts: [{ from: 0, to: 0, kind: "says", label: "No" }] });
    expect(s?.family === "stage" && s.actors).toHaveLength(1);
    expect(checkScene({ ...strike, actors: [{ thing: "dragon", label: "x", size: "normal" }] })).toBeNull();
  });

  it("needs something to happen", () => {
    expect(checkScene({ family: "stage", place: "", placeLabel: "", actors: [{ thing: "person", label: "Someone", size: "normal" }], acts: [], lit: 0 })).toBeNull();
  });

  it("gives each actor one bubble, and an arrow two different ends", () => {
    const s = checkScene({ ...strike, place: "", acts: [{ from: 0, to: 0, kind: "says", label: "One" }, { from: 0, to: 0, kind: "thinks", label: "Two" }, { from: 1, to: 1, kind: "gives", label: "Nothing" }, { from: 0, to: -1, kind: "goes", label: "Nowhere" }] });
    expect(s?.family === "stage" && s.acts.map((a) => a.label)).toEqual(["One"]);
  });

  it("allows the step slider only", () => {
    const s = checkScene(strike);
    expect(checkPlay(play("step"), s)?.changes[0]).toEqual({ target: "", does: "step" });
    expect(checkPlay(play("grow"), s)).toBeNull();
  });
});

describe("quote: which words carry the meaning", () => {
  it("keeps a short passage with its phrase", () => {
    const s = checkScene({ family: "quote", text: "“I have no spur to prick the sides of my intent, but only vaulting ambition”", phrase: "Vaulting ambition", note: "Ambition alone drives him", by: "Macbeth, Act 1" });
    expect(s?.family === "quote" && s.phrase).toBe("Vaulting ambition");
    expect(s?.family === "quote" && s.text.startsWith("I have")).toBe(true);
  });

  it("refuses a phrase that is not in the passage, and a passage too long to read", () => {
    expect(checkScene({ family: "quote", text: "To be or not to be", phrase: "that is the question", note: "", by: "" })).toBeNull();
    expect(checkScene({ family: "quote", text: Array(30).fill("word").join(" "), phrase: "word", note: "", by: "" })).toBeNull();
    expect(checkScene({ family: "quote", text: "To be or not to be", phrase: "", note: "", by: "" })).toBeNull();
  });
});

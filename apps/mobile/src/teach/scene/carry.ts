// What one picture keeps from the one before. A person or thing that is in
// both moves across to its new place and is not drawn again, so a lesson
// reads as one drawing that keeps going. Nothing here draws: it only works
// out where things stand, so the film and the tests can use it too.
import { isPerson } from "./kit";
import type { Scene, StageScene, ThingsScene } from "./types";

/** A thing kept from the picture before: what it was and where it stood. */
export interface Carry {
  thing: string;
  x: number;
  y: number;
  h: number;
  fx: number;
}

/** Where each thing in a things picture sits: x and y of its middle, its half height, and 1. Four numbers each; a half height of 0 means it has no settled place. */
export function thingsSpots(s: ThingsScene) {
  "worklet";
  const n = s.items.length;
  const out: number[] = [];
  if (s.layout === "orbit") {
    for (let i = 0; i < n; i++) out.push(150, 80, i === 0 ? 25 : 0, 1);
    return out;
  }
  if (s.layout === "parts" && s.parts && s.parts.length >= 2) {
    for (let i = 0; i < n; i++) out.push(150, 86, i === 0 ? 50 : 0, 1);
    return out;
  }
  if (s.layout === "scale") {
    const BASE = 140;
    const big = s.items[n - 1].size;
    const hs: number[] = [];
    for (let i = 0; i < n; i++) hs.push(Math.max(3, (116 * s.items[i].size) / big / 2));
    let total = 0;
    for (let i = 0; i < n; i++) total += 2 * Math.max(hs[i], 16);
    const gap = Math.min(30, (270 - total) / Math.max(1, n - 1));
    let xx = 150 - (total + gap * (n - 1)) / 2;
    for (let i = 0; i < n; i++) {
      const slot = 2 * Math.max(hs[i], 16);
      out.push(xx + slot / 2, BASE - hs[i] * 1.05, hs[i] < 7 ? 0 : hs[i], 1);
      xx += slot + gap;
    }
    return out;
  }
  const pitch = Math.min(120, 260 / n);
  const H = n === 1 ? 52 : s.layout === "versus" ? 36 : s.layout === "chain" ? Math.min(28, pitch / 2 - 18) : Math.min(32, pitch / 2 - 10);
  const Y = n === 1 ? 78 : 76;
  for (let i = 0; i < n; i++) out.push(s.layout === "versus" ? (i === 0 ? 80 : 220) : n === 1 ? 150 : 150 + (i - (n - 1) / 2) * pitch, Y, H, 1);
  return out;
}

/** Where each actor on a stage stands, then the place if there is one: x and y of the middle, half height, and which way it faces. Four numbers each. */
export function stageSpots(s: StageScene) {
  "worklet";
  const GY = 134;
  const n = s.actors.length;
  const slots = n + (s.place ? 1 : 0);
  const pitch = Math.min(120, 268 / slots);
  const x0 = 150 - (pitch * slots) / 2;
  const xs: number[] = [];
  for (let i = 0; i < slots; i++) xs.push(x0 + pitch * (i + 0.5));
  // People turn to face whoever they act on, or who acts on them; with nothing between them they face the middle.
  const turn: number[] = [];
  for (let i = 0; i < n; i++) turn.push(n > 1 && i > (n - 1) / 2 ? -1 : 1);
  for (let j = s.acts.length - 1; j >= 0; j--) {
    const act = s.acts[j];
    if (act.kind === "says" || act.kind === "thinks" || act.from >= n) continue;
    const to = act.to < 0 ? n : act.to;
    if (to === act.from || to >= slots) continue;
    if (to < n) turn[to] = xs[act.from] < xs[to] ? -1 : 1;
    turn[act.from] = xs[to] < xs[act.from] ? -1 : 1;
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const h = Math.min(s.actors[i].size === "big" ? 37 : s.actors[i].size === "small" ? 20 : 30, pitch / 2 - 6);
    out.push(xs[i], GY - h * 0.95, h, isPerson(s.actors[i].thing) ? turn[i] : 1);
  }
  if (s.place) {
    const PH = Math.min(40, pitch / 2 - 4);
    out.push(xs[n], GY - PH * 0.95, PH, 1);
  }
  return out;
}

/** True when two drawn things are the same one to the learner: the same drawing, the same name under it, or the same built person (the hat says who). */
function sameOne(a: string, la: string, b: string, lb: string) {
  "worklet";
  if (a === b) return true;
  if (la && la.toLowerCase() === lb.toLowerCase()) return true;
  const qa = a.split(":");
  const qb = b.split(":");
  return qa[0] === "person" && qb[0] === "person" && !!qa[3] && qa[3] === qb[3];
}

/**
 * What one picture keeps from the one before. For each thing the new picture
 * draws (a stage's actors then its place, or a things picture's items), where
 * the same thing stood in the last picture, or null. Undefined when nothing is
 * kept, or when either picture has no people or things in fixed places.
 */
export function carryPlan(from: Scene | null | undefined, to: Scene | null | undefined): (Carry | null)[] | undefined {
  "worklet";
  if (!from || !to) return undefined;
  if ((from.family !== "stage" && from.family !== "things") || (to.family !== "stage" && to.family !== "things")) return undefined;
  const names: string[] = [];
  const labels: string[] = [];
  let spots: number[];
  if (from.family === "stage") {
    for (let i = 0; i < from.actors.length; i++) {
      // An actor who changed pose in the last picture is carried on as they ended.
      names.push(from.actors[i].then || from.actors[i].thing);
      labels.push(from.actors[i].label);
    }
    if (from.place) {
      names.push(from.place);
      labels.push(from.placeLabel);
    }
    spots = stageSpots(from);
  } else {
    for (let i = 0; i < from.items.length; i++) {
      names.push(from.items[i].thing);
      labels.push(from.items[i].label);
    }
    spots = thingsSpots(from);
  }
  const want: string[] = [];
  const wantLabels: string[] = [];
  if (to.family === "stage") {
    for (let i = 0; i < to.actors.length; i++) {
      want.push(to.actors[i].thing);
      wantLabels.push(to.actors[i].label);
    }
    if (to.place) {
      want.push(to.place);
      wantLabels.push(to.placeLabel);
    }
  } else
    for (let i = 0; i < to.items.length; i++) {
      want.push(to.items[i].thing);
      wantLabels.push(to.items[i].label);
    }
  const used: boolean[] = [];
  const out: (Carry | null)[] = [];
  let any = false;
  for (let j = 0; j < want.length; j++) out.push(null);
  // The surest match first: the very same drawing, then the same name under it, then the same hat.
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 0; j < want.length; j++) {
      if (out[j]) continue;
      let hit = -1;
      for (let i = 0; i < names.length && hit < 0; i++) {
        if (used[i] || spots[i * 4 + 2] < 7) continue;
        if (pass === 0 ? names[i] === want[j] : pass === 1 ? sameOne("", labels[i], "-", wantLabels[j]) : sameOne(names[i], "", want[j], "")) hit = i;
      }
      if (hit < 0) continue;
      used[hit] = true;
      any = true;
      out[j] = { thing: names[hit], x: spots[hit * 4], y: spots[hit * 4 + 1], h: spots[hit * 4 + 2], fx: spots[hit * 4 + 3] };
    }
  }
  return any ? out : undefined;
}

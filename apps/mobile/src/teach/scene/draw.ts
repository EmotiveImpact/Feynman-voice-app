// Draws one scene frame onto a Skia canvas. Everything here runs on the UI
// thread as a worklet, once a frame, so it only uses plain maths and Skia.
//
// The visual language (Fenny Drawing Kit v2) follows the principles of
// Visual Value, softened for Fenny:
//   one idea per picture; soft silver lines on near-black, one line weight,
//   rounded ends; only one thing lit (white fill, or steel blue for the thing
//   that changes); no gradients; few, small sentence-case labels;
//   built in a few beats, then at rest with at most one slow movement.
// Kit v5 (Dan Koe's habits): only the one lit thing carries a soft halo,
//   nothing else glows; a lit line drawing on carries a small light at its
//   pen tip, so the eye knows where the explanation is.
// Motion (kit v3): every move means one thing, always.
//   draw on = being built; drift = alive, at rest; jiggle (bounce) = random
//   motion, with a fading trail for speed; cross = through a boundary;
//   rise = bubbles, lighter; fall = grains settling, heavier; flow = carried
//   along; orbit = a repeating cycle; pulse = a signal; grow = more of it;
//   tip = one side wins; slide = where it sits; spark = a reaction; step = a
//   jump between levels. Speed is shown with trails, never blur or glow.
//   Under Reduce Motion nothing loops and only the slider changes the scene.
// The panel is 300 x 176; the view scales it to fit the screen.
import { Skia, type SkCanvas, type SkFont, type SkPaint } from "@shopify/react-native-skia";

import { BODY_FRAMES, BODY_PARTS } from "./bodyparts";
import { carryPlan, stageSpots, thingsSpots, type Carry } from "./carry";
import { hasThing, isPerson } from "./kit";
import { KIT_FACES, KIT_HATS, KIT_POSES, KIT_SHELLS } from "./kitparts";
import { OUTLINES } from "./outlines";
import { THINGS, type ThingMark } from "./things";

import type { BodyScene, CircuitScene, ColoursScene, StaveScene, TableScene, StageScene, QuoteScene, BalanceScene, BondsScene, BraceScene, BridgeScene, CaseScene, Change, EquationScene, ForcesScene, GeometryScene, LeverScene, MachineScene, MatrixScene, PatternScene, ScatterScene, SpectraScene, SpreadScene, WorkingScene, CompareScene, CrowdScene, CutawayScene, FanScene, FunnelScene, GraphScene, GridScene, LayersScene, LinksScene, MapScene, MirrorScene, PairScene, PairSide, ParticlesScene, RadialScene, SankeyScene, Scene, Shape, SpectrumScene, SpiralScene, StackScene, StairsScene, TestScene, ThingsScene, ThresholdScene, TimelineScene, TreeScene, UnitsScene, VennScene, WaveScene, ZoomScene } from "./types";

export const VIEW_W = 300;

export const VIEW_H = 176;

export interface Frame {
  /** Seconds since the scene appeared. */
  t: number;
  /** Seconds, but running faster or slower when a slider changes speed. */
  T: number;
  /** The slider, smoothed, 0 to 1. */
  v: number;
  /** 0 to 1 as the scene builds in. */
  intro: number;
  /** True when Reduce Motion is on: nothing loops. */
  still: boolean;
  /** Hand-drawn lines: a slight, steady marker wobble. */
  hand?: boolean;
  /** Line boil: a step number that changes a few times a second, so the lines look redrawn by hand. 0 or missing: still. */
  boil?: number;
  /** How far the boil moves a line, in panel units. */
  amp?: number;
  /** Seconds since this picture took the place of the last one. It always runs, even while the film holds the build. */
  age?: number;
  /** Things kept from the picture before, in the order this picture lists its own: where each stood, or null. They move across; they are not drawn again. */
  carry?: (Carry | null)[];
}

export { carryPlan, type Carry };

/** Kept for the demo, which compares clean and hand-drawn. The app takes its style from Me (see SceneView). */
export const HAND_DRAWN = false;

/** How far the line boil moves a stroke, in panel units, and how many times a second it changes. */
export const BOIL_GENTLE = 0.42;
export const BOIL_LIVELY = 0.8;
export const BOIL_FPS = 5;

const SIL = "#E6E9EE";

const BLUE = "#A9BEE6";
/** Colour for meaning: the only two colours besides the light, and only ever as a soft wash behind a thing. */
const GOOD = "#86C8A0";
const BAD = "#E0907E";

const LAB = "#8A8F98";

const PANEL = "#0D0E11";

const W0 = 1.6;

const TAU = Math.PI * 2;

// ---- small maths ----
function clamp(x: number, a = 0, b = 1) {
  "worklet";
  return Math.max(a, Math.min(b, x));
}

/** Line boil. Every point of a hand-drawn stroke is nudged by one smooth field, and the field
 * changes a few times a second, so the whole drawing looks redrawn by the same hand. The paint
 * carries the field (see handPaint); with a plain paint nothing moves. */
function wx(p: SkPaint, x: number, y: number) {
  "worklet";
  const a = (p as unknown as { amp?: number }).amp;
  if (!a) return x;
  const s = (p as unknown as { seed: number }).seed;
  return x + a * (Math.sin(y * 0.045 + x * 0.021 + s) + 0.5 * Math.sin(y * 0.11 - x * 0.05 + 2.3 * s));
}

function wy(p: SkPaint, x: number, y: number) {
  "worklet";
  const a = (p as unknown as { amp?: number }).amp;
  if (!a) return y;
  const s = (p as unknown as { seed: number }).seed;
  return y + a * (Math.sin(x * 0.043 - y * 0.019 + 1.7 * s) + 0.5 * Math.sin(x * 0.12 + y * 0.04 + 3.1 * s));
}

/** Soft landing, no overshoot. */
function ease(x: number) {
  "worklet";
  const k = clamp(x);
  return 1 - Math.pow(1 - k, 3);
}

function ease2(x: number) {
  "worklet";
  const k = clamp(x);
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

function rnd(s: number) {
  "worklet";
  const x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function bounce(x: number, L: number) {
  "worklet";
  const m = ((x % (2 * L)) + 2 * L) % (2 * L);
  return m < L ? m : 2 * L - m;
}

/** Beat k of n: each part of the picture lands in turn as it builds. */
function beat(f: Frame, k: number, n: number) {
  "worklet";
  return ease(f.intro * (n + 1) - k);
}

function has(changes: Change[], target: string, does: string) {
  "worklet";
  for (let i = 0; i < changes.length; i++) if (changes[i].does === does && changes[i].target === target) return true;
  return false;
}

function hasKind(changes: Change[], does: string) {
  "worklet";
  for (let i = 0; i < changes.length; i++) if (changes[i].does === does) return true;
  return false;
}

// ---- marks ----
function fill(p: SkPaint, colour: string, a: number) {
  "worklet";
  p.setPathEffect(null);
  p.setStyle(0);
  p.setColor(Skia.Color(colour));
  p.setAlphaf(clamp(a));
}

function stroke(p: SkPaint, colour: string, a: number, w = W0, dash?: number[]) {
  "worklet";
  p.setStyle(1);
  p.setStrokeWidth(w);
  p.setStrokeCap(1);
  p.setStrokeJoin(1);
  p.setColor(Skia.Color(colour));
  p.setAlphaf(clamp(a));
  p.setPathEffect(dash ? Skia.PathEffect.MakeDash(dash, 0) : null);
}

/** The soft halo behind the one lit thing. Nothing else glows. */
function halo(c: SkCanvas, x: number, y: number, r: number, a: number) {
  "worklet";
  const hp = Skia.Paint();
  hp.setColor(Skia.Color(BLUE));
  hp.setAlphaf(clamp(a) * 0.45);
  hp.setMaskFilter(Skia.MaskFilter.MakeBlur(0, Math.min(7, 2.5 + r * 0.25), true));
  c.drawCircle(x, y, r + 1.5, hp);
}

function dot(c: SkCanvas, p: SkPaint, x: number, y: number, r: number, a: number, colour = SIL) {
  "worklet";
  if (a <= 0.01 || r <= 0) return;
  if (colour === BLUE && r >= 3) halo(c, x, y, r, a);
  fill(p, colour, a);
  c.drawCircle(x, y, r, p);
}

function ring(c: SkCanvas, p: SkPaint, x: number, y: number, r: number, a: number, colour = SIL) {
  "worklet";
  if (a <= 0.01 || r <= 0) return;
  stroke(p, colour, a);
  c.drawCircle(x, y, r, p);
}

/** A line drawn on from its start: k from 0 to 1. */
function line(c: SkCanvas, p: SkPaint, x1: number, y1: number, x2: number, y2: number, a: number, colour = SIL, k = 1, dash?: number[], w = W0) {
  "worklet";
  if (a <= 0.01 || k <= 0) return;
  stroke(p, colour, a, w, dash);
  c.drawLine(x1, y1, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, p);
}

function arrow(c: SkCanvas, p: SkPaint, x1: number, y1: number, x2: number, y2: number, a: number, colour = SIL, k = 1) {
  "worklet";
  line(c, p, x1, y1, x2, y2, a, colour, k);
  // The lit line carries a small light at its pen tip while it draws.
  if (colour === BLUE && k > 0.02 && k < 0.98) dot(c, p, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 2.6, a, BLUE);
  if (k < 0.98) return;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const s = 6;
  line(c, p, x2 - Math.cos(ang - 0.5) * s, y2 - Math.sin(ang - 0.5) * s, x2, y2, a, colour);
  line(c, p, x2 - Math.cos(ang + 0.5) * s, y2 - Math.sin(ang + 0.5) * s, x2, y2, a, colour);
}

/** A spark: four short rays where two things meet. It always means "a reaction happened here". */
function spark(c: SkCanvas, p: SkPaint, x: number, y: number, a: number, colour = BLUE) {
  "worklet";
  for (let i = 0; i < 4; i++) {
    const an = Math.PI / 4 + (i * Math.PI) / 2;
    line(c, p, x + Math.cos(an) * 7, y + Math.sin(an) * 7, x + Math.cos(an) * 12, y + Math.sin(an) * 12, a, colour);
  }
}

/** While a label fades in, its letters arrive left to right, as if written. Past this much of the fade the whole label is there. */
const WRITE = 0.6;

/** As much of a label as has been written so far. */
function written(text: string, a: number) {
  "worklet";
  if (a >= WRITE) return text;
  return text.slice(0, Math.max(1, Math.ceil(text.length * (a / WRITE))));
}

/** Text drawn exactly where asked. For turned or scaled drawing, where the panel's edges are not where they seem. */
function rawLabel(c: SkCanvas, p: SkPaint, font: SkFont | null, text: string, x: number, y: number, align: "left" | "center" | "right", colour = LAB, a = 1) {
  "worklet";
  if (!font || !text || a <= 0.01) return;
  const w = font.getTextWidth(text);
  const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  fill(p, colour, a);
  c.drawText(written(text, a), left, y + 3.3, p, font);
}

/** A label. It is nudged sideways if it would run off the panel, so no word is ever lost over the edge. */
function label(c: SkCanvas, p: SkPaint, font: SkFont | null, text: string, x: number, y: number, align: "left" | "center" | "right", colour = LAB, a = 1) {
  "worklet";
  if (!font || !text || a <= 0.01) return;
  const w = font.getTextWidth(text);
  const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  const kept = Math.max(4, Math.min(left, VIEW_W - 4 - w));
  fill(p, colour, a);
  c.drawText(written(text, a), kept, y + 3.3, p, font);
}

/** A label on a small patch of the panel's own colour, so a line passing behind it stops short of the words. */
function knockLabel(c: SkCanvas, p: SkPaint, font: SkFont | null, text: string, x: number, y: number, align: "left" | "center" | "right", colour = LAB, a = 1) {
  "worklet";
  if (!font || !text || a <= 0.01) return;
  const w = font.getTextWidth(text);
  const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  fill(p, PANEL, a);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(left - 3, y - 6, w + 6, 12), 3, 3), p);
  label(c, p, font, text, x, y, align, colour, a);
}

/** Drops whole words from the end until the text fits, so a label is never cut mid-word. */
function fitText(font: SkFont | null, text: string, maxW: number) {
  "worklet";
  if (!font || font.getTextWidth(text) <= maxW) return text;
  const ws = text.split(" ");
  while (ws.length > 1) {
    ws.pop();
    const t = ws.join(" ");
    if (font.getTextWidth(t) <= maxW) return t;
  }
  return ws[0];
}

/** The smallest a single long word may be set, as a share of the normal size. */
const SQUEEZE = 0.76;

/** A label held to a width. Whole words drop from the end first; a single long word is then set a little smaller. A word is never cut. */
function fitLabel(c: SkCanvas, p: SkPaint, font: SkFont | null, text: string, x: number, y: number, align: "left" | "center" | "right", colour: string, a: number, maxW: number) {
  "worklet";
  if (!font || !text || a <= 0.01) return;
  const t = fitText(font, text, maxW);
  const w = font.getTextWidth(t);
  if (w <= maxW) {
    label(c, p, font, t, x, y, align, colour, a);
    return;
  }
  const k = Math.max(SQUEEZE, maxW / w);
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  rawLabel(c, p, font, t, 0, 0, align, colour, a);
  c.restore();
}

function textW(font: SkFont | null, text: string) {
  "worklet";
  return font ? font.getTextWidth(text) : text.length * 5;
}

function label2(c: SkCanvas, p: SkPaint, font: SkFont | null, text: string, x: number, y: number, align: "left" | "center" | "right", colour: string, a: number, maxW: number) {
  "worklet";
  if (!font || !text || a <= 0.01) return;
  const ws = text.split(" ");
  if (textW(font, text) <= maxW || ws.length < 2) {
    fitLabel(c, p, font, text, x, y, align, colour, a, maxW);
    return;
  }
  let best = 1;
  let bestW = 1e9;
  for (let i = 1; i < ws.length; i++) {
    const w = Math.max(textW(font, ws.slice(0, i).join(" ")), textW(font, ws.slice(i).join(" ")));
    if (w < bestW) {
      bestW = w;
      best = i;
    }
  }
  const top = ws.slice(0, best).join(" ");
  const bottom = ws.slice(best).join(" ");
  if (bestW <= maxW) {
    label(c, p, font, top, x, y - 5.6, align, colour, a);
    label(c, p, font, bottom, x, y + 5.6, align, colour, a);
    return;
  }
  // Both lines are set at the same size, so the pair still reads as one name.
  const k = Math.max(SQUEEZE, maxW / bestW);
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  rawLabel(c, p, font, top, 0, -5.6, align, colour, a);
  rawLabel(c, p, font, bottom, 0, 5.6, align, colour, a);
  c.restore();
}

/** For labels centred on points along one row, left to right: which must step to a second row so that neighbours do not touch. */
function stagger(font: SkFont | null, xs: number[], texts: string[], gap: number) {
  "worklet";
  const rows: number[] = [];
  let end0 = -1e9;
  let end1 = -1e9;
  for (let i = 0; i < xs.length; i++) {
    const w = textW(font, texts[i]);
    const l = Math.max(4, Math.min(xs[i] - w / 2, VIEW_W - 4 - w));
    if (l >= end0 + gap || l < end1 + gap) {
      rows.push(0);
      end0 = l + w;
    } else {
      rows.push(1);
      end1 = l + w;
    }
  }
  return rows;
}

function axes(c: SkCanvas, p: SkPaint, font: SkFont | null, f: Frame, L: number, T: number, R: number, B: number, xl: string, yl: string) {
  "worklet";
  const k = beat(f, 0, 4);
  line(c, p, L, B, L, T, 0.32, SIL, k);
  line(c, p, L, B, R, B, 0.32, SIL, k);
  label(c, p, font, xl, (L + R) / 2, B + 14, "center", LAB, k);
  if (font && yl) {
    c.save();
    c.translate(L - 13, (T + B) / 2);
    c.rotate(-90, 0, 0);
    rawLabel(c, p, font, yl, 0, 0, "center", LAB, k);
    c.restore();
  }
}

// ---- path, fork, loop and network ----
function nodePositions(s: LinksScene): number[][] {
  "worklet";
  const n = s.nodes.length;
  const out: number[][] = [];
  if (s.layout === "line") {
    for (let i = 0; i < n; i++) out.push([n === 1 ? 150 : 34 + (i * 232) / (n - 1), n > 3 ? 80 + (i % 2 === 0 ? -20 : 20) : 80]);
  } else if (s.layout === "fork") {
    out.push([48, 88]);
    const m = n - 1;
    for (let i = 0; i < m; i++) out.push([206, m === 1 ? 88 : 28 + (i * 120) / (m - 1)]);
  } else if (s.layout === "loop") {
    if (n === 2) out.push([52, 84], [248, 84]);
    else for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (i / n) * TAU;
      out.push([150 + Math.cos(ang) * 96, 80 + Math.sin(ang) * 52]);
    }
  } else {
    const spots = [[64, 40], [216, 130], [244, 44], [150, 76], [64, 124], [150, 24], [266, 98]];
    for (let i = 0; i < n; i++) out.push(spots[i]);
  }
  return out;
}

/** A point at distance d round a rounded rectangle, clockwise from the top left. */
function aroundLoop(d0: number, L: number, R: number, T: number, B: number, cr: number): number[] {
  "worklet";
  const wSeg = R - L - 2 * cr;
  const hSeg = B - T - 2 * cr;
  const q = (Math.PI / 2) * cr;
  const per = 2 * wSeg + 2 * hSeg + 4 * q;
  let d = ((d0 % per) + per) % per;
  if (d <= wSeg) return [L + cr + d, T];
  if ((d -= wSeg) <= q) { const an = -Math.PI / 2 + d / cr; return [R - cr + Math.cos(an) * cr, T + cr + Math.sin(an) * cr]; }
  if ((d -= q) <= hSeg) return [R, T + cr + d];
  if ((d -= hSeg) <= q) { const an = d / cr; return [R - cr + Math.cos(an) * cr, B - cr + Math.sin(an) * cr]; }
  if ((d -= q) <= wSeg) return [R - cr - d, B];
  if ((d -= wSeg) <= q) { const an = Math.PI / 2 + d / cr; return [L + cr + Math.cos(an) * cr, B - cr + Math.sin(an) * cr]; }
  if ((d -= q) <= hSeg) return [L, B - cr - d];
  d -= hSeg;
  const an = Math.PI + d / cr;
  return [L + cr + Math.cos(an) * cr, T + cr + Math.sin(an) * cr];
}

function drawLinks(c: SkCanvas, p: SkPaint, font: SkFont | null, s: LinksScene, changes: Change[], f: Frame) {
  "worklet";
  const pos = nodePositions(s);
  const stepping = hasKind(changes, "step");
  const tm = hasKind(changes, "speed") ? f.T : f.t;
  const m = s.links.length;
  const lit: boolean[] = [];
  for (let i = 0; i < s.nodes.length; i++) lit.push(false);
  const R = 10;

  if (s.layout === "loop" && s.nodes.length === 2) {
    // A circuit: a soft loop with charge running round.
    const L = 52;
    const Rr = 248;
    const T = 30;
    const B = 138;
    const cr = 20;
    stroke(p, SIL, 0.3 * beat(f, 0, 3));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(L, T, Rr - L, B - T), cr, cr), p);
    const per = 2 * (Rr - L - 2 * cr) + 2 * (B - T - 2 * cr) + TAU * cr;
    const on = stepping ? clamp(f.v * 1.3) : 1;
    for (let i = 0; i < 20; i++) {
      const pt = aroundLoop((i / 20) * per + tm * 60, L, Rr, T, B, cr);
      let near = false;
      for (let k = 0; k < 2; k++) if (Math.abs(pt[0] - pos[k][0]) < 15 && Math.abs(pt[1] - pos[k][1]) < 15) near = true;
      if (!near) dot(c, p, pt[0], pt[1], 2.8, beat(f, 2 + i / 20, 3) * 0.9 * on);
    }
    lit[1] = on > 0.3;
  } else {
    // Light passes (kit v6): cause links are quiet lines, and one light
    // travels them in the order things happen, lighting each node as it
    // arrives. Where the light goes shows the direction, so the lines need
    // no arrowheads. Under Reduce Motion the path is lit at once, with small
    // heads, and the end node is lit.
    // The path the light takes: in a fork only the first outcome, else every cause link in order.
    const path: number[] = [];
    for (let i = 0; i < m; i++) {
      const l = s.links[i];
      if (l.kind === "cause" && (s.layout !== "fork" || l.to === s.links[0].to)) path.push(i);
    }
    const ends = (i: number) => {
      "worklet";
      const l = s.links[i];
      const a1 = pos[l.from];
      const a2 = pos[l.to];
      const ang = Math.atan2(a2[1] - a1[1], a2[0] - a1[0]);
      return [a1[0] + Math.cos(ang) * (R + 5), a1[1] + Math.sin(ang) * (R + 5), a2[0] - Math.cos(ang) * (R + 5), a2[1] - Math.sin(ang) * (R + 5)];
    };
    // Stepping (a slider): the newest link draws on lit, and the node it reaches is lit.
    let newest = -1;
    for (let i = 0; i < m; i++) {
      const l = s.links[i];
      const k = stepping ? clamp(f.v * m * 1.15 - i) : beat(f, 1 + (i / Math.max(1, m)) * 1.5, 3);
      if (k <= 0) continue;
      const e = ends(i);
      const onPath = path.indexOf(i) >= 0;
      if (l.kind === "tie") {
        line(c, p, e[0], e[1], e[2], e[3], 0.25, SIL, k, [2, 5]);
        continue;
      }
      if (l.kind === "cause") {
        const drawing = k < 0.98;
        line(c, p, e[0], e[1], e[2], e[3], onPath ? 0.55 : 0.3, SIL, k);
        // The pen tip carries the light while a line draws.
        if (drawing && onPath) dot(c, p, e[0] + (e[2] - e[0]) * k, e[1] + (e[3] - e[1]) * k, 2.6, 1, BLUE);
        if (f.still && !drawing) {
          const ang = Math.atan2(e[3] - e[1], e[2] - e[0]);
          const hs = 5.5;
          const col = onPath ? BLUE : SIL;
          const ha = onPath ? 0.9 : 0.35;
          if (onPath) line(c, p, e[0], e[1], e[2], e[3], 0.9, BLUE);
          line(c, p, e[2] - Math.cos(ang - 0.5) * hs, e[3] - Math.sin(ang - 0.5) * hs, e[2], e[3], ha, col);
          line(c, p, e[2] - Math.cos(ang + 0.5) * hs, e[3] - Math.sin(ang + 0.5) * hs, e[2], e[3], ha, col);
        }
        if (!drawing && onPath) newest = i;
      } else {
        line(c, p, e[0], e[1], e[2], e[3], 0.15 * k);
        for (let d = 0; d < 5; d++) {
          const q = (d / 5 + tm * 0.2) % 1;
          dot(c, p, e[0] + (e[2] - e[0]) * q, e[1] + (e[3] - e[1]) * q, 2.4, k * Math.sin(q * Math.PI));
        }
      }
    }
    if (path.length > 0) {
      const built = stepping ? newest >= 0 : f.intro >= 0.999;
      if (f.still || stepping) {
        // At rest: the end of the path so far is lit.
        if (built) lit[s.links[stepping ? newest : path[path.length - 1]].to] = true;
      } else if (built) {
        // One light, one link at a time: travel, pause on the node it reached, move on.
        const TRAVEL = 1.1;
        const DWELL = 0.35;
        const loop = s.layout === "loop";
        const cycle = path.length * (TRAVEL + DWELL) + (loop ? 0 : 1.2);
        const u = tm % cycle;
        const at = Math.floor(u / (TRAVEL + DWELL));
        if (at >= path.length) {
          lit[s.links[path[path.length - 1]].to] = true;
        } else {
          const w = u - at * (TRAVEL + DWELL);
          const e = ends(path[at]);
          if (w < TRAVEL) {
            const q = ease2(w / TRAVEL);
            const q0 = Math.max(0, q - 0.3);
            line(c, p, e[0] + (e[2] - e[0]) * q0, e[1] + (e[3] - e[1]) * q0, e[0] + (e[2] - e[0]) * q, e[1] + (e[3] - e[1]) * q, 1, BLUE, 1, undefined, W0 + 0.6);
            dot(c, p, e[0] + (e[2] - e[0]) * q, e[1] + (e[3] - e[1]) * q, 2.6, 1, BLUE);
          } else {
            lit[s.links[path[at]].to] = true;
          }
        }
      }
    }
  }

  for (let i = 0; i < s.nodes.length; i++) {
    const x = pos[i][0];
    const y = pos[i][1];
    const a = beat(f, (i / s.nodes.length) * 0.8, 3);
    dot(c, p, x, y, R, a, PANEL);
    if (lit[i]) dot(c, p, x, y, 6.5, a, BLUE);
    else ring(c, p, x, y, R, a * 0.7);
    // Labels sit outside the shape: a fork's outcomes are named to their right; elsewhere a
    // label goes above a node in the top half and below one in the bottom half, so the links
    // of a zigzag line never run through a name.
    if (s.layout === "fork" && i > 0) {
      fitLabel(c, p, font, s.nodes[i], x + 13, y, "left", lit[i] ? SIL : LAB, a, 300 - x - 17);
      continue;
    }
    const below = y >= 80;
    const ly = below ? (y > 140 ? y - 20 : y + 20) : y < 30 ? y - 15 : y - 20;
    label(c, p, font, s.nodes[i], x, ly, x < 40 ? "left" : x > 260 ? "right" : "center", lit[i] ? SIL : LAB, a);
  }
  // A feedback loop says which kind it is, in the middle: one that builds on itself, or one that settles back.
  if (s.layout === "loop" && s.nodes.length > 2 && s.feedback) {
    const kF = beat(f, 2.4, 3);
    label(c, p, font, s.feedback === "reinforcing" ? "Reinforcing" : "Balancing", 150, 74, "center", SIL, kF);
    label(c, p, font, s.feedback === "reinforcing" ? "builds on itself" : "settles back", 150, 87, "center", LAB, kF * 0.85);
  }
}

// ---- plot: one thing changes with another ----
function shapeY(shape: Shape, x: number, shift: number, stretch: number) {
  "worklet";
  const X = x - shift;
  switch (shape) {
    case "rise":
      return 0.1 + 0.8 * X;
    case "fall":
      return 0.9 - 0.8 * X;
    case "saturate": {
      if (X <= 0) return 0;
      const km = 0.05 + stretch * 0.5;
      return (0.85 * X) / (km + X);
    }
    case "decay":
      return X <= 0 ? 0.9 : 0.9 * Math.exp(-X / (0.08 + stretch * 0.6));
    case "bell": {
      const w = 0.06 + stretch * 0.22;
      return 0.85 * Math.exp(-((X - 0.5) * (X - 0.5)) / (2 * w * w));
    }
    case "grow":
      // Compounding: slow, then steep.
      return X <= 0 ? 0.06 : 0.06 + (0.84 * (Math.exp(3.4 * X) - 1)) / (Math.exp(3.4) - 1);
    case "u_curve":
      return 0.14 + 0.74 * 4 * (X - 0.5) * (X - 0.5);
    case "cycle":
      return 0.5 + 0.32 * Math.sin(X * TAU * (1.2 + (1 - stretch) * 1.1));
    case "steps":
      return 0.12 + 0.76 * (Math.floor(clamp(X, 0, 0.999) * 4) / 3);
    default: {
      const w = 0.03 + stretch * 0.15;
      return 0.9 / (1 + Math.exp(-(X - 0.5) / w));
    }
  }
}

// ---- balance: two sides being weighed ----
function drawBalance(c: SkCanvas, p: SkPaint, font: SkFont | null, s: BalanceScene, changes: Change[], f: Frame) {
  "worklet";
  const lw = has(changes, "left", "weigh") ? Math.round(f.v * 6) : s.leftWeight;
  const rw = has(changes, "right", "weigh") ? Math.round(f.v * 6) : s.rightWeight;
  const cx = 150;
  const cy = 56;
  const arm = 96;
  const tilt = clamp((rw - lw) / 6, -1, 1) * 0.3 * beat(f, 1, 3);
  // Ghost (kit v6): when a slider adds weight, a faint dashed beam stays where it was before.
  const weighing = hasKind(changes, "weigh");
  if (weighing) {
    const lw0 = has(changes, "left", "weigh") ? 0 : s.leftWeight;
    const rw0 = has(changes, "right", "weigh") ? 0 : s.rightWeight;
    const t0 = clamp((rw0 - lw0) / 6, -1, 1) * 0.3 * beat(f, 1, 3);
    if (Math.abs(t0 - tilt) > 0.02) line(c, p, cx - Math.cos(t0) * arm, cy - Math.sin(t0) * arm, cx + Math.cos(t0) * arm, cy + Math.sin(t0) * arm, 0.25, SIL, 1, [3, 6]);
  }
  line(c, p, cx, cy + 6, cx, 140, 0.5, SIL, beat(f, 0, 3));
  line(c, p, cx - 34, 140, cx + 34, 140, 0.35, SIL, beat(f, 0, 3));
  const lx = cx - Math.cos(tilt) * arm;
  const ly = cy - Math.sin(tilt) * arm;
  const rx = cx + Math.cos(tilt) * arm;
  const ry = cy + Math.sin(tilt) * arm;
  line(c, p, lx, ly, rx, ry, 0.9, SIL, beat(f, 1, 3));
  ring(c, p, cx, cy, 4, beat(f, 1, 3));
  const heavier = rw > lw ? 1 : lw > rw ? -1 : 0;
  for (let side = 0; side < 2; side++) {
    const x = side === 0 ? lx : rx;
    const y = side === 0 ? ly : ry;
    const n = side === 0 ? lw : rw;
    const colour = (side === 0 && heavier < 0) || (side === 1 && heavier > 0) ? BLUE : SIL;
    const a = beat(f, 2, 3);
    line(c, p, x, y, x - 20, y + 32, 0.3 * a);
    line(c, p, x, y, x + 20, y + 32, 0.3 * a);
    line(c, p, x - 24, y + 32, x + 24, y + 32, 0.7 * a);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / 3);
      ring(c, p, x - 12 + (i % 3) * 12 + (row % 2) * 6, y + 25 - row * 10, 4.6, a, colour);
    }
    label2(c, p, font, side === 0 ? s.left : s.right, x, y + 50, "center", LAB, a, 104);
  }
  fitLabel(c, p, font, s.middle, cx, 162, "center", heavier !== 0 ? BLUE : LAB, beat(f, 2, 3), 90);
}

// ---- scale and comparison ----
/** A growing item starts at a fifth of its value, so its ghost is still visible. */
const GROW_FROM = 0.2;

function drawCompare(c: SkCanvas, p: SkPaint, font: SkFont | null, s: CompareScene, changes: Change[], f: Frame) {
  "worklet";
  const n = s.items.length;
  const stepping = hasKind(changes, "step");
  const values: number[] = [];
  let maxV = 0;
  let maxI = 0;
  for (let i = 0; i < n; i++) {
    const it = s.items[i];
    const v = has(changes, it.label.toLowerCase(), "grow") ? it.value * (GROW_FROM + (1 - GROW_FROM) * f.v) : it.value;
    values.push(v);
    if (v > maxV) {
      maxV = v;
      maxI = i;
    }
  }
  if (maxV <= 0) return;
  for (let i = 0; i < n; i++) {
    const shown = stepping ? clamp(f.v * n * 1.1 - i) : beat(f, (i / n) * 2, 3);
    if (shown <= 0) continue;
    const growing = has(changes, s.items[i].label.toLowerCase(), "grow");
    const isLit = i === maxI || growing;
    if (s.style === "circles") {
      // Area in proportion. A huge ratio still shows the small one as a dot.
      const cell = VIEW_W / n;
      const maxR = Math.min(cell / 2 - 8, 62);
      const r = Math.max(1.8, maxR * Math.sqrt(values[i] / maxV));
      const x = cell * i + cell / 2;
      const y = 82;
      // A big lit circle is drawn as a blue outline so it never floods the panel.
      // Ghost: where a growing circle started, once it has clearly moved on.
      if (growing && f.v > 0.12) {
        stroke(p, SIL, 0.25 * shown, W0, [3, 6]);
        c.drawCircle(x, y, Math.max(1.8, maxR * Math.sqrt((s.items[i].value * GROW_FROM) / maxV)), p);
      }
      if (isLit && r > 16) ring(c, p, x, y, r, shown, BLUE);
      else if (isLit) dot(c, p, x, y, r, shown, BLUE);
      else if (r < 6) dot(c, p, x, y, r, shown);
      else ring(c, p, x, y, r, shown * 0.85);
      label2(c, p, font, s.items[i].label, x, Math.max(y + r + 16, 106), "center", isLit ? SIL : LAB, shown, cell - 8);
    } else {
      const base = 146;
      const top = 22;
      const bw = Math.min(30, (240 / n) * 0.55);
      const gap = 240 / n;
      const x = 30 + gap * i + (gap - bw) / 2;
      const h = (base - top) * (values[i] / maxV) * ease(shown);
      if (isLit) {
        fill(p, BLUE, shown);
        c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, base - h, bw, h), 3, 3), p);
      } else {
        stroke(p, SIL, shown * 0.7);
        c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, base - h, bw, h), 3, 3), p);
      }
      // Ghost: a faint dashed level where a growing bar started, across and beside it.
      if (growing && f.v > 0.12) {
        const h0 = (base - top) * ((s.items[i].value * GROW_FROM) / maxV);
        line(c, p, x - 8, base - h0, x + bw + 8, base - h0, 0.45 * shown, SIL, 1, [3, 6]);
      }
      label2(c, p, font, s.items[i].label, x + bw / 2, base + 15, "center", isLit ? SIL : LAB, shown, 264 / s.items.length - 6);
    }
  }
  if (s.style === "bars") line(c, p, 24, 146, 276, 146, 0.3, SIL, beat(f, 0, 3));
}

// ---- stairs: levels climbed in order ----
function drawStairs(c: SkCanvas, p: SkPaint, font: SkFont | null, s: StairsScene, changes: Change[], f: Frame) {
  "worklet";
  const n = s.steps.length;
  const lvl = hasKind(changes, "climb") ? Math.round(f.v * (n - 1)) : s.at;
  const w = Math.min(56, 250 / n);
  const h = Math.min(26, 120 / n);
  const x0 = (VIEW_W - w * n) / 2;
  const base = 148;
  line(c, p, x0, base, x0 + n * w, base, 0.3, SIL, beat(f, 0, 3));
  for (let i = 0; i < n; i++) {
    const k = beat(f, (i / n) * 2, 3);
    const x = x0 + i * w;
    const y = base - (i + 1) * h;
    const on = i <= lvl;
    line(c, p, x, base - i * h, x, y, on ? 0.85 : 0.25, SIL, k);
    line(c, p, x, y, x + w, y, on ? 0.85 : 0.25, SIL, k);
    label2(c, p, font, s.steps[i], x + 6, y + 13, "left", on ? SIL : LAB, k, Math.max(w - 8, VIEW_W - 10 - x));
  }
  const px = x0 + lvl * w + w / 2;
  const py = base - (lvl + 1) * h - 9;
  dot(c, p, px, py + (f.still ? 0 : Math.sin(f.t * 1.4) * 1.2), 5, beat(f, 3, 3), BLUE);
}

// ---- spectrum: where something sits between two ends ----
function drawSpectrum(c: SkCanvas, p: SkPaint, font: SkFont | null, s: SpectrumScene, changes: Change[], f: Frame) {
  "worklet";
  const L = 26;
  const R = 274;
  const Y = 92;
  const X = (v: number) => L + ((v - s.min) / (s.max - s.min)) * (R - L);
  line(c, p, L, Y, R, Y, 0.5, SIL, beat(f, 0, 3));
  for (let i = 0; i <= 10; i++) line(c, p, L + (i * (R - L)) / 10, Y - 4, L + (i * (R - L)) / 10, Y + 4, 0.3, SIL, beat(f, 1, 3));
  label2(c, p, font, s.left, L, Y + 26, "left", LAB, beat(f, 1, 3), (R - L) / 2 - 10);
  label2(c, p, font, s.right, R, Y + 26, "right", LAB, beat(f, 1, 3), (R - L) / 2 - 10);
  // Marks that would touch their neighbour step up to a second row.
  const order: number[] = [];
  for (let i = 0; i < s.marks.length; i++) order.push(i);
  order.sort((a, b) => s.marks[a].at - s.marks[b].at);
  const rows = stagger(font, order.map((i) => X(s.marks[i].at)), order.map((i) => s.marks[i].label), 6);
  for (let j = 0; j < order.length; j++) {
    const mx = X(s.marks[order[j]].at);
    const up = rows[j] * 14;
    line(c, p, mx, Y - 10, mx, Y - 22 - up, 0.25, SIL, beat(f, 2, 3));
    label(c, p, font, s.marks[order[j]].label, mx, Y - 30 - up, "center", LAB, beat(f, 2, 3));
  }
  const at = hasKind(changes, "slide") ? s.min + f.v * (s.max - s.min) : s.at;
  const k = beat(f, 3, 3);
  dot(c, p, X(at), Y, 6.5, k, BLUE);
  const span = s.max - s.min;
  label(c, p, font, span <= 20 ? at.toFixed(1) : String(Math.round(at)), X(at), Y - 60, "center", SIL, k);
}

// ---- Venn: what two things share ----
function drawVenn(c: SkCanvas, p: SkPaint, font: SkFont | null, s: VennScene, changes: Change[], f: Frame) {
  "worklet";
  const o = hasKind(changes, "overlap") ? f.v : s.overlap;
  const r = 48;
  const d = 120 - o * 80;
  const cy = 80;
  const ax = 150 - d / 2;
  const bx = 150 + d / 2;
  if (d < 2 * r) {
    c.save();
    const clip = Skia.PathBuilder.Make();
    clip.addCircle(ax, cy, r);
    c.clipPath(clip.build(), 1, true);
    dot(c, p, bx, cy, r, 0.85 * beat(f, 2, 3), BLUE);
    c.restore();
  }
  ring(c, p, ax, cy, r, beat(f, 0, 3));
  ring(c, p, bx, cy, r, beat(f, 1, 3));
  // Each name sits in the middle of its circle's own part, and loses words rather than cross a line.
  const aR = Math.min(bx - r, ax + r);
  const bL = Math.max(ax + r, bx - r);
  fitLabel(c, p, font, s.a, (ax - r + aR) / 2, cy, "center", SIL, beat(f, 0, 3), aR - (ax - r) - 12);
  fitLabel(c, p, font, s.b, (bL + bx + r) / 2, cy, "center", SIL, beat(f, 1, 3), bx + r - bL - 12);
  if (d < 2 * r - 10) label(c, p, font, s.both, 150, cy + r + 18, "center", BLUE, beat(f, 2, 3));
}

/** Draws one frame of a scene in the 300 x 176 view. */
// ---- pair: the difference between X and Y ----
/** A polyline through points (x, y) pairs, drawn on up to k of its length. */
function poly(c: SkCanvas, p: SkPaint, pts: number[], a: number, colour: string, k: number) {
  "worklet";
  const n = pts.length / 2 - 1;
  const upto = k * n;
  for (let i = 0; i < n; i++) {
    const seg = clamp(upto - i);
    if (seg <= 0) break;
    line(c, p, pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3], a, colour, seg);
  }
}

/** One small picture for one side of a pair. Each shape has one meaning. */
function glyph(c: SkCanvas, p: SkPaint, side: PairSide, cx: number, cy: number, colour: string, k: number, live: boolean, f: Frame) {
  "worklet";
  if (k <= 0) return;
  const a = colour === BLUE ? 1 : 0.7;
  const pts: number[] = [];
  switch (side.shape) {
    case "line":
      line(c, p, cx - 44, cy + 30, cx + 44, cy - 30, a, colour, k);
      break;
    case "curve":
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        pts.push(cx - 44 + u * 88, cy + 30 - (64 * (Math.exp(3 * u) - 1)) / (Math.exp(3) - 1));
      }
      poly(c, p, pts, a, colour, k);
      break;
    case "jagged":
      for (let i = 0; i <= 16; i++) {
        const u = i / 16;
        pts.push(cx - 44 + u * 88, cy + 14 - u * 28 + (rnd(i + 5) - 0.5) * 34);
      }
      poly(c, p, pts, a, colour, k);
      break;
    case "smooth":
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        pts.push(cx - 44 + u * 88, cy + 14 - u * 28 + Math.sin(u * TAU) * 3);
      }
      poly(c, p, pts, a, colour, k);
      break;
    case "split":
    case "join": {
      const n = Math.max(2, side.count);
      const one = side.shape === "split" ? cx - 38 : cx + 38;
      const many = side.shape === "split" ? cx + 36 : cx - 36;
      dot(c, p, one, cy, 6, a * ease(k * 2), colour);
      for (let i = 0; i < n; i++) {
        const y = cy + (n === 1 ? 0 : -34 + (i * 68) / (n - 1));
        const kk = clamp(k * 2 - 0.6 - i * 0.08);
        if (side.shape === "split") line(c, p, one + 7, cy, many - 6, y, a * 0.5, colour, kk);
        else line(c, p, many + 6, y, one - 7, cy, a * 0.5, colour, kk);
        dot(c, p, many, y, 4, a * kk, colour);
      }
      break;
    }
    case "scatter":
    case "aligned":
      for (let i = 0; i < 7; i++) {
        const gx = cx - 36 + (i % 3) * 36 + (i >= 6 ? 36 : 0);
        const gy = cy - 26 + Math.floor(i / 3) * 26;
        const ang = side.shape === "aligned" ? 0 : rnd(i + 11) * TAU;
        const kk = clamp(k * 1.6 - i * 0.08);
        arrow(c, p, gx - Math.cos(ang) * 10, gy - Math.sin(ang) * 10, gx + Math.cos(ang) * 10, gy + Math.sin(ang) * 10, a * 0.85, colour, kk);
      }
      break;
    case "one":
      if (colour === BLUE) dot(c, p, cx, cy, 26 * ease(k), a, BLUE);
      else ring(c, p, cx, cy, 26 * ease(k), a);
      break;
    case "many": {
      const n = Math.max(6, Math.min(24, side.count * 3));
      for (let i = 0; i < n; i++) {
        const col = i % 6;
        const row = Math.floor(i / 6);
        dot(c, p, cx - 40 + col * 16, cy - 24 + row * 16, 3.2, a * clamp(k * 1.5 - i / n), colour);
      }
      break;
    }
    case "loop": {
      const r = 30;
      const sweep = 300 * k;
      if (sweep > 1) {
        const b = Skia.PathBuilder.Make();
        b.addArc({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, -90, sweep);
        stroke(p, colour, a);
        c.drawPath(b.build(), p);
      }
      if (live && !f.still && k >= 1) {
        const ang = -Math.PI / 2 + f.t * 0.6;
        dot(c, p, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 4, a, colour);
      }
      break;
    }
    case "path":
    default: {
      arrow(c, p, cx - 44, cy, cx + 44, cy, a, colour, k);
      if (live && !f.still && k >= 1) {
        const q = (f.t * 0.25) % 1;
        dot(c, p, cx - 40 + q * 80, cy, 3.4, a * Math.sin(q * Math.PI), colour);
      }
      break;
    }
  }
}

/**
 * Colour for meaning: one soft wash behind a thing, green for good and red for
 * bad. It is never a line colour and never the only sign of anything: the
 * label and the voice still say what is good or bad.
 */
function toneWash(c: SkCanvas, x: number, y: number, r: number, tone: string | undefined, a: number) {
  "worklet";
  if ((tone !== "good" && tone !== "bad") || a <= 0.01) return;
  const hp = Skia.Paint();
  hp.setColor(Skia.Color(tone === "good" ? GOOD : BAD));
  hp.setAlphaf(clamp(a) * 0.26);
  hp.setMaskFilter(Skia.MaskFilter.MakeBlur(0, 13, true));
  c.drawCircle(x, y, r, hp);
}

function drawPair(c: SkCanvas, p: SkPaint, font: SkFont | null, s: PairScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const kL = beat(f, 0.4, 3);
  // With a step slider, the right side builds in as the slider rises.
  const kR = stepping ? ease(clamp(f.v * 1.25)) * beat(f, 1, 3) : beat(f, 1.4, 3);
  const cy = 80;
  line(c, p, 150, 24, 150, 140, 0.16, SIL, beat(f, 0, 3));
  const sides = [s.left, s.right];
  for (let i = 0; i < 2; i++) {
    const side = sides[i];
    const cx = i === 0 ? 75 : 225;
    const lit = (i === 0 && s.lit === "left") || (i === 1 && s.lit === "right");
    const k = i === 0 ? kL : kR;
    toneWash(c, cx, cy, 44, side.tone, ease(k * 1.5));
    glyph(c, p, side, cx, cy, lit ? BLUE : SIL, k, lit, f);
    label(c, p, font, side.label, cx, 18, "center", lit ? SIL : LAB, ease(k * 2));
    if (side.note) label(c, p, font, side.note, cx, 150, "center", lit ? BLUE : LAB, beat(f, i === 0 ? 2 : 2.5, 3) * ease(k * 1.5));
  }
}

// ---- tree: what branches from what ----
// A root on the left, branches, then leaves named on the right. A light
// travels from the root down the one path the lesson is about, and the node
// it reaches is lit.
function drawTree(c: SkCanvas, p: SkPaint, font: SkFont | null, s: TreeScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const RX = 30;
  const RY = 86;
  const BX = 118;
  const LX = 196;
  let rows = 0;
  for (let b = 0; b < s.branches.length; b++) rows += Math.max(1, s.branches[b].leaves.length);
  const pitch = Math.min(26, 124 / Math.max(1, rows - 1));
  const top = RY - (pitch * (rows - 1)) / 2;
  const by: number[] = [];
  const ly: number[][] = [];
  let row = 0;
  for (let b = 0; b < s.branches.length; b++) {
    const n = Math.max(1, s.branches[b].leaves.length);
    const ys: number[] = [];
    for (let j = 0; j < n; j++) ys.push(top + (row + j) * pitch);
    by.push((ys[0] + ys[n - 1]) / 2);
    ly.push(s.branches[b].leaves.length ? ys : []);
    row += n;
  }
  const lb = s.lit.branch;
  const lf = s.lit.leaf;
  // The light's journey: root to branch, then branch to leaf.
  const lp = stepping ? f.v : beat(f, 3, 3);
  const twoLegs = lf >= 0;
  const leg1 = twoLegs ? clamp(lp * 2) : lp;
  const leg2 = twoLegs ? clamp(lp * 2 - 1) : 0;
  const arrived = lp >= 0.999;

  // Branch names go on after every line, so no later line is drawn across one.
  const names: { t: string; y: number; lit: boolean; a: number }[] = [];
  for (let b = 0; b < s.branches.length; b++) {
    const kB = beat(f, 0.8 + (b / s.branches.length) * 0.5, 3);
    const onPath = b === lb;
    const x1 = RX + 9;
    const x2 = BX - 7;
    line(c, p, x1, RY, x2, by[b], onPath && leg1 >= 1 ? 0.8 : 0.4, SIL, kB);
    if (onPath && leg1 > 0 && leg1 < 1) {
      const q0 = Math.max(0, leg1 - 0.35);
      line(c, p, x1 + (x2 - x1) * q0, RY + (by[b] - RY) * q0, x1 + (x2 - x1) * leg1, RY + (by[b] - RY) * leg1, 1, BLUE, 1, undefined, W0 + 0.6);
      dot(c, p, x1 + (x2 - x1) * leg1, RY + (by[b] - RY) * leg1, 2.6, 1, BLUE);
    }
    const leaves = s.branches[b].leaves;
    for (let j = 0; j < leaves.length; j++) {
      const kL = beat(f, 1.8 + (j / 3) * 0.4, 3);
      const leafLit = onPath && j === lf;
      line(c, p, BX + 7, by[b], LX - 5, ly[b][j], leafLit && leg2 >= 1 ? 0.8 : 0.4, SIL, kL);
      if (leafLit && leg2 > 0 && leg2 < 1) {
        const q0 = Math.max(0, leg2 - 0.35);
        const ax = BX + 7;
        const bx = LX - 5;
        line(c, p, ax + (bx - ax) * q0, by[b] + (ly[b][j] - by[b]) * q0, ax + (bx - ax) * leg2, by[b] + (ly[b][j] - by[b]) * leg2, 1, BLUE, 1, undefined, W0 + 0.6);
        dot(c, p, ax + (bx - ax) * leg2, by[b] + (ly[b][j] - by[b]) * leg2, 2.6, 1, BLUE);
      }
      const lit = leafLit && arrived;
      dot(c, p, LX, ly[b][j], lit ? 5 : 3.4, kL, lit ? BLUE : SIL);
      fitLabel(c, p, font, leaves[j], LX + 10, ly[b][j], "left", lit ? SIL : LAB, kL, VIEW_W - 8 - (LX + 10));
    }
    const branchLit = onPath && !twoLegs && arrived;
    dot(c, p, BX, by[b], 7, kB, PANEL);
    if (branchLit) dot(c, p, BX, by[b], 5, kB, BLUE);
    else ring(c, p, BX, by[b], 7, kB * 0.8);
    // Above the node for branches above the root, below for those under it. A branch level with
    // the root has lines on both sides, so its name sits on a patch that stops them short.
    if (leaves.length) names.push({ t: s.branches[b].label, y: by[b] > RY + 4 ? by[b] + 16 : by[b] - 15, lit: onPath, a: beat(f, 1.6, 3) });
    else fitLabel(c, p, font, s.branches[b].label, BX + 13, by[b], "left", branchLit ? SIL : LAB, beat(f, 1.6, 3), VIEW_W - 8 - (BX + 13));
  }
  for (const nm of names) knockLabel(c, p, font, nm.t, BX, nm.y, "center", nm.lit ? SIL : LAB, nm.a);
  const kR = beat(f, 0, 3);
  dot(c, p, RX, RY, 9, kR, PANEL);
  ring(c, p, RX, RY, 9, kR);
  knockLabel(c, p, font, fitText(font, s.root, 96), 12, RY + 23, "left", LAB, kR);
}

// ---- test: does it pass every condition? ----
// A case travels a path through a row of gates. It stops at the first gate it
// fails, and that gate is lit; if it passes them all it reaches the outcome.
function drawTest(c: SkCanvas, p: SkPaint, font: SkFont | null, s: TestScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.gates.length;
  const Y = 84;
  const X0 = 26;
  const X1 = 280;
  const G0 = 70;
  const G1 = 210;
  const fails = s.fails;
  const stopX = fails >= 0 ? G0 + (fails * (G1 - G0)) / Math.max(1, n - 1) - 11 : X1;
  const kT = stepping ? f.v : beat(f, 3, 3);
  const done = kT >= 0.999;
  const failedNow = done && fails >= 0;

  line(c, p, X0, Y, X1, Y, 0.32, SIL, beat(f, 0, 3));
  for (let i = 0; i < n; i++) {
    const x = G0 + (i * (G1 - G0)) / Math.max(1, n - 1);
    const a = beat(f, 0.8 + (i / n) * 0.8, 3) * (failedNow && i > fails ? 0.3 : 1);
    const lit = failedNow && i === fails;
    const col = lit ? BLUE : SIL;
    const w = lit ? W0 + 0.6 : W0;
    line(c, p, x, Y - 22, x, Y - 9, a * 0.9, col, 1, undefined, w);
    line(c, p, x, Y + 9, x, Y + 22, a * 0.9, col, 1, undefined, w);
    if (lit) dot(c, p, x, Y - 22, 3.2, 1, BLUE);
    const gy = n >= 4 && i % 2 === 1 ? Y - 36 : Y + 36;
    const room = ((G1 - G0) / Math.max(1, n - 1)) * (n >= 4 ? 2 : 1) - 8;
    label2(c, p, font, s.gates[i], x, gy, "center", lit ? SIL : LAB, beat(f, 2, 3) * (failedNow && i > fails ? 0.5 : 1), n === 1 ? 160 : room);
  }
  label2(c, p, font, s.case, 12, Y - 22, "left", LAB, beat(f, 1, 3), G0 - 22);
  // The case: lit while it travels, and at the end if it passes everything.
  const x = X0 + (stopX - X0) * kT;
  const moving = kT > 0.01 && !done;
  if (moving && !f.still) {
    for (let j = 1; j <= 3; j++) dot(c, p, x - j * 4.5, Y, 3 - j * 0.5, 0.5 - j * 0.12);
  }
  const caseLit = moving || (done && fails < 0);
  dot(c, p, x, Y, caseLit ? 5 : 3.6, beat(f, 1, 3), caseLit ? BLUE : SIL);
  if (done && s.outcome) {
    if (fails >= 0) label(c, p, font, s.outcome, stopX + 24, Y - 14, "left", SIL, 1);
    else label(c, p, font, s.outcome, X1, Y - 16, "right", SIL, 1);
  }
}

// ---- threshold: has it crossed the line? ----
// A level rises in a tube against one marked line. The level is lit while it
// rises; once it crosses, the line is lit instead.
function drawThreshold(c: SkCanvas, p: SkPaint, font: SkFont | null, s: ThresholdScene, changes: Change[], f: Frame) {
  "worklet";
  const filling = hasKind(changes, "fill");
  const TX = 62;
  const TW = 34;
  const TT = 22;
  const TB = 142;
  const H = TB - TT;
  const kTube = beat(f, 0, 3);
  stroke(p, SIL, 0.5 * kTube);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(TX, TT, TW, H), 6, 6), p);
  const lv = filling ? f.v : s.value * beat(f, 3, 3);
  const yL = TB - H * lv;
  const yT = TB - H * s.at;
  const crossed = lv >= s.at;
  if (lv > 0.04) {
    fill(p, SIL, 0.1);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(TX + 3, yL, TW - 6, TB - 3 - yL), 3, 3), p);
    line(c, p, TX + 4, yL, TX + TW - 4, yL, 1, crossed ? SIL : BLUE, 1, undefined, crossed ? W0 : W0 + 0.6);
  }
  const kLine = beat(f, 1, 3);
  const LX2 = TX + TW + 58;
  if (crossed) {
    line(c, p, TX - 14, yT, LX2, yT, 1, BLUE, 1, undefined, W0 + 0.6);
    dot(c, p, LX2, yT, 3.2, 1, BLUE);
  } else {
    line(c, p, TX - 14, yT, LX2, yT, 0.7, SIL, kLine, [6, 7]);
  }
  label(c, p, font, s.line, LX2 + 9, yT, "left", crossed ? SIL : LAB, kLine);
  label(c, p, font, s.level, TX + TW / 2, TB + 14, "center", LAB, beat(f, 2, 3));
}

// ---- crowd: which one stands out ----
// Many quiet grey lines with the same shape, then one drawn on lit and named
// at its end.
function crowdY(shape: string, u: number, off: number) {
  "worklet";
  if (shape === "rise") return 0.18 + 0.55 * u + off;
  if (shape === "fall") return 0.75 - 0.55 * u + off;
  return 0.45 + off;
}

function standoutY(s: CrowdScene, u: number) {
  "worklet";
  const bump = Math.exp(-((u - 0.62) * (u - 0.62)) / 0.012);
  if (s.litShape === "peak") return crowdY(s.crowd, u, 0) + 0.3 * bump;
  if (s.litShape === "dip") return crowdY(s.crowd, u, 0) - 0.3 * bump;
  return crowdY(s.litShape, u, 0);
}

function drawCrowd(c: SkCanvas, p: SkPaint, font: SkFont | null, s: CrowdScene, changes: Change[], f: Frame) {
  "worklet";
  const L = 36;
  const R = 262;
  const T = 18;
  const B = 140;
  axes(c, p, font, f, L, T, R, B, s.x, s.y);
  const X = (u: number) => L + 6 + u * (R - L - 12);
  const Y = (v: number) => B - 6 - clamp(v, 0, 1) * (B - T - 14);
  const N = 14;
  for (let j = 0; j < s.count; j++) {
    const off = (rnd(j + 3) - 0.5) * 0.34;
    const k = beat(f, 1 + (j / s.count) * 0.6, 3);
    if (k <= 0.01) continue;
    const path = Skia.PathBuilder.Make();
    const m = Math.max(1, Math.round(N * k));
    for (let i = 0; i <= m; i++) {
      const u = i / N;
      const v = crowdY(s.crowd, u, off) + (rnd(j * 31 + i) - 0.5) * 0.05;
      if (i === 0) path.moveTo(X(u), Y(v));
      else path.lineTo(X(u), Y(v));
    }
    stroke(p, SIL, 0.22);
    c.drawPath(path.build(), p);
  }
  const kL = beat(f, 2.4, 3);
  if (kL > 0.01) {
    const path = Skia.PathBuilder.Make();
    for (let i = 0; i <= 60; i++) {
      const u = (kL * i) / 60;
      if (i === 0) path.moveTo(X(u), Y(standoutY(s, u)));
      else path.lineTo(X(u), Y(standoutY(s, u)));
    }
    stroke(p, BLUE, 1);
    c.drawPath(path.build(), p);
    dot(c, p, X(kL), Y(standoutY(s, kL)), kL < 0.99 ? 2.6 : 3.4, 1, BLUE);
    knockLabel(c, p, font, s.lit, X(1), Y(standoutY(s, 1)) - 13, "right", SIL, clamp((kL - 0.9) * 10));
  }
}

// ---- shared bits for the newer devices ----
/** The light passing along a line: a short lit stretch with a head, k from 0 to 1. */
function pass(c: SkCanvas, p: SkPaint, x1: number, y1: number, x2: number, y2: number, k: number) {
  "worklet";
  if (k <= 0 || k >= 1) return;
  const q0 = Math.max(0, k - 0.35);
  line(c, p, x1 + (x2 - x1) * q0, y1 + (y2 - y1) * q0, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 1, BLUE, 1, undefined, W0 + 0.6);
  dot(c, p, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 2.6, 1, BLUE);
}

function drawGraph(c: SkCanvas, p: SkPaint, font: SkFont | null, s: GraphScene, changes: Change[], f: Frame) {
  "worklet";
  const L = 36;
  // The plot gives up some width so each curve's name has room at its end.
  let widest = 0;
  for (let i = 0; i < s.curves.length; i++) widest = Math.max(widest, textW(font, s.curves[i].label));
  const R = Math.max(200, Math.min(280, 286 - widest));
  const T = 18;
  const B = 144;
  const X = (x: number) => L + x * (R - L);
  const Y = (y: number) => B - clamp(y, -0.02, 1.02) * (B - T);
  axes(c, p, font, f, L, T, R, B, s.x, s.y);

  // The lit curve: the one the slider moves, else the second of two.
  let litIndex = s.curves.length > 1 ? 1 : 0;
  for (let i = 0; i < s.curves.length; i++) {
    const n = s.curves[i].name;
    if (has(changes, n, "shift") || has(changes, n, "stretch") || has(changes, n, "ride")) litIndex = i;
  }
  const shifts: number[] = [];
  const stretches: number[] = [];
  for (let i = 0; i < s.curves.length; i++) {
    shifts.push(has(changes, s.curves[i].name, "shift") ? f.v * 0.28 : 0);
    stretches.push(has(changes, s.curves[i].name, "stretch") ? 0.12 + f.v * 0.88 : 0.35);
  }

  for (let i = 0; i < s.curves.length; i++) {
    const cv = s.curves[i];
    const isLit = i === litIndex;
    const stretched = has(changes, cv.name, "stretch");
    const moved = shifts[i] > 0.005 || (stretched && f.v > 0.02);
    for (let pass = moved ? 0 : 1; pass < 2; pass++) {
      const ghost = pass === 0;
      const sh = ghost ? 0 : shifts[i];
      const st = ghost ? (stretched ? 0.12 : 0.35) : stretches[i];
      const k = ghost ? 1 : beat(f, 1 + i, 4);
      const path = Skia.PathBuilder.Make();
      const end = 0.03 + 0.94 * k;
      for (let j = 0; j <= 80; j++) {
        const x = 0.03 + ((end - 0.03) * j) / 80;
        if (j === 0) path.moveTo(X(x), Y(shapeY(cv.shape, x, sh, st)));
        else path.lineTo(X(x), Y(shapeY(cv.shape, x, sh, st)));
      }
      stroke(p, isLit && !ghost ? BLUE : SIL, ghost ? 0.25 : isLit ? 1 : 0.55, W0, ghost ? [3, 6] : undefined);
      c.drawPath(path.build(), p);
      // Pen-tip light on the lit curve while it draws.
      if (isLit && !ghost && k > 0.02 && k < 0.98) dot(c, p, X(end), Y(shapeY(cv.shape, end, sh, st)), 2.6, 1, BLUE);
    }
    if (cv.label) {
      // A short name sits just past the end of its curve. A longer one tucks in above the end, on a patch that stops the line short of the words.
      const ex = X(0.97);
      const ey = Y(shapeY(cv.shape, 0.97, shifts[i], stretches[i]));
      if (ex + 6 + textW(font, cv.label) <= VIEW_W - 4) label(c, p, font, cv.label, ex + 6, ey, "left", isLit ? BLUE : LAB, beat(f, 3, 4));
      else knockLabel(c, p, font, cv.label, ex + 4, ey > 34 ? ey - 12 : ey + 13, "right", isLit ? BLUE : LAB, beat(f, 3, 4));
    }
  }

  const lit = s.curves[litIndex];
  const kH = beat(f, 3, 4);
  if (s.highlight === "crossing" && s.curves.length > 1) {
    let prev = 0;
    let found = -1;
    for (let k = 0; k <= 200; k++) {
      const x = k / 200;
      const d = shapeY(s.curves[0].shape, x, shifts[0], stretches[0]) - shapeY(s.curves[1].shape, x, shifts[1], stretches[1]);
      if (k > 0 && (d === 0 || d > 0 !== prev > 0)) {
        found = x;
        break;
      }
      prev = d;
    }
    if (found >= 0) {
      const px = X(found);
      const py = Y(shapeY(s.curves[0].shape, found, shifts[0], stretches[0]));
      line(c, p, px, py, px, B, 0.3, SIL, kH, [2, 5]);
      line(c, p, px, py, L, py, 0.3, SIL, kH, [2, 5]);
      dot(c, p, px, py, 4.5, kH);
    }
  } else if (s.highlight === "half") {
    let idx = 0;
    for (let i = 0; i < s.curves.length; i++) if (s.curves[i].shape === "saturate") idx = i;
    const kx = shifts[idx] + 0.05 + stretches[idx] * 0.5;
    line(c, p, L, Y(0.85), R, Y(0.85), 0.25, SIL, beat(f, 1, 4), [2, 5]);
    label(c, p, font, "Max", R, Y(0.85) - 9, "right", LAB, beat(f, 1, 4));
    line(c, p, L, Y(0.425), X(kx), Y(0.425), 0.3, SIL, kH, [2, 5]);
    line(c, p, X(kx), Y(0.425), X(kx), B, 0.3, SIL, kH, [2, 5]);
    label(c, p, font, "Half", L + 4, Y(0.425) - 9, "left", LAB, kH);
    dot(c, p, X(kx), Y(0.425), 4.5, kH);
  } else if (s.highlight === "end") {
    dot(c, p, X(0.97), Y(shapeY(lit.shape, 0.97, shifts[litIndex], stretches[litIndex])), 4.5, kH);
  }

  const rides = has(changes, lit.name, "ride");
  if (rides || s.highlight === "ride") {
    const q = rides ? 0.05 + f.v * 0.9 : f.still ? 0.4 : 0.05 + ((f.t * 0.1) % 1) * 0.9;
    const yq = shapeY(lit.shape, q, shifts[litIndex], stretches[litIndex]);
    if (rides) {
      line(c, p, X(q), Y(yq), X(q), B, 0.3, SIL, kH, [2, 5]);
      line(c, p, X(q), Y(yq), L, Y(yq), 0.3, SIL, kH, [2, 5]);
    }
    dot(c, p, X(q), Y(yq), 4.2, kH * (rides || f.still ? 1 : Math.sin(((q - 0.05) / 0.9) * Math.PI)), BLUE);
  }
}

/** A polyline through points [x0, y0, x1, y1, ...]. */
function strokePts(c: SkCanvas, p: SkPaint, pts: number[], a: number, colour = SIL, w = W0, dash?: number[]) {
  "worklet";
  if (a <= 0.01 || pts.length < 4) return;
  const path = Skia.PathBuilder.Make();
  path.moveTo(wx(p, pts[0], pts[1]), wy(p, pts[0], pts[1]));
  for (let i = 2; i < pts.length; i += 2) path.lineTo(wx(p, pts[i], pts[i + 1]), wy(p, pts[i], pts[i + 1]));
  stroke(p, colour, a, w, dash);
  c.drawPath(path.build(), p);
}

/** Many separate lines in one go (a coastline): each entry is a flat list of x, y. */
function strokeLines(c: SkCanvas, p: SkPaint, lines: number[][], a: number, colour = SIL, w = W0, dash?: number[]) {
  "worklet";
  if (a <= 0.01 || !lines.length) return;
  const path = Skia.PathBuilder.Make();
  for (let j = 0; j < lines.length; j++) {
    const pts = lines[j];
    path.moveTo(wx(p, pts[0], pts[1]), wy(p, pts[0], pts[1]));
    for (let i = 2; i < pts.length; i += 2) path.lineTo(wx(p, pts[i], pts[i + 1]), wy(p, pts[i], pts[i + 1]));
  }
  stroke(p, colour, a, w, dash);
  c.drawPath(path.build(), p);
}

/** A filled shape through points. */
function fillPts(c: SkCanvas, p: SkPaint, pts: number[], a: number, colour: string) {
  "worklet";
  if (a <= 0.01 || pts.length < 6) return;
  const path = Skia.PathBuilder.Make();
  path.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
  path.close();
  fill(p, colour, a);
  c.drawPath(path.build(), p);
}

/** Points round an arc, angles in radians. */
function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n: number) {
  "worklet";
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return pts;
}

/** A soft box: outlined, or lit with a wash of blue. */
function box(c: SkCanvas, p: SkPaint, x: number, y: number, w: number, h: number, a: number, lit: boolean, r = 4) {
  "worklet";
  if (a <= 0.01 || w <= 0 || h <= 0) return;
  const rr = Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r);
  if (lit) {
    fill(p, BLUE, 0.14 * a);
    c.drawRRect(rr, p);
  }
  stroke(p, lit ? BLUE : SIL, lit ? a : 0.55 * a, lit ? W0 + 0.4 : W0);
  c.drawRRect(rr, p);
}


/** 1000 as "1,000". */
function fmt(n: number) {
  "worklet";
  const r = Math.round(n);
  const s = String(Math.abs(r));
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += ",";
    out += s[i];
  }
  return (r < 0 ? "-" : "") + out;
}

function pct(share: number) {
  "worklet";
  return `${share >= 10 ? Math.round(share) : Math.round(share * 10) / 10}%`;
}

/** Text alignment that keeps a label inside the panel. */
function alignAt(x: number) {
  "worklet";
  return x < 46 ? "left" : x > 254 ? "right" : "center";
}

// ---- grid: where does it fall on two scales at once? ----
// A two by two. The item travels to its place and lights its quadrant's name.
function drawGrid(c: SkCanvas, p: SkPaint, font: SkFont | null, s: GridScene, changes: Change[], f: Frame) {
  "worklet";
  const sliding = hasKind(changes, "slide");
  const L = 52;
  const R = 248;
  const T = 30;
  const B = 150;
  const MX = (L + R) / 2;
  const MY = (T + B) / 2;
  const k0 = beat(f, 0, 3);
  line(c, p, L, MY, R, MY, 0.4, SIL, k0);
  line(c, p, MX, B, MX, T, 0.4, SIL, k0);
  label2(c, p, font, s.x, R, MY + 15, "right", LAB, beat(f, 0.6, 3), R - MX - 8);
  label(c, p, font, s.y, MX, T - 12, "center", LAB, beat(f, 0.6, 3));
  // Keep the item clear of the corner names.
  const X = L + s.atX * (R - L);
  const Y = B - 22 - s.atY * (B - T - 44);
  const fx = sliding ? L + (1 - s.atX) * (R - L) : MX;
  const fy = sliding ? B - 22 - (1 - s.atY) * (B - T - 44) : MY;
  const u = sliding ? f.v : beat(f, 2.4, 3);
  const x = fx + (X - fx) * u;
  const y = fy + (Y - fy) * u;
  const arrived = u >= 0.999;
  const q = (y < MY ? 0 : 2) + (x > MX ? 1 : 0);
  const kQ = beat(f, 1.2, 3);
  const qx = [L + 4, R - 4, L + 4, R - 4];
  const qy = [T + 9, T + 9, B - 7, B - 7];
  const qa: ("left" | "right")[] = ["left", "right", "left", "right"];
  for (let i = 0; i < 4; i++) label2(c, p, font, s.quadrants[i], qx[i], qy[i] + (i < 2 ? 3 : -3), qa[i], arrived && i === q ? SIL : LAB, kQ * (arrived && i !== q ? 0.7 : 1), (R - L) / 2 - 12);
  const kI = beat(f, 2, 3);
  if (u > 0.02 && u < 0.98 && !f.still) {
    for (let j = 1; j <= 3; j++) dot(c, p, x - (X - fx) * 0.05 * j, y - (Y - fy) * 0.05 * j, 3 - j * 0.6, (0.5 - j * 0.12) * kI);
  }
  dot(c, p, x, y, 5, kI, BLUE);
  // The name sits toward the middle line, away from the corner names.
  const iw = textW(font, s.item);
  const right = x < MX ? x + 10 + iw <= MX - 4 || x - 10 - iw < 4 : x + 10 + iw <= VIEW_W - 4;
  knockLabel(c, p, font, s.item, right ? x + 10 : x - 10, y < MY ? y + 10 : y - 10, right ? "left" : "right", SIL, kI);
}

// ---- timeline: when, and in what order? ----
// Events on a line. A light travels from the start to the lit event; what it
// has passed is drawn firmer than what is still to come.
function drawTimeline(c: SkCanvas, p: SkPaint, font: SkFont | null, s: TimelineScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.events.length;
  const X0 = 30;
  const X1 = 270;
  const Y = 90;
  const t0 = s.events[0].t;
  const t1 = s.events[n - 1].t;
  const xs: number[] = [];
  for (let i = 0; i < n; i++) xs.push(s.scale === "true" && t1 > t0 ? X0 + ((s.events[i].t - t0) / (t1 - t0)) * (X1 - X0) : X0 + (i * (X1 - X0)) / Math.max(1, n - 1));
  line(c, p, X0 - 14, Y, X1 + 14, Y, 0.35, SIL, beat(f, 0, 3));
  const u = stepping ? 1 : beat(f, 2.4, 3);
  const target = stepping ? X0 + (X1 - X0) * f.v : xs[s.at];
  const lx = X0 + (target - X0) * u;
  if (lx > X0 + 0.5) line(c, p, X0, Y, lx, Y, 0.75, SIL);
  let litI = s.at;
  if (stepping) {
    litI = -1;
    for (let i = 0; i < n; i++) if (xs[i] <= lx + 0.5) litI = i;
  }
  const arrived = stepping ? litI >= 0 : u >= 0.999;
  // Rows for the labels, so none overlap: above, below, then further out with a leader.
  const rowEnd = [-999, -999, -999, -999];
  for (let i = 0; i < n; i++) {
    const e = s.events[i];
    const w = Math.max(textW(font, e.label), textW(font, e.when));
    const align = alignAt(xs[i]);
    const a0 = align === "left" ? xs[i] - 3 : align === "right" ? xs[i] + 3 - w : xs[i] - w / 2;
    let row = 0;
    while (row < 3 && a0 < rowEnd[row] + 6) row++;
    rowEnd[row] = a0 + w;
    const up = row % 2 === 0;
    const far = row >= 2;
    const ly = up ? Y - (far ? 41 : 15) : Y + (far ? 43 : 17);
    const wy = up ? ly - 13 : ly + 13;
    const kE = beat(f, 0.8 + (i / n) * 1.0, 3);
    const passed = xs[i] <= lx + 0.5;
    const lit = arrived && i === litI;
    if (far) line(c, p, xs[i], up ? Y - 7 : Y + 7, xs[i], up ? ly + 6 : ly - 6, 0.22 * kE, SIL);
    line(c, p, xs[i], Y - 5, xs[i], Y + 5, kE * (passed ? 0.9 : 0.5), SIL);
    if (lit) dot(c, p, xs[i], Y, 5, 1, BLUE);
    else dot(c, p, xs[i], Y, 2.6, kE * (passed ? 0.9 : 0.45));
    const ax = align === "left" ? xs[i] - 3 : align === "right" ? xs[i] + 3 : xs[i];
    label(c, p, font, e.label, ax, ly, align, lit ? SIL : LAB, kE);
    label(c, p, font, e.when, ax, wy, align, LAB, kE * 0.75);
  }
  const head = stepping ? !arrived || Math.abs(lx - xs[litI]) > 3 : u > 0.01 && u < 0.999;
  if (head) {
    if (!f.still && !stepping) for (let j = 1; j <= 3; j++) dot(c, p, lx - j * 4.5, Y, 2.6 - j * 0.5, 0.5 - j * 0.12);
    dot(c, p, lx, Y, 2.9, 1, BLUE);
  }
}

// ---- layers: what is built on, or inside, what? ----
// stack: bands built from the bottom up. nested: half rings, outermost first.
function drawLayers(c: SkCanvas, p: SkPaint, font: SkFont | null, s: LayersScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.layers.length;
  const litI = stepping ? Math.min(n - 1, Math.floor(f.v * n)) : s.at;
  const kLit = stepping ? 1 : beat(f, 2.6, 3);
  if (s.style === "nested") {
    const CX = 150;
    const CY = 156;
    const R0 = 136;
    line(c, p, CX - R0 - 6, CY, CX + R0 + 6, CY, 0.3, SIL, beat(f, 0, 3));
    for (let i = 0; i < n; i++) {
      const ro = (R0 * (n - i)) / n;
      const ri = (R0 * (n - i - 1)) / n;
      const k = beat(f, 0.2 + (i / n) * 1.6, 3);
      const lit = i === litI && kLit > 0.01;
      if (lit) {
        const pts = arcPts(CX, CY, ro, Math.PI, TAU, 36);
        const inner = ri > 0 ? arcPts(CX, CY, ri, TAU, Math.PI, 24) : [CX, CY];
        fillPts(c, p, pts.concat(inner), 0.14 * kLit, BLUE);
      }
      strokePts(c, p, arcPts(CX, CY, ro, Math.PI, Math.PI + Math.PI * k, 40), lit ? kLit : 0.55, lit ? BLUE : SIL, lit ? W0 + 0.4 : W0);
      label2(c, p, font, s.layers[i], CX, CY - (ro + ri) / 2, "center", lit ? SIL : LAB, k, 2 * Math.sqrt(ro * ro - ((ro + ri) / 2) * ((ro + ri) / 2)) - 12);
    }
    label(c, p, font, s.whole, CX, CY + 13, "center", LAB, beat(f, 1, 3));
    return;
  }
  const W = 176;
  const X = 150 - W / 2 + 10;
  const h = Math.min(24, (128 - (n - 1) * 4) / n);
  const total = n * h + (n - 1) * 4;
  const top = 88 - total / 2;
  for (let i = 0; i < n; i++) {
    const k = beat(f, 0.2 + ((n - 1 - i) / n) * 1.6, 3);
    const y = top + i * (h + 4) - (1 - k) * 8;
    const lit = i === litI && kLit > 0.5;
    box(c, p, X, y, W, h, k, lit);
    fitLabel(c, p, font, s.layers[i], X + W / 2, y + h / 2, "center", lit ? SIL : LAB, k, W - 14);
  }
  if (s.whole) {
    const kW = beat(f, 1.6, 3);
    line(c, p, X - 12, top, X - 12, top + total, 0.3, SIL, kW);
    c.save();
    c.translate(X - 22, top + total / 2);
    c.rotate(-90, 0, 0);
    rawLabel(c, p, font, s.whole, 0, 0, "center", LAB, kW);
    c.restore();
  }
}

// ---- wave: what repeats as it travels? ----
// The particles only move up and down (or to and fro); the wave moves along.
// One particle is lit so the eye can follow it.
function drawWave(c: SkCanvas, p: SkPaint, font: SkFont | null, s: WaveScene, changes: Change[], f: Frame) {
  "worklet";
  const X0 = 28;
  const X1 = 272;
  const Y = 90;
  const lam = hasKind(changes, "stretch") ? 60 + 90 * f.v : 96;
  const ampMax = hasKind(changes, "grow") ? 8 + 26 * f.v : 26;
  const amp = ampMax * beat(f, 2, 3);
  const tm = hasKind(changes, "speed") ? f.T : f.t;
  const phase = tm * TAU * 0.45;
  const kD = beat(f, 0, 3);
  if (s.kind === "longitudinal") {
    const N = 26;
    const D = amp * 0.42;
    for (let row = 0; row < 3; row++) {
      const yy = Y - 20 + row * 20;
      for (let i = 0; i < N; i++) {
        const x0 = X0 + ((X1 - X0) * i) / (N - 1);
        const kI = beat(f, 0.3 + (i / N) * 1.2, 3);
        const x = x0 + D * Math.sin((TAU * (x0 - X0)) / lam - phase);
        const lit = row === 1 && i === 9;
        if (lit) {
          line(c, p, x0 - ampMax * 0.42, yy + 9, x0 + ampMax * 0.42, yy + 9, 0.35 * kI, SIL, 1, [2, 4]);
          dot(c, p, x, yy, 4, kI, BLUE);
        } else dot(c, p, x, yy, 2.1, kI * 0.75);
      }
    }
  } else {
    const pts: number[] = [];
    for (let i = 0; i <= 64; i++) {
      const x = X0 + ((X1 - X0) * i * kD) / 64;
      pts.push(x, Y - amp * Math.sin((TAU * (x - X0)) / lam - phase));
    }
    strokePts(c, p, pts, 0.22 * kD);
    const N = 25;
    for (let i = 0; i < N; i++) {
      const x = X0 + ((X1 - X0) * i) / (N - 1);
      const kI = beat(f, 0.4 + (i / N) * 1.2, 3);
      const y = Y - amp * Math.sin((TAU * (x - X0)) / lam - phase);
      const lit = i === 8;
      if (lit) {
        line(c, p, x, Y - ampMax, x, Y + ampMax, 0.3 * kI, SIL, 1, [2, 4]);
        dot(c, p, x, y, 4.2, kI, BLUE);
      } else dot(c, p, x, y, 2.4, kI * 0.85);
    }
    if (s.amplitude) {
      const kA = beat(f, 2.4, 3);
      line(c, p, X1 + 12, Y, X1 + 12, Y - amp, 0.6 * kA, SIL);
      line(c, p, X1 + 8, Y - amp, X1 + 16, Y - amp, 0.6 * kA, SIL);
      label(c, p, font, s.amplitude, X1 + 18, Y - ampMax - 12, "right", LAB, kA);
    }
  }
  if (s.wavelength) {
    const kR = beat(f, 2.6, 3);
    const xa = 64;
    line(c, p, xa, 26, xa + lam, 26, 0.6 * kR, SIL);
    line(c, p, xa, 22, xa, 30, 0.6 * kR, SIL);
    line(c, p, xa + lam, 22, xa + lam, 30, 0.6 * kR, SIL);
    label(c, p, font, s.wavelength, xa + lam / 2, 15, "center", LAB, kR);
  }
  label(c, p, font, s.what, X0, Y + 62, "left", LAB, beat(f, 1, 3));
}

// ---- mirror: what is the partner of this? ----
// Two columns across a dashed mirror. Lighting one side sends the light across
// to its partner.
function drawMirror(c: SkCanvas, p: SkPaint, font: SkFont | null, s: MirrorScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.pairs.length;
  const MX = 150;
  const LX = 120;
  const RX = 180;
  const T = 50;
  const B = 140;
  const span = Math.min(32 * (n - 1), B - T);
  const topY = (T + B) / 2 - span / 2;
  line(c, p, MX, topY - 26, MX, topY + span + 22, 0.35, SIL, beat(f, 0, 3), [4, 6]);
  fitLabel(c, p, font, s.leftTitle, LX, topY - 26, "right", LAB, beat(f, 0.5, 3), LX - 8);
  fitLabel(c, p, font, s.rightTitle, RX, topY - 26, "left", LAB, beat(f, 0.5, 3), VIEW_W - RX - 8);
  const litI = stepping ? Math.min(n - 1, Math.floor(f.v * n)) : s.lit;
  const prog = stepping ? clamp((f.v * n - litI) * 1.6) : beat(f, 2.4, 3);
  const pitch = Math.min(32, (B - T) / Math.max(1, n - 1));
  const y0 = (T + B) / 2 - (pitch * (n - 1)) / 2;
  for (let i = 0; i < n; i++) {
    const y = y0 + i * pitch;
    const k = beat(f, 1 + (i / n) * 0.8, 3);
    const lit = i === litI;
    line(c, p, LX + 8, y, RX - 8, y, lit ? 0.35 : 0.18, SIL, k, [2, 5]);
    const leftOn = lit && prog > 0.01;
    const rightOn = lit && prog >= 0.999;
    dot(c, p, LX, y, leftOn ? 4.2 : 3, k, leftOn ? BLUE : SIL);
    dot(c, p, RX, y, rightOn ? 4.2 : 3, k, rightOn ? BLUE : SIL);
    fitLabel(c, p, font, s.pairs[i].left, LX - 11, y, "right", lit ? SIL : LAB, k, LX - 15);
    fitLabel(c, p, font, s.pairs[i].right, RX + 11, y, "left", lit ? SIL : LAB, k, 300 - RX - 15);
    if (lit) pass(c, p, LX + 5, y, RX - 5, y, prog);
  }
}

// ---- stack: what goes on top, and what comes off first? ----
function drawStack(c: SkCanvas, p: SkPaint, font: SkFont | null, s: StackScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.items.length;
  const W = 116;
  const H = 19;
  const G = 4;
  const X = 150 - W / 2;
  const BOT = 150;
  const yOf = (i: number) => BOT - (i + 1) * H - i * G;
  line(c, p, X - 14, BOT + 3, X + W + 14, BOT + 3, 0.5, SIL, beat(f, 0, 3));
  label2(c, p, font, s.label, X - 16, BOT - 10, "right", LAB, beat(f, 0.5, 3), X - 24);
  // How far through the action: the top item drops in (push) or lifts off (pop).
  let placed = n - 1;
  let moving = n - 1;
  let u = beat(f, 2.4, 3);
  if (stepping) {
    const m = f.v * (s.action === "push" ? n : n - 1);
    if (s.action === "push") {
      placed = Math.min(n, Math.floor(m));
      moving = placed < n ? placed : n - 1;
      u = placed < n ? m - placed : 1;
    } else {
      placed = n - 1 - Math.min(n - 1, Math.floor(m));
      moving = placed;
      u = Math.floor(m) >= n - 1 ? 1 : m - Math.floor(m);
    }
  }
  for (let i = 0; i < n; i++) {
    const kI = stepping ? 1 : beat(f, 0.3 + (i / n) * 1.6, 3);
    if (s.action === "push") {
      if (i > moving) continue;
      if (i === moving) {
        const y = yOf(i) - (1 - ease(u)) * 46;
        const a = clamp(u * 3);
        box(c, p, X, y, W, H, a, true);
        fitLabel(c, p, font, s.items[i], 150, y + H / 2, "center", SIL, a, W - 12);
        continue;
      }
      if (stepping && i >= placed) continue;
    } else {
      if (stepping && i > placed) continue;
      if (i === moving) {
        const y = yOf(i) - ease(u) * 40;
        const a = (1 - u * 0.6) * kI;
        box(c, p, X, y, W, H, a, u > 0.01);
        fitLabel(c, p, font, s.items[i], 150, y + H / 2, "center", u > 0.01 ? SIL : LAB, a, W - 12);
        continue;
      }
    }
    box(c, p, X, yOf(i), W, H, kI, false);
    fitLabel(c, p, font, s.items[i], 150, yOf(i) + H / 2, "center", LAB, kI, W - 12);
  }
}

// ---- radial: what sits round one centre? ----
// A hub with spokes, the light running out along the lit one; or, for a cycle,
// stages round a rim with the light going round in order.
function drawRadial(c: SkCanvas, p: SkPaint, font: SkFont | null, s: RadialScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.spokes.length;
  const CX = 150;
  const CY = 88;
  const R = 58;
  // The centre ring opens up for a long word, so the word never touches it.
  let cw = 0;
  const cws = s.centre.split(" ");
  for (let i = 0; i < cws.length; i++) cw = Math.max(cw, textW(font, cws[i]));
  const RC = Math.max(21, Math.min(31, cw / 2 + 8));
  const ang = (i: number) => -Math.PI / 2 + (i * TAU) / n;
  const litI = stepping ? Math.min(n - 1, Math.floor(f.v * n)) : s.lit;
  const prog = stepping ? clamp((f.v * n - litI) * 1.5) : beat(f, 2.4, 3);
  if (s.cycle) {
    for (let i = 0; i < n; i++) {
      const d = 9 / R;
      const kA = beat(f, 0.8 + (i / n) * 1.2, 3);
      strokePts(c, p, arcPts(CX, CY, R, ang(i) + d, ang(i) + d + (TAU / n - 2 * d) * kA, 16), 0.45);
    }
    // The light goes round the rim from the first stage to the lit one.
    if (litI > 0 && prog > 0 && prog < 1) {
      const a1 = ang(0) + (litI * TAU * prog) / n;
      strokePts(c, p, arcPts(CX, CY, R, Math.max(ang(0), a1 - 0.5), a1, 10), 1, BLUE, W0 + 0.6);
      dot(c, p, CX + R * Math.cos(a1), CY + R * Math.sin(a1), 2.6, 1, BLUE);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = ang(i);
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    const nx = CX + R * cs;
    const ny = CY + R * sn;
    const k = beat(f, 0.8 + (i / n) * 1.0, 3);
    const lit = i === litI;
    const arrived = lit && (prog >= 0.999 || (s.cycle && litI === 0 && prog > 0.5));
    const x1 = CX + (RC + 3) * cs;
    const y1 = CY + (RC + 3) * sn;
    if (!s.cycle) {
      line(c, p, x1, y1, nx - 6 * cs, ny - 6 * sn, arrived ? 0.8 : 0.38, SIL, k);
      if (lit) pass(c, p, x1, y1, nx - 6 * cs, ny - 6 * sn, prog);
    } else line(c, p, x1, y1, nx - 6 * cs, ny - 6 * sn, 0.14, SIL, k);
    dot(c, p, nx, ny, 5, k, PANEL);
    if (arrived) dot(c, p, nx, ny, 5, 1, BLUE);
    else ring(c, p, nx, ny, 5, k);
    const align = cs > 0.25 ? "left" : cs < -0.25 ? "right" : "center";
    const lx = CX + (R + 12) * cs;
    const ly = CY + (R + 12) * sn + (align === "center" ? (sn > 0 ? 3 : -3) : 0);
    label2(c, p, font, s.spokes[i], lx, ly, align, arrived ? SIL : LAB, k, align === "left" ? VIEW_W - 6 - lx : align === "right" ? lx - 6 : 150);
  }
  const kC = beat(f, 0, 3);
  dot(c, p, CX, CY, RC, kC, PANEL);
  ring(c, p, CX, CY, RC, kC);
  label2(c, p, font, s.centre, CX, CY, "center", SIL, kC, 2 * RC - 8);
}

// ---- cutaway: what is the whole made of? ----
// A circle cut into its real shares, one share lit, with a key beside it.
function drawCutaway(c: SkCanvas, p: SkPaint, font: SkFont | null, s: CutawayScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.parts.length;
  const CX = 90;
  const CY = 82;
  const R = 56;
  let total = 0;
  for (let i = 0; i < n; i++) total += s.parts[i].share;
  if (total <= 0) return;
  const starts: number[] = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    starts.push(acc / total);
    acc += s.parts[i].share;
  }
  starts.push(1);
  const shown = stepping ? Math.min(n, Math.floor(f.v * n) + 1) : n;
  const litI = stepping ? shown - 1 : s.lit;
  const kL = stepping ? 1 : beat(f, 2.6, 3);
  const a0 = -Math.PI / 2 + starts[litI] * TAU;
  const a1 = -Math.PI / 2 + starts[litI + 1] * TAU;
  if (kL > 0.01) fillPts(c, p, [CX, CY].concat(arcPts(CX, CY, R, a0, a1, Math.max(4, Math.round((a1 - a0) * 12)))), 0.16 * kL, BLUE);
  strokePts(c, p, arcPts(CX, CY, R, -Math.PI / 2, -Math.PI / 2 + TAU * beat(f, 0, 3), 72), 0.6);
  for (let i = 0; i < shown; i++) {
    const kB = stepping ? 1 : beat(f, 1 + (i / n) * 0.8, 3);
    const a = -Math.PI / 2 + starts[i] * TAU;
    if (n > 1) line(c, p, CX, CY, CX + R * Math.cos(a), CY + R * Math.sin(a), 0.45, SIL, kB);
  }
  if (kL > 0.01) strokePts(c, p, arcPts(CX, CY, R, a0, a1, Math.max(4, Math.round((a1 - a0) * 12))), kL, BLUE, W0 + 0.6);
  const pitch = Math.min(20, 120 / n);
  const top = CY - ((n - 1) * pitch) / 2;
  for (let i = 0; i < shown; i++) {
    const y = top + i * pitch;
    const k = stepping ? 1 : beat(f, 1.4 + (i / n) * 0.8, 3);
    const lit = i === litI && kL > 0.5;
    dot(c, p, 176, y, lit ? 3.4 : 2.4, k, lit ? BLUE : SIL);
    fitLabel(c, p, font, s.parts[i].label, 186, y, "left", lit ? SIL : LAB, k, 290 - textW(font, pct(s.parts[i].share)) - 8 - 186);
    label(c, p, font, pct(s.parts[i].share), 290, y, "right", lit ? SIL : LAB, k);
  }
  label(c, p, font, s.whole, CX, CY + R + 14, "center", LAB, beat(f, 0.6, 3));
}

// ---- funnel: how many drop out at each stage? ----
function drawFunnel(c: SkCanvas, p: SkPaint, font: SkFont | null, s: FunnelScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.stages.length;
  const CXB = 180;
  const MAXW = 150;
  const H = 15;
  const pitch = Math.min(28, 128 / Math.max(1, n - 1));
  const top = 88 - ((n - 1) * pitch) / 2;
  const max = s.stages[0].value;
  const shown = stepping ? Math.min(n, Math.floor(f.v * n) + 1) : n;
  const litI = stepping ? shown - 1 : s.lit;
  const kL = stepping ? 1 : beat(f, 2.6, 3);
  for (let i = 0; i < shown; i++) {
    const w = Math.max(6, (MAXW * s.stages[i].value) / max);
    const y = top + i * pitch;
    const k = stepping ? 1 : beat(f, 0.3 + (i / n) * 1.6, 3);
    const lit = i === litI && kL > 0.5;
    const ww = w * k;
    box(c, p, CXB - ww / 2, y - H / 2, ww, H, k, lit, 3);
    if (i + 1 < shown) {
      const w2 = Math.max(6, (MAXW * s.stages[i + 1].value) / max);
      const k2 = stepping ? 1 : beat(f, 0.3 + ((i + 1) / n) * 1.6, 3);
      line(c, p, CXB - w / 2, y + H / 2, CXB - w2 / 2, y + pitch - H / 2, 0.2 * k2, SIL);
      line(c, p, CXB + w / 2, y + H / 2, CXB + w2 / 2, y + pitch - H / 2, 0.2 * k2, SIL);
    }
    label(c, p, font, s.stages[i].label, 14, y, "left", lit ? SIL : LAB, k);
    label(c, p, font, fmt(s.stages[i].value), 294, y, "right", lit ? SIL : LAB, k);
  }
}

// ---- sankey: how does one flow split, by amount? ----
// One band in, split into bands as thick as their shares; dots ride along them.
function drawSankey(c: SkCanvas, p: SkPaint, font: SkFont | null, s: SankeyScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.splits.length;
  const XS = 20;
  const XM = 84;
  const XE = 190;
  const H = 96;
  const TOP = 40;
  const GAP = 6;
  const kS = beat(f, 0, 3);
  fillPts(c, p, [XS, TOP, XM, TOP, XM, TOP + H, XS, TOP + H], 0.07 * kS, SIL);
  line(c, p, XS, TOP, XM, TOP, 0.45, SIL, kS);
  line(c, p, XS, TOP + H, XM, TOP + H, 0.45, SIL, kS);
  label(c, p, font, s.source, XS, TOP - 11, "left", LAB, kS);
  const shown = stepping ? Math.min(n, Math.floor(f.v * n) + 1) : n;
  const litI = stepping ? shown - 1 : s.lit;
  const kL = stepping ? 1 : beat(f, 2.6, 3);
  let total = 0;
  for (let i = 0; i < n; i++) total += s.splits[i].share;
  const hs: number[] = [];
  const slots: number[] = [];
  let need = GAP * (n - 1);
  for (let i = 0; i < n; i++) {
    hs.push((H * s.splits[i].share) / Math.max(1e-6, total));
    slots.push(Math.max(hs[i], 22));
    need += slots[i];
  }
  let sy = TOP;
  let ty = 88 - need / 2;
  const tm = f.t;
  for (let i = 0; i < n; i++) {
    const h = hs[i];
    const tyb = ty + (slots[i] - h) / 2;
    if (i < shown) {
      const k = stepping ? 1 : beat(f, 1 + (i / n) * 1.2, 3);
      const lit = i === litI && kL > 0.5;
      const topPts: number[] = [];
      const botPts: number[] = [];
      const M = 18;
      for (let j = 0; j <= M; j++) {
        const u = (j / M) * k;
        const e = u * u * (3 - 2 * u);
        const x = XM + (XE - XM) * u;
        topPts.push(x, sy + (tyb - sy) * e);
        botPts.push(x, sy + h + (tyb - sy) * e);
      }
      const shape: number[] = topPts.slice();
      for (let j = botPts.length - 2; j >= 0; j -= 2) shape.push(botPts[j], botPts[j + 1]);
      fillPts(c, p, shape, lit ? 0.2 : 0.07, lit ? BLUE : SIL);
      strokePts(c, p, topPts, lit ? 0.9 : 0.35, lit ? BLUE : SIL);
      strokePts(c, p, botPts, lit ? 0.9 : 0.35, lit ? BLUE : SIL);
      if (k >= 0.999 && !f.still) {
        for (let j = 0; j < 3; j++) {
          const u = (tm * 0.22 + j / 3 + i * 0.13) % 1;
          const e = u * u * (3 - 2 * u);
          dot(c, p, XM + (XE - XM) * u, sy + h / 2 + (tyb - sy) * e, 1.8, 0.55, lit ? BLUE : SIL);
        }
      }
      fitLabel(c, p, font, s.splits[i].label, XE + 8, tyb + h / 2 - 5, "left", lit ? SIL : LAB, k, VIEW_W - 8 - (XE + 8));
      label(c, p, font, pct(s.splits[i].share), XE + 8, tyb + h / 2 + 7, "left", LAB, k);
    }
    sy += h;
    ty += slots[i] + GAP;
  }
}

// ---- fan: how uncertain is the forecast? ----
// The record up to now, then a fan of quiet lines that widens with time and
// one lit central forecast.
function drawFan(c: SkCanvas, p: SkPaint, font: SkFont | null, s: FanScene, changes: Change[], f: Frame) {
  "worklet";
  const L = 36;
  const R = 262;
  const T = 18;
  const B = 140;
  axes(c, p, font, f, L, T, R, B, s.x, s.y);
  const X = (u: number) => L + 6 + u * (R - L - 12);
  const Y = (v: number) => B - 6 - clamp(v, 0, 1) * (B - T - 14);
  const base = (u: number) => crowdY(s.shape, u, 0) * 0.85 + 0.06;
  const g = hasKind(changes, "grow") ? 0.25 + 0.75 * f.v : 1;
  const kP = beat(f, 1, 3);
  const past: number[] = [];
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const u = (s.now * kP * i) / N;
    past.push(X(u), Y(base(u) + (rnd(i * 7 + 1) - 0.5) * 0.05 * (i > 0 && i < N ? 1 : 0)));
  }
  strokePts(c, p, past, 0.8);
  const kN = beat(f, 1.6, 3);
  line(c, p, X(s.now), B - 4, X(s.now), T + 8, 0.28 * kN, SIL, 1, [3, 5]);
  const kF = beat(f, 2, 3);
  const spreadAt = (u: number) => (0.34 * g * (u - s.now)) / Math.max(0.05, 1 - s.now);
  const outer: number[] = [];
  const inner: number[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = s.now + ((1 - s.now) * kF * i) / 24;
    outer.push(X(u), Y(base(u) + spreadAt(u)));
    inner.push(X(u), Y(base(u) - spreadAt(u)));
  }
  const region = outer.slice();
  for (let j = inner.length - 2; j >= 0; j -= 2) region.push(inner[j], inner[j + 1]);
  fillPts(c, p, region, 0.05, SIL);
  for (let m = 1; m <= 3; m++) {
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      const pts: number[] = [];
      for (let i = 0; i <= 24; i++) {
        const u = s.now + ((1 - s.now) * kF * i) / 24;
        pts.push(X(u), Y(base(u) + (sgn * spreadAt(u) * m) / 3));
      }
      strokePts(c, p, pts, 0.14 + 0.04 * (3 - m));
    }
  }
  const kC = beat(f, 2.4, 3);
  if (kC > 0.01) {
    const pts: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const u = s.now + ((1 - s.now) * kC * i) / 24;
      pts.push(X(u), Y(base(u)));
    }
    strokePts(c, p, pts, 1, BLUE);
    const ue = s.now + (1 - s.now) * kC;
    dot(c, p, X(ue), Y(base(ue)), kC < 0.99 ? 2.6 : 3.4, 1, BLUE);
    label(c, p, font, s.label, X(1), Y(base(1) + spreadAt(1)) - 10, "right", SIL, clamp((kC - 0.9) * 10));
  }
}

// ---- spiral: a cycle that builds each time round ----
function drawSpiral(c: SkCanvas, p: SkPaint, font: SkFont | null, s: SpiralScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.stages.length;
  const CX = 150;
  const CY = 80;
  const R0 = 6;
  const R1 = 50;
  const TH = s.turns * TAU;
  const rAt = (th: number) => R0 + ((R1 - R0) * th) / TH;
  const ptAt = (th: number) => [CX + rAt(th) * Math.cos(th - Math.PI / 2), CY + rAt(th) * Math.sin(th - Math.PI / 2)];
  const kD = beat(f, 0, 3);
  const path: number[] = [];
  const M = 160;
  for (let i = 0; i <= M; i++) {
    const q = ptAt((TH * kD * i) / M);
    path.push(q[0], q[1]);
  }
  strokePts(c, p, path, 0.42);
  for (let t = 0; t < s.turns; t++) {
    for (let i = 0; i < n; i++) {
      const th = t * TAU + (i * TAU) / n;
      const q = ptAt(th);
      dot(c, p, q[0], q[1], 2.2, beat(f, 1 + (th / TH) * 0.8, 3) * (0.35 + (0.5 * (t + 1)) / s.turns));
    }
  }
  const lp = stepping ? f.v : beat(f, 2.2, 3);
  const thL = TH * lp;
  const cur = Math.floor((((thL % TAU) + TAU) % TAU) / (TAU / n) + 0.0001) % n;
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n - Math.PI / 2;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    const align = cs > 0.25 ? "left" : cs < -0.25 ? "right" : "center";
    const lit = lp > 0.01 && i === cur;
    // Names sit outside the last turn, so the light never runs over them.
    const lr = R1 + 15;
    label2(c, p, font, s.stages[i], CX + lr * cs, CY + lr * sn + (align === "center" ? (sn > 0 ? 4 : -4) : 0), align, lit ? SIL : LAB, beat(f, 1.6, 3), align === "left" ? VIEW_W - 6 - (CX + lr * cs) : align === "right" ? CX + lr * cs - 6 : 200);
  }
  if (lp > 0.01) {
    const tail: number[] = [];
    for (let i = 0; i <= 12; i++) {
      const q = ptAt(Math.max(0, thL - 0.9) + ((thL - Math.max(0, thL - 0.9)) * i) / 12);
      tail.push(q[0], q[1]);
    }
    strokePts(c, p, tail, 1, BLUE, W0 + 0.6);
    const q = ptAt(thL);
    dot(c, p, q[0], q[1], lp >= 0.999 ? 4.2 : 2.8, 1, BLUE);
  }
  label(c, p, font, s.label, CX, 166, "center", LAB, beat(f, 2, 3));
}

// ---- zoom: the same thing at each scale ----
// Circles left to right, each a closer look at a small square in the one before.
function drawZoom(c: SkCanvas, p: SkPaint, font: SkFont | null, s: ZoomScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.levels.length;
  const r = n <= 3 ? 30 : n === 4 ? 25 : 21;
  const gap = Math.min(110, 236 / Math.max(1, n - 1));
  const x0 = 150 - (gap * (n - 1)) / 2;
  const Y = 74;
  const litI = stepping ? Math.min(n - 1, Math.floor(f.v * n)) : s.at;
  const kL = stepping ? 1 : beat(f, 2.6, 3);
  for (let i = 0; i < n; i++) {
    const x = x0 + i * gap;
    const k = beat(f, 0.3 + (i / n) * 1.4, 3);
    const lit = i === litI && kL > 0.5;
    // Finer detail at each level: more, smaller marks.
    const marks = 4 + i * 3;
    for (let j = 0; j < marks; j++) {
      const a = rnd(j * 3 + i * 17) * TAU;
      const d = Math.sqrt(rnd(j * 5 + i * 11)) * r * 0.7;
      dot(c, p, x + d * Math.cos(a), Y + d * Math.sin(a), Math.max(0.9, 2.2 - i * 0.3), k * 0.4);
    }
    if (lit) {
      fill(p, BLUE, 0.1 * kL);
      c.drawCircle(x, Y, r, p);
    }
    stroke(p, lit ? BLUE : SIL, lit ? kL : 0.6 * k, lit ? W0 + 0.4 : W0);
    c.drawCircle(x, Y, r, p);
    if (i < n - 1) {
      const sq = r * 0.3;
      const sx = x + r * 0.3;
      const sy = Y - r * 0.32;
      stroke(p, SIL, 0.6 * k);
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(sx, sy, sq, sq), 1.5, 1.5), p);
      const nx = x + gap;
      const k2 = beat(f, 0.3 + ((i + 1) / n) * 1.4, 3);
      line(c, p, sx + sq, sy, nx - r * 0.72, Y - r * 0.7, 0.22, SIL, k2);
      line(c, p, sx + sq, sy + sq, nx - r * 0.72, Y + r * 0.7, 0.22, SIL, k2);
      if (i === litI - 1 && !stepping) pass(c, p, sx + sq, sy + sq / 2, nx - r, Y, beat(f, 2.2, 3));
    }
    fitLabel(c, p, font, s.levels[i].label, x, Y + r + 13, "center", lit ? SIL : LAB, k, gap - 6);
    fitLabel(c, p, font, s.levels[i].size, x, Y + r + 26, "center", LAB, k * 0.75, gap - 6);
  }
}

// ---- brace: which belong together? ----
function drawBrace(c: SkCanvas, p: SkPaint, font: SkFont | null, s: BraceScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.items.length;
  const X0 = 34;
  const X1 = 266;
  const Y = 70;
  const xs: number[] = [];
  for (let i = 0; i < n; i++) xs.push(X0 + (i * (X1 - X0)) / (n - 1));
  const g = s.groups.length;
  const shown = stepping ? Math.min(g, Math.floor(f.v * g) + 1) : g;
  const litI = stepping ? shown - 1 : s.lit;
  const kL = stepping ? 1 : beat(f, 2.6, 3);
  const inLit = (i: number) => kL > 0.5 && i >= s.groups[litI].from && i <= s.groups[litI].to;
  const gapX = (X1 - X0) / Math.max(1, n - 1);
  let crowded = false;
  for (let i = 0; i < n; i++) if (textW(font, s.items[i]) > gapX - 8) crowded = true;
  for (let i = 0; i < n; i++) {
    const k = beat(f, 0.2 + (i / n) * 1.0, 3);
    dot(c, p, xs[i], Y, inLit(i) ? 3.6 : 3.2, k * (inLit(i) ? 1 : 0.75));
    const ly = crowded && i % 2 === 1 ? Y - 27 : Y - 14;
    label(c, p, font, s.items[i], xs[i], ly, alignAt(xs[i]), inLit(i) ? SIL : LAB, k);
  }
  for (let j = 0; j < shown; j++) {
    const gr = s.groups[j];
    const a = xs[gr.from] - 10;
    const b = xs[gr.to] + 10;
    const mid = (a + b) / 2;
    const k = stepping ? 1 : beat(f, 1.6 + (j / g) * 0.6, 3);
    const lit = j === litI && kL > 0.5;
    poly(c, p, [a, Y + 12, a + 4, Y + 19, mid - 6, Y + 19, mid, Y + 27, mid + 6, Y + 19, b - 4, Y + 19, b, Y + 12], lit ? 1 : 0.6, lit ? BLUE : SIL, k);
    label(c, p, font, gr.label, mid, Y + 41, alignAt(mid), lit ? SIL : LAB, k);
  }
}

// ---- map: where are places, and what moves between them? ----
// A schematic map, north up: dots and routes only, never coastlines. One
// light travels the routes in order.
function drawMap(c: SkCanvas, p: SkPaint, font: SkFont | null, s: MapScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  // With a region the real coastline is drawn and places sit at their true spots.
  const o = s.region ? OUTLINES[s.region] : undefined;
  const L = o ? o.x : 44;
  const R = o ? o.x + o.w : 256;
  const T = o ? o.y : 26;
  const B = o ? o.y + o.h : 146;
  const px = (i: number) => L + s.places[i].x * (R - L);
  const py = (i: number) => B - s.places[i].y * (B - T);
  const k0 = beat(f, 0, 3);
  if (o) {
    strokeLines(c, p, o.coast, 0.4 * k0, SIL, 1.1);
    if (s.borders) strokeLines(c, p, o.borders, 0.22 * k0, SIL, 0.8, [1.5, 3]);
  } else {
    stroke(p, SIL, 0.12 * k0);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(L - 26, T - 16, R - L + 52, B - T + 32), 14, 14), p);
    line(c, p, R + 14, T + 4, R + 14, T - 6, 0.5 * k0, SIL);
    label(c, p, font, "N", R + 14, T + 13, "center", LAB, k0);
  }
  const m = s.routes.length;
  // A route bows a little to the left of its direction of travel.
  const curve = (j: number, u: number) => {
    const a = s.routes[j].from;
    const b = s.routes[j].to;
    const ax = px(a);
    const ay = py(a);
    const bx = px(b);
    const by = py(b);
    const mx = (ax + bx) / 2 + (ay - by) * 0.18;
    const my = (ay + by) / 2 + (bx - ax) * 0.18;
    const v = 1 - u;
    return [v * v * ax + 2 * v * u * mx + u * u * bx, v * v * ay + 2 * v * u * my + u * u * by];
  };
  const lp = stepping ? f.v : beat(f, 2.4, 3);
  const seg = m ? Math.min(m - 1, Math.floor(lp * m)) : 0;
  const segU = m ? lp * m - seg : 0;
  for (let j = 0; j < m; j++) {
    const k = beat(f, 1.2 + (j / m) * 0.8, 3);
    const passed = j < seg || (j === seg && lp >= 0.999);
    const pts: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const q = curve(j, (i / 24) * k);
      pts.push(q[0], q[1]);
    }
    strokePts(c, p, pts, passed ? 0.75 : 0.35, SIL, W0, passed ? undefined : [3, 5]);
    if (j === seg && lp > 0.01 && lp < 0.999) {
      const tail: number[] = [];
      for (let i = 0; i <= 10; i++) {
        const q = curve(j, Math.max(0, segU - 0.3) + ((segU - Math.max(0, segU - 0.3)) * i) / 10);
        tail.push(q[0], q[1]);
      }
      strokePts(c, p, tail, 1, BLUE, W0 + 0.6);
      const q = curve(j, segU);
      dot(c, p, q[0], q[1], 2.6, 1, BLUE);
    }
    if (lp >= 0.999 && !f.still) {
      const q = curve(j, (f.t * 0.25 + j * 0.31) % 1);
      dot(c, p, q[0], q[1], 1.8, 0.5);
    }
  }
  const arrived = lp >= 0.999;
  for (let i = 0; i < s.places.length; i++) {
    const k = beat(f, 0.4 + (i / s.places.length) * 0.8, 3);
    const lit = i === s.lit && arrived;
    const pr = o ? 3.4 : 4.5;
    dot(c, p, px(i), py(i), pr, k, PANEL);
    if (lit) dot(c, p, px(i), py(i), pr + 0.3, 1, BLUE);
    else ring(c, p, px(i), py(i), pr, k);
    // The name goes on whichever side (right, left, above, below) crosses the
    // fewest routes and stays on the panel.
    const w = textW(font, s.places[i].label);
    const cx = [px(i) + 9, px(i) - 9, px(i), px(i)];
    const cy = [py(i), py(i), py(i) - 12, py(i) + 13];
    const L0 = [cx[0], cx[1] - w, cx[2] - w / 2, cx[3] - w / 2];
    let best = 0;
    let bestCost = 1e9;
    for (let o = 0; o < 4; o++) {
      let cost = o === 0 ? 0 : o === 1 ? 0.5 : 1;
      if (L0[o] < 4 || L0[o] + w > 296) cost += 50;
      for (let j = 0; j < m; j++) {
        for (let u = 0; u <= 12; u++) {
          const q = curve(j, u / 12);
          if (q[0] > L0[o] - 3 && q[0] < L0[o] + w + 3 && q[1] > cy[o] - 7 && q[1] < cy[o] + 7) cost += 3;
        }
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = o;
      }
    }
    const al = best === 0 ? "left" : best === 1 ? "right" : "center";
    if (o) knockLabel(c, p, font, fitText(font, s.places[i].label, 104), cx[best], cy[best], al, lit ? SIL : LAB, k);
    else fitLabel(c, p, font, s.places[i].label, cx[best], cy[best], al, lit ? SIL : LAB, k, 104);
  }
}

// ---- things: real objects, people and places, from the same marks ----
/** The soft light behind a lit thing. */
function thingHalo(c: SkCanvas, x: number, y: number, h: number, a: number) {
  "worklet";
  if (a <= 0.01) return;
  const hp = Skia.Paint();
  hp.setColor(Skia.Color(BLUE));
  hp.setAlphaf(clamp(a) * 0.16);
  hp.setMaskFilter(Skia.MaskFilter.MakeBlur(0, Math.min(12, 3 + h * 0.3), true));
  c.drawCircle(x, y, h * 0.85, hp);
}

/** Draws a list of marks centred on (x, y) at half-size h, built on mark by mark as k goes from 0 to 1. fx -1 mirrors them; ref is the size the fine-detail test goes by. */
function drawMarks(c: SkCanvas, p: SkPaint, marks: ThingMark[], x: number, y: number, h: number, al: number, colour: string, k: number, w: number, fx: number, ref: number) {
  "worklet";
  if (k <= 0) return;
  const n = marks.length;
  let hide = false;
  for (let i = 0; i < n; i++) {
    const m = marks[i];
    const u = clamp(k * n - i);
    if (u <= 0) break;
    const code = m[0] as string;
    const v = m as number[];
    // "f": the marks that follow are fine detail (a face), left out when the thing is drawn smaller than v[1].
    if (code === "f") {
      hide = ref < v[1];
      continue;
    }
    if (hide) continue;
    if (code === "l") {
      line(c, p, x + fx * v[1] * h, y + v[2] * h, x + fx * v[3] * h, y + v[4] * h, al, colour, u, undefined, w);
    } else if (code === "c" || code === "a") {
      let a0 = code === "c" ? -Math.PI / 2 : (v[4] * Math.PI) / 180;
      let a1 = code === "c" ? a0 + TAU : (v[5] * Math.PI) / 180;
      if (fx < 0 && code === "a") {
        a0 = Math.PI - a0;
        a1 = Math.PI - a1;
      }
      if (code === "c" && u >= 1) {
        stroke(p, colour, al, w);
        c.drawCircle(x + fx * v[1] * h, y + v[2] * h, v[3] * h, p);
      } else strokePts(c, p, arcPts(x + fx * v[1] * h, y + v[2] * h, v[3] * h, a0, a0 + (a1 - a0) * u, Math.max(6, Math.round(Math.abs(a1 - a0) * 6))), al, colour, w);
    } else if (code === "d") {
      fill(p, colour, al * u);
      c.drawCircle(x + fx * v[1] * h, y + v[2] * h, Math.max(0.8, v[3] * h), p);
    } else if (code === "b") {
      stroke(p, colour, al * u, w);
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(fx < 0 ? x - (v[1] + v[3]) * h : x + v[1] * h, y + v[2] * h, v[3] * h, v[4] * h), v[5] * h, v[5] * h), p);
    } else {
      // p open path, z closed path, q dashed path (the hidden part of something).
      const pts = (v.length - 1) / 2;
      const upto = u * (code === "z" ? pts : pts - 1);
      const path = Skia.PathBuilder.Make();
      path.moveTo(wx(p, x + fx * v[1] * h, y + v[2] * h), wy(p, x + fx * v[1] * h, y + v[2] * h));
      for (let j = 1; j <= Math.ceil(upto) && j <= pts; j++) {
        const jj = j % pts;
        const px = x + fx * v[1 + jj * 2] * h;
        const py = y + v[2 + jj * 2] * h;
        if (j > upto) {
          const pj = j - 1;
          const qx = x + fx * v[1 + pj * 2] * h;
          const qy = y + v[2 + pj * 2] * h;
          const r = upto - pj;
          const ex = qx + (px - qx) * r;
          const ey = qy + (py - qy) * r;
          path.lineTo(wx(p, ex, ey), wy(p, ex, ey));
        } else path.lineTo(wx(p, px, py), wy(p, px, py));
      }
      stroke(p, colour, code === "q" ? al * 0.7 : al, w, code === "q" ? [3, 4] : undefined);
      c.drawPath(path.build(), p);
    }
  }
}

/**
 * Draws a thing centred on (x, y), half its size h, built on mark by mark as k
 * goes from 0 to 1. The name is a drawn thing, or one put together from the
 * kit (see kit.ts): a pose with a face, a hat and something in its hand, or a
 * building shell with a sign on it. fx -1 turns it to face the other way.
 */
export function drawThing(c: SkCanvas, p: SkPaint, name: string, x: number, y: number, h: number, a: number, lit: boolean, k = 1, w = W0, glow = true, fx = 1) {
  "worklet";
  if (!name || a <= 0.01 || k <= 0) return;
  const colour = lit ? BLUE : SIL;
  const al = lit ? a : a * 0.82;
  const marks = THINGS[name];
  if (marks) {
    if (lit && glow) thingHalo(c, x, y, h, a * clamp(k * 2 - 0.6));
    drawMarks(c, p, marks, x, y, h, al, colour, k, w, fx, h);
    return;
  }
  const q = name.split(":");
  if (q[0] === "person") {
    const pose = KIT_POSES[q[1] || "stand"];
    if (!pose) return;
    if (lit && glow) thingHalo(c, x, y, h, a * clamp(k * 2 - 0.6));
    const hx = x + fx * pose.head[0] * h;
    const hy = y + pose.head[1] * h;
    drawMarks(c, p, pose.m, x, y, h, al, colour, clamp(k * 1.5), w, fx, h);
    // The face: left out on tiny people, as on the drawn ones.
    const face = KIT_FACES[q[2] || pose.mood] || KIT_FACES.happy;
    if (h >= 9) drawMarks(c, p, face, hx + fx * pose.look * 0.07 * h, hy, h, al, colour, clamp(k * 3 - 1.3), w, fx, h);
    const hat = q[3] ? KIT_HATS[q[3]] : undefined;
    if (hat) drawMarks(c, p, hat, hx, hy, h, al, colour, clamp(k * 3 - 1.6), w, fx, h);
    const held = q[4] ? THINGS[q[4]] : undefined;
    if (held) drawMarks(c, p, held, x + fx * (pose.hand[0] + 0.1) * h, y + (pose.hand[1] - 0.2) * h, h * 0.3, al, colour, clamp(k * 3 - 1.9), w, 1, h * 0.3);
    return;
  }
  if (q[0] === "place") {
    const shell = KIT_SHELLS[q[1]];
    if (!shell) return;
    if (lit && glow) thingHalo(c, x, y, h, a * clamp(k * 2 - 0.6));
    drawMarks(c, p, shell.m, x, y, h, al, colour, clamp(k * 1.5), w, fx, h);
    const badge = q[2] ? THINGS[q[2]] : undefined;
    if (badge) drawMarks(c, p, badge, x + fx * shell.sign[0] * h, y + shell.sign[1] * h, h * shell.sign[2], al, colour, clamp(k * 3 - 1.6), w, 1, h * shell.sign[2]);
  }
}

// ---- movement: one figure changing pose, marker gestures, and things kept from the picture before ----

/** The figure part way between two poses. Head, body, arms, legs and feet move; anything else a pose has (a chair, a prop) is left to fade. */
function tweenPose(a: ThingMark[], b: ThingMark[], u: number) {
  "worklet";
  const out: ThingMark[] = [];
  const n = Math.min(a.length, b.length, 8);
  for (let i = 0; i < n; i++) {
    const ma = a[i];
    const mb = b[i];
    if (ma[0] !== mb[0] || ma.length !== mb.length) break;
    const m: ThingMark = [ma[0]];
    for (let j = 1; j < ma.length; j++) m.push((ma[j] as number) + ((mb[j] as number) - (ma[j] as number)) * u);
    out.push(m);
  }
  return out;
}

/**
 * One thing turning into another, u from 0 to 1. Two built people are the same
 * figure, so the body moves from one pose to the other; the face changes half
 * way, and a hat or a held thing that differs fades. Anything else changes by
 * one drawing fading as the other arrives, in the same place.
 */
function drawThingTween(c: SkCanvas, p: SkPaint, from: string, to: string, u: number, x: number, y: number, h: number, a: number, lit: boolean, w = W0, glow = true, fx = 1, stride = 0) {
  "worklet";
  if ((u <= 0 || from === to) && !stride) {
    drawThing(c, p, u <= 0 ? from : to, x, y, h, a, lit, 1, w, glow, fx);
    return;
  }
  if (u >= 1) {
    drawThing(c, p, to, x, y, h, a, lit, 1, w, glow, fx);
    return;
  }
  const qa = from.split(":");
  const qb = to.split(":");
  const pa = qa[0] === "person" ? KIT_POSES[qa[1] || "stand"] : undefined;
  const pb = qb[0] === "person" ? KIT_POSES[qb[1] || "stand"] : undefined;
  if (!pa || !pb) {
    drawThing(c, p, from, x, y, h, a * (1 - u), false, 1, w, false, fx);
    drawThing(c, p, to, x, y, h, a * u, lit, 1, w, glow, fx);
    return;
  }
  const colour = lit ? BLUE : SIL;
  const al = lit ? a : a * 0.82;
  if (lit && glow) thingHalo(c, x, y, h, a);
  const mid = tweenPose(pa.m, pb.m, u);
  // Walking: the legs swing from the hip, one forward as the other goes back, and the feet go with them.
  if (stride && mid.length >= 6) {
    for (let i = 4; i < mid.length; i++) {
      const m = mid[i];
      const sw = (i % 2 === 0 ? 1 : -1) * stride * 0.17;
      if (i < 6) for (let j = 1; j < m.length; j += 2) m[j] = (m[j] as number) + sw * ((j - 1) / (m.length - 3));
      else for (let j = 1; j < m.length; j += 2) m[j] = (m[j] as number) + sw;
    }
  }
  drawMarks(c, p, mid, x, y, h, al, colour, 1, w, fx, h);
  const out = clamp(1 - u * 2.5);
  const inn = clamp(u * 2.5 - 1.5);
  if (pa.m.length > mid.length && out > 0) drawMarks(c, p, pa.m.slice(mid.length), x, y, h, al * out, colour, 1, w, fx, h);
  if (pb.m.length > mid.length && inn > 0) drawMarks(c, p, pb.m.slice(mid.length), x, y, h, al * inn, colour, 1, w, fx, h);
  const hx = x + fx * (pa.head[0] + (pb.head[0] - pa.head[0]) * u) * h;
  const hy = y + (pa.head[1] + (pb.head[1] - pa.head[1]) * u) * h;
  const look = pa.look + (pb.look - pa.look) * u;
  const face = (u < 0.5 ? KIT_FACES[qa[2] || pa.mood] : KIT_FACES[qb[2] || pb.mood]) || KIT_FACES.happy;
  if (h >= 9) drawMarks(c, p, face, hx + fx * look * 0.07 * h, hy, h, al, colour, 1, w, fx, h);
  const hatA = qa[3] ? KIT_HATS[qa[3]] : undefined;
  const hatB = qb[3] ? KIT_HATS[qb[3]] : undefined;
  if (hatA && qa[3] === qb[3]) drawMarks(c, p, hatA, hx, hy, h, al, colour, 1, w, fx, h);
  else {
    if (hatA) drawMarks(c, p, hatA, hx, hy, h, al * (1 - u), colour, 1, w, fx, h);
    if (hatB) drawMarks(c, p, hatB, hx, hy, h, al * u, colour, 1, w, fx, h);
  }
  const gx = x + fx * (pa.hand[0] + (pb.hand[0] - pa.hand[0]) * u + 0.1) * h;
  const gy = y + (pa.hand[1] + (pb.hand[1] - pa.hand[1]) * u - 0.2) * h;
  const heldA = qa[4] ? THINGS[qa[4]] : undefined;
  const heldB = qb[4] ? THINGS[qb[4]] : undefined;
  if (heldA && qa[4] === qb[4]) drawMarks(c, p, heldA, gx, gy, h * 0.3, al, colour, 1, w, 1, h * 0.3);
  else {
    if (heldA) drawMarks(c, p, heldA, gx, gy, h * 0.3, al * (1 - u), colour, 1, w, 1, h * 0.3);
    if (heldB) drawMarks(c, p, heldB, gx, gy, h * 0.3, al * u, colour, 1, w, 1, h * 0.3);
  }
}

/** A marker gesture over a thing, drawn stroke by stroke as k goes from 0 to 1: a cross through it, or a tick beside its head. */
function gesture(c: SkCanvas, p: SkPaint, kind: string | undefined, x: number, y: number, h: number, k: number, fx = 1) {
  "worklet";
  if (!kind || k <= 0) return;
  if (kind === "cross") {
    const r = h * 0.78;
    line(c, p, x - r, y - r, x + r, y + r, 0.95, SIL, clamp(k * 2));
    line(c, p, x + r, y - r, x - r, y + r, 0.95, SIL, clamp(k * 2 - 1));
  } else if (kind === "tick") {
    // A tick beside the top of the thing, on the side a person faces away from, so it never crosses a face or what they hold.
    const r = Math.max(6, h * 0.34);
    const tx = x - fx * (h * 0.78 + r * 0.6);
    const ty = y - h * 0.62;
    line(c, p, tx - r * 0.75, ty - r * 0.05, tx - r * 0.25, ty + r * 0.6, 0.95, SIL, clamp(k * 3));
    line(c, p, tx - r * 0.25, ty + r * 0.6, tx + r * 0.85, ty - r * 0.85, 0.95, SIL, clamp(k * 1.5 - 0.5));
  }
}

/** How far a thing kept from the last picture has travelled to its new place, 0 to 1. It waits a moment while the old picture clears. */
function carried(f: Frame) {
  "worklet";
  if (f.still || f.age === undefined) return 1;
  return ease2((f.age - 0.2) / 1.0);
}

/** Draws a thing that was in the last picture: it moves from where it stood to where it now belongs, changing pose on the way and turning if it must. */
function drawCarried(c: SkCanvas, p: SkPaint, cr: Carry, thing: string, u: number, x: number, y: number, h: number, a: number, lit: boolean, glow: boolean, fx: number) {
  "worklet";
  const dx = x - cr.x;
  const far = Math.abs(dx) > 12 && u < 1;
  // Going any distance, a person turns the way they are going, walks, and turns back at the end.
  const way = dx < 0 ? -1 : 1;
  let turn = cr.fx + (fx - cr.fx) * u;
  if (far && isPerson(thing)) turn = u < 0.15 ? cr.fx + (way - cr.fx) * (u / 0.15) : u > 0.85 ? way + (fx - way) * ((u - 0.85) / 0.15) : way;
  const steps = Math.max(2, Math.round(Math.abs(dx) / 20));
  const stride = far ? Math.sin(u * Math.PI * steps) * Math.min(1, 6 * u * (1 - u)) : 0;
  const bob = far ? -Math.abs(stride) * 0.03 * h : 0;
  drawThingTween(c, p, cr.thing, thing, u, cr.x + dx * u, cr.y + (y - cr.y) * u + bob, cr.h + (h - cr.h) * u, a, lit && u > 0.6, W0, glow, Math.abs(turn) < 0.2 ? (turn < 0 ? -0.2 : 0.2) : turn, stride);
}

// ---- units: how many out of 100 ----
// A ten by ten field of dots; the lit ones are counted in from the top left.
// They are lit as a group, so they carry no halo.
function drawUnits(c: SkCanvas, p: SkPaint, font: SkFont | null, s: UnitsScene, changes: Change[], f: Frame) {
  "worklet";
  const growing = hasKind(changes, "grow");
  const X0 = 30;
  const Y0 = 26;
  const P = 12.6;
  const shown = Math.round(s.lit * (growing ? f.v : beat(f, 2.4, 3)));
  for (let i = 0; i < 100; i++) {
    const r = Math.floor(i / 10);
    const col = i % 10;
    const a = beat(f, (r / 10) * 1.6, 3);
    const lit = i < shown;
    // Counted in little pictures (people, coins) when the lesson names one, as in Isotype.
    if (s.thing && hasThing(s.thing)) drawThing(c, p, s.thing, X0 + col * P, Y0 + r * P, 5, lit ? a : a * 0.5, lit, 1, 1.1, false);
    else dot(c, p, X0 + col * P, Y0 + r * P, lit ? 2.9 : 2.5, lit ? a : a * 0.45, lit ? BLUE : SIL);
  }
  const kLab = beat(f, 2, 3);
  // A second group among the rest, as rings: the ones who look like the lit ones but are not.
  const also = s.also && s.alsoLabel ? Math.min(s.also, 100 - s.lit) : 0;
  if (also > 0) {
    const kA = beat(f, 2.2, 3);
    for (let i = s.lit; i < s.lit + also; i++) ring(c, p, X0 + (i % 10) * P, Y0 + Math.floor(i / 10) * P, 4.4, kA * 0.9);
    label(c, p, font, `${shown} in 100`, 172, 46, "left", SIL, kLab);
    label(c, p, font, s.label, 172, 59, "left", LAB, kLab);
    label(c, p, font, `${also} in 100`, 172, 82, "left", SIL, kA * 0.85);
    label(c, p, font, s.alsoLabel ?? "", 172, 95, "left", LAB, kA);
    if (s.rest) {
      label(c, p, font, `${100 - shown - also} in 100`, 172, 118, "left", LAB, kLab);
      label(c, p, font, s.rest, 172, 131, "left", LAB, kLab * 0.8);
    }
    return;
  }
  label(c, p, font, `${shown} in 100`, 172, 64, "left", SIL, kLab);
  label(c, p, font, s.label, 172, 78, "left", LAB, kLab);
  if (s.rest) {
    label(c, p, font, `${100 - shown} in 100`, 172, 106, "left", LAB, kLab);
    label(c, p, font, s.rest, 172, 120, "left", LAB, kLab * 0.8);
  }
}

/** Where each spot sits on a thing, in its box from -1 to 1. */
const SPOT: Record<string, [number, number]> = {
  top: [0, -0.62], bottom: [0, 0.62], left: [-0.62, 0], right: [0.62, 0], centre: [0, 0],
  "top left": [-0.48, -0.48], "top right": [0.48, -0.48], "bottom left": [-0.48, 0.48], "bottom right": [0.48, 0.48],
};

/**
 * One thing drawn big, with its parts named: a labelled diagram. Each part gets
 * a dot where it sits and a thin leader out to its name at the side, names never
 * crossing. The light moves through the parts (or rests on the lit one).
 */
function drawParts(c: SkCanvas, p: SkPaint, font: SkFont | null, s: ThingsScene, parts: { label: string; at: string }[], stepping: boolean, f: Frame) {
  "worklet";
  const CX = 150;
  const CY = 86;
  const H = 50;
  const n = parts.length;
  const litI = stepping ? Math.min(n - 1, Math.floor(f.v * n)) : s.lit;
  const kL = stepping ? 1 : beat(f, 2.6, 3);
  const cr0 = f.carry ? f.carry[0] : null;
  if (cr0) drawCarried(c, p, cr0, s.items[0].thing, carried(f), CX, CY, H, 1, false, false, 1);
  else drawThing(c, p, s.items[0].thing, CX, CY, H, 1, false, beat(f, 0.2, 3));
  // Left or right by where the part is; middle ones go to the emptier side.
  const side: number[] = [];
  let nl = 0;
  let nr = 0;
  for (let i = 0; i < n; i++) {
    const sx = (SPOT[parts[i].at] ?? SPOT.centre)[0];
    const sd = sx < 0 ? -1 : sx > 0 ? 1 : nl <= nr ? -1 : 1;
    side.push(sd);
    if (sd < 0) nl++;
    else nr++;
  }
  // Names on each side keep the parts' top to bottom order, at least 22 apart.
  const ly: number[] = [];
  for (let i = 0; i < n; i++) ly.push(0);
  for (const sd of [-1, 1]) {
    const idx: number[] = [];
    for (let i = 0; i < n; i++) if (side[i] === sd) idx.push(i);
    idx.sort((a, b) => (SPOT[parts[a].at] ?? SPOT.centre)[1] - (SPOT[parts[b].at] ?? SPOT.centre)[1]);
    let last = -999;
    for (const i of idx) {
      const want = CY + (SPOT[parts[i].at] ?? SPOT.centre)[1] * H;
      ly[i] = Math.max(want, last + 26);
      last = ly[i];
    }
    // If the stack ran off the bottom, slide it all back up.
    const over = last - 160;
    if (over > 0) for (const i of idx) ly[i] -= over;
  }
  for (let i = 0; i < n; i++) {
    const sp = SPOT[parts[i].at] ?? SPOT.centre;
    const ax = CX + sp[0] * H;
    const ay = CY + sp[1] * H;
    const k = beat(f, 1 + (i / n) * 1.4, 3);
    const lit = i === litI && kL > 0.5;
    const ex = side[i] < 0 ? CX - H - 10 : CX + H + 10;
    // Leader: from the part, level with its name, out past the drawing.
    if (k > 0.01) strokePts(c, p, [ax, ay, ex, ly[i], ex + side[i] * 8, ly[i]], 0.35 * k, SIL, W0 * 0.8);
    dot(c, p, ax, ay, lit ? 3.2 : 2.2, k, lit ? BLUE : SIL);
    const room = side[i] < 0 ? ex - 11 - 4 : 300 - (ex + 11) - 4;
    const al = side[i] < 0 ? "right" : "left";
    const col = lit ? SIL : LAB;
    const txt = parts[i].label;
    const ws = txt.split(" ");
    if (textW(font, txt) <= room || ws.length < 2) fitLabel(c, p, font, txt, ex + side[i] * 11, ly[i] + 3, al, col, k, room);
    else {
      // Too long for one line: two lines, the break where they are most even.
      let best = 1;
      let bestW = 1e9;
      for (let j = 1; j < ws.length; j++) {
        const w = Math.max(textW(font, ws.slice(0, j).join(" ")), textW(font, ws.slice(j).join(" ")));
        if (w < bestW) { bestW = w; best = j; }
      }
      fitLabel(c, p, font, ws.slice(0, best).join(" "), ex + side[i] * 11, ly[i] - 2, al, col, k, room);
      fitLabel(c, p, font, ws.slice(best).join(" "), ex + side[i] * 11, ly[i] + 9, al, col, k, room);
    }
  }
  if (s.items[0].label) label(c, p, font, s.items[0].label, CX, 170, "center", LAB, beat(f, 0.6, 3));
}

/** Points round an ellipse, drawn on up to k of the way. */
function ellipsePts(cx: number, cy: number, rx: number, ry: number, k: number) {
  "worklet";
  const pts: number[] = [];
  const m = Math.max(2, Math.round(64 * k));
  for (let i = 0; i <= m; i++) {
    const a = -Math.PI / 2 + (TAU * k * i) / m;
    pts.push(cx + rx * Math.cos(a), cy + ry * Math.sin(a));
  }
  return pts;
}

// ---- things: what is it, who is involved, what does it look like? ----
// row: side by side (one alone is a big single picture). versus: two set
// against each other. chain: each becomes the next. orbit: one goes round
// another. scale: real relative sizes on one line.
function drawThings(c: SkCanvas, p: SkPaint, font: SkFont | null, s: ThingsScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.items.length;
  const litI = stepping ? Math.min(n - 1, Math.floor(f.v * n)) : s.lit;
  const kL = stepping ? 1 : beat(f, 2.6, 3);
  const isLit = (i: number) => i === litI && kL > 0.5;
  const kOf = (i: number) => beat(f, 0.2 + (i / Math.max(1, n)) * 1.8, 3);
  if (s.layout === "orbit") {
    const CX = 150;
    const CY = 80;
    const RX = 104;
    const RY = 46;
    // At rest the planet sits to the right of the sun, clear of every name.
    const tm = (f.still ? 0 : (hasKind(changes, "speed") ? f.T : f.t) * 0.45) + 0.5;
    strokePts(c, p, ellipsePts(CX, CY, RX, RY, beat(f, 0.8, 3)), 0.22, SIL, W0, [2, 5]);
    drawThing(c, p, s.items[0].thing, CX, CY, 25, 1, isLit(0), kOf(0));
    // The centre's name sits to its left, where the orbit never passes close.
    knockLabel(c, p, font, fitText(font, s.items[0].label, CX - 40), CX - 31, CY, "right", isLit(0) ? SIL : LAB, kOf(0));
    if (n > 1) {
      const k1 = kOf(1);
      const ex = CX + RX * Math.cos(tm);
      const ey = CY + RY * Math.sin(tm);
      if (n > 2) {
        const tm2 = tm * 3.2 - 2.4;
        strokePts(c, p, ellipsePts(ex, ey, 25, 25, beat(f, 1.6, 3)), 0.18, SIL, W0, [2, 4]);
        const mx = ex + 25 * Math.cos(tm2);
        const my = ey + 25 * Math.sin(tm2);
        drawThing(c, p, s.items[2].thing, mx, my, 6, 1, isLit(2), kOf(2), 1.3);
        // Its name sits on the far side from what it goes round, so it never covers it.
        label(c, p, font, fitText(font, s.items[2].label, 84), mx + Math.cos(tm2) * 14, my + Math.sin(tm2) * 12, Math.cos(tm2) > 0.3 ? "left" : Math.cos(tm2) < -0.3 ? "right" : "center", isLit(2) ? SIL : LAB, kOf(2));
      }
      drawThing(c, p, s.items[1].thing, ex, ey, 13, 1, isLit(1), k1);
      if (n > 2) {
        // With a moon, the planet's name rides on the side away from it, so the two never meet.
        // It sits just outside the moon's path, and never runs off the panel.
        const d = tm * 3.2 - 2.4 + Math.PI;
        const al = Math.cos(d) > 0.3 ? "left" : Math.cos(d) < -0.3 ? "right" : "center";
        const name1 = fitText(font, s.items[1].label, 96);
        const tw = font ? font.getTextWidth(name1) : 0;
        const lx0 = ex + Math.cos(d) * 31;
        const lx = al === "left" ? Math.min(lx0, 297 - tw) : al === "right" ? Math.max(lx0, 3 + tw) : Math.max(3 + tw / 2, Math.min(297 - tw / 2, lx0));
        label(c, p, font, name1, lx, clamp(ey + Math.sin(d) * 31, 8, 170), al, isLit(1) ? SIL : LAB, k1);
      } else label(c, p, font, s.items[1].label, ex, ey + 22, "center", isLit(1) ? SIL : LAB, k1);
    }
    return;
  }
  if (s.layout === "parts" && s.parts && s.parts.length >= 2) {
    drawParts(c, p, font, s, s.parts, stepping, f);
    return;
  }
  if (s.layout === "scale") {
    const BASE = 140;
    const maxH = 116;
    const big = s.items[n - 1].size;
    const hs: number[] = [];
    for (let i = 0; i < n; i++) hs.push(Math.max(3, (maxH * s.items[i].size) / big / 2));
    let total = 0;
    for (let i = 0; i < n; i++) total += 2 * Math.max(hs[i], 16);
    const gap = Math.min(30, (270 - total) / Math.max(1, n - 1));
    let xx = 150 - (total + gap * (n - 1)) / 2;
    line(c, p, 14, BASE, 286, BASE, 0.4, SIL, beat(f, 0, 3));
    let lastEnd = -999;
    for (let i = 0; i < n; i++) {
      const slot = 2 * Math.max(hs[i], 16);
      const cx = xx + slot / 2;
      const k = kOf(i);
      const tiny = hs[i] < 7;
      // Too small to draw at this scale: a dot where it stands, so the scale stays honest.
      if (tiny) dot(c, p, cx, BASE - 2.4, 2.4, k, isLit(i) ? BLUE : SIL);
      else {
        const cr = f.carry ? f.carry[i] : null;
        toneWash(c, cx, BASE - hs[i] * 1.05, hs[i] * 1.05, s.items[i].tone, k);
        if (cr) drawCarried(c, p, cr, s.items[i].thing, carried(f), cx, BASE - hs[i] * 1.05, hs[i], 1, isLit(i), !s.items[i].tone, 1);
        else drawThing(c, p, s.items[i].thing, cx, BASE - hs[i] * 1.05, hs[i], 1, isLit(i), k, W0, !s.items[i].tone);
      }
      const name = fitText(font, s.items[i].label, 100);
      const lw = textW(font, name);
      const al = alignAt(cx);
      const left = Math.max(4, Math.min(al === "left" ? cx : al === "right" ? cx - lw : cx - lw / 2, VIEW_W - 4 - lw));
      const low = left < lastEnd + 6;
      if (low) line(c, p, cx, BASE + 4, cx, BASE + 18, 0.3 * k, SIL);
      label(c, p, font, name, cx, BASE + (low ? 25 : 12), al, isLit(i) ? SIL : LAB, k);
      if (!low) lastEnd = left + lw;
      xx += slot + gap;
    }
    return;
  }
  const pitch = Math.min(120, 260 / n);
  const H = n === 1 ? 52 : s.layout === "versus" ? 36 : s.layout === "chain" ? Math.min(28, pitch / 2 - 18) : Math.min(32, pitch / 2 - 10);
  const Y = n === 1 ? 78 : 76;
  const sp = thingsSpots(s);
  const xs: number[] = [];
  for (let i = 0; i < n; i++) xs.push(sp[i * 4]);
  if (s.layout === "versus") line(c, p, 150, 30, 150, 140, 0.3, SIL, beat(f, 1, 3), [3, 6]);
  const kM = beat(f, 3, 3);
  const uC = carried(f);
  for (let i = 0; i < n; i++) {
    const k = kOf(i);
    const cr = f.carry ? f.carry[i] : null;
    // Crossed out: the thing steps back as the cross lands.
    const dim = s.items[i].mark === "cross" ? 1 - 0.45 * kM : 1;
    // A washed thing keeps its blue lines when lit, but the wash stands in for the halo.
    toneWash(c, xs[i], Y, H * 1.05, s.items[i].tone, k);
    // Kept from the last picture: it moves here; it is not drawn again.
    if (cr) drawCarried(c, p, cr, s.items[i].thing, uC, xs[i], Y, H, dim, isLit(i), !s.items[i].tone, 1);
    else drawThing(c, p, s.items[i].thing, xs[i], Y, H, dim, isLit(i), k, W0, !s.items[i].tone);
    gesture(c, p, s.items[i].mark, xs[i], Y, H, kM);
    label2(c, p, font, s.items[i].label, xs[i], Y + H + 18, n === 1 ? "center" : alignAt(xs[i]), isLit(i) ? SIL : LAB, k, n === 1 ? 260 : s.layout === "versus" ? 124 : pitch - 8);
    if (s.layout === "chain" && i < n - 1) {
      const x1 = xs[i] + H + 8;
      const x2 = xs[i + 1] - H - 8;
      const ka = beat(f, 0.2 + ((i + 0.6) / n) * 1.8, 3);
      if (x2 > x1 + 6) {
        arrow(c, p, x1, Y, x2, Y, 0.55, SIL, ka);
        if (i + 1 === litI && !stepping) pass(c, p, x1, Y, x2, Y, beat(f, 2.3, 3));
      }
    }
  }
}

// ==== v10: the fourteen devices that complete the language ====
// Each one answers a question nothing else in the kit answers, and is made
// only of the same marks: dots, rings, lines, links, soft boxes and labels.

/** A label that may take two lines: split at the word that balances them best, never mid-word. */

/** A dashed soft box: a place still to be filled, or a thing set against the rest. */
function dashBox(c: SkCanvas, p: SkPaint, x: number, y: number, w: number, h: number, a: number, r = 4) {
  "worklet";
  if (a <= 0.01 || w <= 0 || h <= 0) return;
  stroke(p, SIL, 0.5 * a, W0, [3, 5]);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r), p);
}

/** A sign between two terms, drawn from short lines. */
function sign(c: SkCanvas, p: SkPaint, kind: string, x: number, y: number, a: number) {
  "worklet";
  if (a <= 0.01) return;
  const al = 0.8 * a;
  if (kind === "plus") {
    line(c, p, x - 4, y, x + 4, y, al);
    line(c, p, x, y - 4, x, y + 4, al);
  } else if (kind === "minus") line(c, p, x - 4, y, x + 4, y, al);
  else if (kind === "times") {
    line(c, p, x - 3.4, y - 3.4, x + 3.4, y + 3.4, al);
    line(c, p, x + 3.4, y - 3.4, x - 3.4, y + 3.4, al);
  } else if (kind === "over") line(c, p, x - 3, y + 6, x + 3, y - 6, al);
  else if (kind === "equals") {
    line(c, p, x - 4.5, y - 2.6, x + 4.5, y - 2.6, al);
    line(c, p, x - 4.5, y + 2.6, x + 4.5, y + 2.6, al);
  } else if (kind === "both") {
    // Goes both ways: two half arrows, one each way.
    line(c, p, x - 7, y - 2.6, x + 7, y - 2.6, al);
    line(c, p, x + 7, y - 2.6, x + 3, y - 6, al);
    line(c, p, x + 7, y + 2.6, x - 7, y + 2.6, al);
    line(c, p, x - 7, y + 2.6, x - 3, y + 6, al);
  } else arrow(c, p, x - 7, y, x + 7, y, al);
}

// ---- spectra: where does it sit on several scales at once? ----
function drawSpectra(c: SkCanvas, p: SkPaint, font: SkFont | null, s: SpectraScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.rows.length;
  const X0 = 84;
  const X1 = 216;
  const pitch = Math.min(32, 104 / n);
  const y0 = 98 - (pitch * (n - 1)) / 2;
  fitLabel(c, p, font, s.item, 150, 22, "center", SIL, beat(f, 0.3, 3), 260);
  const litI = stepping ? Math.min(n - 1, Math.floor(f.v * n)) : s.lit;
  const kL = stepping ? 1 : beat(f, 2.7, 3);
  for (let i = 0; i < n; i++) {
    const row = s.rows[i];
    const y = y0 + i * pitch;
    const k = beat(f, 0.4 + (i / n) * 0.9, 3);
    const lit = i === litI && kL > 0.5;
    line(c, p, X0, y, X1, y, lit ? 0.6 : 0.34, SIL, k);
    line(c, p, X0, y - 4, X0, y + 4, 0.34 * k);
    line(c, p, X1, y - 4, X1, y + 4, 0.34 * k);
    fitLabel(c, p, font, row.left, X0 - 9, y, "right", lit ? SIL : LAB, k, X0 - 16);
    fitLabel(c, p, font, row.right, X1 + 9, y, "left", lit ? SIL : LAB, k, 300 - X1 - 16);
    const u = beat(f, 1.5 + (i / n) * 0.7, 3);
    const x = X0 + (X1 - X0) * (0.5 + (row.at - 0.5) * u);
    if (lit) dot(c, p, x, y, 5, k, BLUE);
    else dot(c, p, x, y, 3.4, k * 0.9);
  }
}

// ---- pattern: what comes next? ----
// A run of terms with one gap. The gap waits as a dashed box, then its answer lands, lit.
function drawPattern(c: SkCanvas, p: SkPaint, font: SkFont | null, s: PatternScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.items.length;
  const gapW = 8;
  const bw = Math.min(40, (268 - (n - 1) * gapW) / n);
  const total = n * bw + (n - 1) * gapW;
  const x0 = 150 - total / 2;
  const Y = 66;
  const H = 30;
  const kR = stepping ? clamp(f.v * 1.6 - 0.3) : beat(f, 2.7, 3);
  const shown = kR > 0.5;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (bw + gapW);
    const k = beat(f, 0.3 + (i / n) * 1.2, 3);
    // The hop from one term to the next: the rule being applied.
    if (i < n - 1) strokePts(c, p, arcPts(x + bw + gapW / 2, Y - 3, (bw + gapW) / 2 - 3, Math.PI * 1.12, Math.PI * 1.88, 10), 0.28 * k);
    if (i === s.gap) {
      if (shown) {
        box(c, p, x, Y, bw, H, 1, true, 7);
        fitLabel(c, p, font, s.answer, x + bw / 2, Y + H / 2, "center", SIL, 1, bw - 6);
      } else {
        dashBox(c, p, x, Y, bw, H, k, 7);
        label(c, p, font, "?", x + bw / 2, Y + H / 2, "center", LAB, k);
      }
    } else {
      box(c, p, x, Y, bw, H, k, false, 7);
      fitLabel(c, p, font, s.items[i], x + bw / 2, Y + H / 2, "center", SIL, k * 0.9, bw - 6);
    }
  }
  label(c, p, font, s.rule, 150, Y + H + 24, "center", shown ? SIL : LAB, beat(f, 1.8, 3));
}

// ---- machine: what goes in, what is done to it, what comes out? ----
function drawMachine(c: SkCanvas, p: SkPaint, font: SkFont | null, s: MachineScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const ni = s.inputs.length;
  const no = s.outputs.length;
  const BX = 114;
  const BW = 72;
  const BY = 58;
  const BH = 60;
  const CY = BY + BH / 2;
  box(c, p, BX, BY, BW, BH, beat(f, 0, 3), false, 12);
  label2(c, p, font, s.name, 150, CY, "center", SIL, beat(f, 0.4, 3), BW - 10);
  const litO = stepping ? Math.min(no - 1, Math.floor(f.v * no)) : s.lit;
  const prog = stepping ? clamp((f.v * no - litO) * 1.5) : beat(f, 2.7, 3);
  for (let i = 0; i < ni; i++) {
    const y = CY + (i - (ni - 1) / 2) * 32;
    const by = CY + (i - (ni - 1) / 2) * 14;
    const k = beat(f, 0.8 + (i / ni) * 0.6, 3);
    fitLabel(c, p, font, s.inputs[i], 82, y, "right", LAB, k, 76);
    arrow(c, p, 88, y, BX - 5, by, 0.55 * k, SIL, k);
  }
  for (let j = 0; j < no; j++) {
    const y = CY + (j - (no - 1) / 2) * 32;
    const by = CY + (j - (no - 1) / 2) * 14;
    const k = beat(f, 1.5 + (j / no) * 0.6, 3);
    const lit = j === litO;
    const done = lit && prog >= 0.999;
    arrow(c, p, BX + BW + 5, by, 212, y, 0.55 * k, SIL, k);
    if (lit) pass(c, p, BX + BW + 5, by, 212, y, prog);
    if (done) dot(c, p, 212, y, 4.2, 1, BLUE);
    fitLabel(c, p, font, s.outputs[j], 220, y, "left", done ? SIL : LAB, k, 74);
  }
}

// ---- case: what supports the claim, and what stands against it? ----
// The claim sits on top. Reasons hold it up from below. One objection stands
// to the side on a dashed line: set apart by position, never by colour.
function drawCase(c: SkCanvas, p: SkPaint, font: SkFont | null, s: CaseScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const nr = s.reasons.length;
  const hasObj = s.objection.length > 0;
  const cols = nr + (hasObj ? 1 : 0);
  const cw = Math.min(210, Math.max(90, textW(font, s.claim) + 26));
  const CY = 16;
  const CH = 30;
  box(c, p, 150 - cw / 2, CY, cw, CH, beat(f, 0, 3), false, 8);
  label2(c, p, font, s.claim, 150, CY + CH / 2, "center", SIL, beat(f, 0.3, 3), cw - 12);
  const gapW = 10;
  const bw = Math.min(98, (276 - (cols - 1) * gapW) / cols);
  const total = cols * bw + (cols - 1) * gapW;
  const x0 = 150 - total / 2;
  const RY = 102;
  const RH = 32;
  const litI = stepping ? Math.min(cols - 1, Math.floor(f.v * cols)) : s.lit < 0 ? cols - 1 : s.lit;
  const prog = stepping ? clamp((f.v * cols - litI) * 1.5) : beat(f, 2.7, 3);
  for (let i = 0; i < cols; i++) {
    const isObj = hasObj && i === cols - 1;
    const x = x0 + i * (bw + gapW);
    const cx = x + bw / 2;
    const k = beat(f, 0.9 + (i / cols) * 0.9, 3);
    const lit = i === litI && prog > 0.02;
    const tx = 150 + (cx - 150) * 0.32;
    const ty = CY + CH + 4;
    if (isObj) {
      line(c, p, cx, RY - 4, tx, ty, 0.45 * k, SIL, k, [3, 5]);
      // A small cross on the line: this one pushes against the claim.
      const mx = (cx + tx) / 2;
      const my = (RY - 4 + ty) / 2;
      line(c, p, mx - 3.5, my - 3.5, mx + 3.5, my + 3.5, 0.8 * k, lit ? BLUE : SIL);
      line(c, p, mx + 3.5, my - 3.5, mx - 3.5, my + 3.5, 0.8 * k, lit ? BLUE : SIL);
      if (lit) box(c, p, x, RY, bw, RH, 1, true, 8);
      else dashBox(c, p, x, RY, bw, RH, k, 8);
      label(c, p, font, "But", cx, RY + RH + 12, "center", LAB, k * 0.8);
    } else {
      arrow(c, p, cx, RY - 4, tx, ty, 0.5 * k, SIL, k);
      if (lit) pass(c, p, cx, RY - 4, tx, ty, prog);
      box(c, p, x, RY, bw, RH, k, lit, 8);
    }
    label2(c, p, font, isObj ? s.objection : s.reasons[i], cx, RY + RH / 2, "center", lit ? SIL : LAB, k, bw - 10);
  }
}

// ---- forces: what pushes and pulls, and what do they add up to? ----
// Arrows from one object, each as long as its force. The lit arrow is what
// they add up to; when they cancel, the object itself is lit.
function drawForces(c: SkCanvas, p: SkPaint, font: SkFont | null, s: ForcesScene, changes: Change[], f: Frame) {
  "worklet";
  const growing = hasKind(changes, "grow");
  const n = s.forces.length;
  const cx = 150;
  const cy = 84;
  const U = 10;
  let nx = 0;
  let ny = 0;
  const used = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const fo = s.forces[i];
    const d = fo.dir === "up" ? 0 : fo.dir === "down" ? 1 : fo.dir === "left" ? 2 : 3;
    const dx = d === 2 ? -1 : d === 3 ? 1 : 0;
    const dy = d === 0 ? -1 : d === 1 ? 1 : 0;
    const size = growing && i === n - 1 ? fo.size * f.v : fo.size;
    nx += dx * size;
    ny += dy * size;
    // A second force the same way sits beside the first.
    const off = used[d] * 9;
    used[d] += 1;
    const ox = dy !== 0 ? off : 0;
    const oy = dx !== 0 ? off : 0;
    const k = beat(f, 0.8 + (i / n) * 0.9, 3);
    const len = size * U;
    const x1 = cx + dx * 9 + ox;
    const y1 = cy + dy * 9 + oy;
    const x2 = cx + dx * (9 + len) + ox;
    const y2 = cy + dy * (9 + len) + oy;
    if (len > 3) arrow(c, p, x1, y1, x2, y2, 0.85 * k, SIL, k);
    if (dx !== 0) label(c, p, font, fo.label, x2 + dx * 6, y2 - 9, dx < 0 ? "right" : "left", LAB, k);
    else label(c, p, font, fo.label, x2 + 7, y2 + dy * 2, "left", LAB, k);
  }
  const kN = growing ? 1 : beat(f, 2.7, 3);
  const mag = Math.sqrt(nx * nx + ny * ny);
  const balanced = mag < 0.3;
  if (balanced) {
    dot(c, p, cx, cy, kN > 0.5 ? 6 : 5, beat(f, 0.2, 3), kN > 0.5 ? BLUE : SIL);
    label(c, p, font, s.result, cx + 13, cy + 15, "left", SIL, kN);
  } else {
    dot(c, p, cx, cy, 5, beat(f, 0.2, 3));
    // What they add up to, drawn just beside the forces it comes from.
    const ux = nx / mag;
    const uy = ny / mag;
    const px = -uy * 11;
    const py = ux * 11;
    const sx = cx + px + ux * 9;
    const sy = cy + py + uy * 9;
    const ex = sx + ux * mag * U;
    const ey = sy + uy * mag * U;
    arrow(c, p, sx, sy, ex, ey, kN > 0.01 ? 1 : 0, BLUE, kN);
    // Its name carries on from the arrow's tip, clear of the other arrows.
    if (Math.abs(ux) >= Math.abs(uy)) label(c, p, font, s.result, ex + (ux < 0 ? -7 : 7), ey, ux < 0 ? "right" : "left", SIL, clamp(kN * 2 - 1));
    else label(c, p, font, s.result, ex, ey + (uy < 0 ? -9 : 10), "center", SIL, clamp(kN * 2 - 1));
  }
  label(c, p, font, s.object, cx - 12, cy + 15, "right", LAB, beat(f, 0.5, 3));
}

// ---- equation: what combines into what? ----
function drawEquation(c: SkCanvas, p: SkPaint, font: SkFont | null, s: EquationScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.terms.length;
  const SG = 22;
  const ws: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.min(84, Math.max(36, textW(font, s.terms[i].label) + 18, textW(font, s.terms[i].note) + 4));
    ws.push(w);
    sum += w;
  }
  const room = 280 - (n - 1) * SG;
  const sc = sum > room ? room / sum : 1;
  const total = sum * sc + (n - 1) * SG;
  let x = 150 - total / 2;
  const Y = 62;
  const H = 32;
  const litI = stepping ? Math.min(n - 1, Math.floor(f.v * n)) : s.lit;
  const kL = stepping ? 1 : beat(f, 2.7, 3);
  for (let i = 0; i < n; i++) {
    const w = ws[i] * sc;
    const k = beat(f, 0.3 + (i / n) * 1.5, 3);
    const lit = i === litI && kL > 0.5;
    box(c, p, x, Y, w, H, k, lit, 8);
    fitLabel(c, p, font, s.terms[i].label, x + w / 2, Y + H / 2, "center", SIL, k * (lit ? 1 : 0.9), w - 8);
    fitLabel(c, p, font, s.terms[i].note, x + w / 2, Y + H + 14, "center", lit ? SIL : LAB, k, w + SG - 6);
    if (i < n - 1) sign(c, p, s.signs[i], x + w + SG / 2, Y + H / 2, beat(f, 0.6 + (i / n) * 1.5, 3));
    x += w + SG;
  }
}

// ---- bridge: what maps to what? ----
// Two sets and the links between them. A light travels the lit link.
function drawBridge(c: SkCanvas, p: SkPaint, font: SkFont | null, s: BridgeScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const nl = s.left.length;
  const nr = s.right.length;
  const m = s.maps.length;
  const LX = 108;
  const RX = 192;
  const CY = 96;
  const pitch = Math.min(30, 100 / Math.max(1, Math.max(nl, nr) - 1));
  const yl = (i: number) => CY + (i - (nl - 1) / 2) * pitch;
  const yr = (i: number) => CY + (i - (nr - 1) / 2) * pitch;
  fitLabel(c, p, font, s.leftTitle, LX, 22, "right", LAB, beat(f, 0.3, 3) * 0.85, LX - 8);
  fitLabel(c, p, font, s.rightTitle, RX, 22, "left", LAB, beat(f, 0.3, 3) * 0.85, VIEW_W - RX - 8);
  const litI = stepping ? Math.min(m - 1, Math.floor(f.v * m)) : s.lit;
  const prog = stepping ? clamp((f.v * m - litI) * 1.5) : beat(f, 2.7, 3);
  const lm = s.maps[litI];
  for (let j = 0; j < m; j++) {
    const mp = s.maps[j];
    const k = beat(f, 1.4 + (j / m) * 0.8, 3);
    line(c, p, LX + 7, yl(mp.from), RX - 7, yr(mp.to), j === litI ? 0.6 : 0.28, SIL, k);
    if (j === litI) pass(c, p, LX + 7, yl(mp.from), RX - 7, yr(mp.to), prog);
  }
  for (let i = 0; i < nl; i++) {
    const k = beat(f, 0.5 + (i / nl) * 0.7, 3);
    const lit = i === lm.from && prog > 0.01;
    dot(c, p, LX, yl(i), lit ? 4.2 : 3, k, lit ? BLUE : SIL);
    fitLabel(c, p, font, s.left[i], LX - 11, yl(i), "right", lit ? SIL : LAB, k, LX - 18);
  }
  for (let i = 0; i < nr; i++) {
    const k = beat(f, 0.8 + (i / nr) * 0.7, 3);
    const lit = i === lm.to && prog >= 0.999;
    dot(c, p, RX, yr(i), lit ? 4.2 : 3, k, lit ? BLUE : SIL);
    fitLabel(c, p, font, s.right[i], RX + 11, yr(i), "left", lit ? SIL : LAB, k, 300 - RX - 18);
  }
}

// ---- spread: how are the values spread? ----
// Dots piled into the shape of the data, one dot for one case.
const SPREAD: Record<string, number[]> = {
  normal: [1, 1, 2, 3, 5, 7, 8, 9, 8, 7, 5, 3, 2, 1, 1],
  skew_right: [2, 5, 8, 9, 8, 6, 5, 4, 3, 2, 2, 1, 1, 1, 0],
  skew_left: [0, 1, 1, 1, 2, 2, 3, 4, 5, 6, 8, 9, 8, 5, 2],
  uniform: [5, 5, 6, 5, 5, 6, 5, 5, 6, 5, 5, 5, 6, 5, 5],
  bimodal: [1, 2, 4, 7, 8, 6, 3, 2, 3, 6, 8, 7, 4, 2, 1],
};

function drawSpread(c: SkCanvas, p: SkPaint, font: SkFont | null, s: SpreadScene, changes: Change[], f: Frame) {
  "worklet";
  const growing = hasKind(changes, "grow");
  const cols = SPREAD[s.shape] ?? SPREAD.normal;
  const X0 = 52;
  const PX = 14;
  const FLOOR = 138;
  const PY = 9.4;
  const R = 2.7;
  line(c, p, 36, FLOOR, 264, FLOOR, 0.32, SIL, beat(f, 0, 3));
  label(c, p, font, s.x, 150, FLOOR + 16, "center", LAB, beat(f, 0.3, 3));
  let count = 0;
  let wsum = 0;
  for (let j = 0; j < cols.length; j++) {
    count += cols[j];
    wsum += cols[j] * j;
  }
  const mean = wsum / count;
  let vsum = 0;
  for (let j = 0; j < cols.length; j++) vsum += cols[j] * (j - mean) * (j - mean);
  const sd = Math.sqrt(vsum / count);
  const kL = beat(f, 2.7, 3);
  const on = kL > 0.5;
  const tailL = s.lit === "left_tail";
  const tailR = s.lit === "right_tail";
  let tipX = 0;
  let tipY = FLOOR;
  let tipN = 0;
  let seen = 0;
  for (let j = 0; j < cols.length; j++) {
    const inTail = (tailL && j <= 2) || (tailR && j >= cols.length - 3);
    for (let i = 0; i < cols[j]; i++) {
      const order = rnd(j * 17 + i * 3 + 1);
      seen++;
      // The sample grows with the slider, in no order, so the shape appears out of scatter.
      let a = growing ? clamp(f.v * count * 1.05 - order * count) : beat(f, 0.5 + order * 1.6, 3);
      const x = X0 + j * PX;
      const y = FLOOR - 6 - i * PY;
      // Each dot drops into place.
      const yy = growing || f.still ? y : y - (1 - a) * 14;
      if (inTail) {
        tipX += x;
        tipN += 1;
        if (y < tipY) tipY = y;
      }
      dot(c, p, x, yy, inTail && on ? R + 0.2 : R, inTail && on ? a : a * 0.7, inTail && on ? BLUE : SIL);
    }
  }
  const mx = X0 + mean * PX;
  if (s.lit === "middle") {
    line(c, p, mx, FLOOR, mx, 38, 1, BLUE, kL, undefined, W0 + 0.4);
    label(c, p, font, s.label, mx, 27, alignAt(mx), SIL, clamp(kL * 2 - 1));
  } else if (s.lit === "width") {
    const a = mx - sd * PX;
    const b = mx + sd * PX;
    line(c, p, mx, 44, a, 44, 1, BLUE, kL, undefined, W0 + 0.4);
    line(c, p, mx, 44, b, 44, 1, BLUE, kL, undefined, W0 + 0.4);
    if (on) {
      line(c, p, a, 40, a, 48, 1, BLUE);
      line(c, p, b, 40, b, 48, 1, BLUE);
    }
    label(c, p, font, s.label, mx, 30, "center", SIL, clamp(kL * 2 - 1));
  } else if (s.lit === "outlier") {
    const ox = s.shape === "skew_left" ? 30 : 270;
    dot(c, p, ox, FLOOR - 6, on ? 5 : R, beat(f, 2.2, 3), on ? BLUE : SIL);
    label(c, p, font, s.label, ox, FLOOR - 22, ox < 150 ? "left" : "right", SIL, clamp(kL * 2 - 1));
  } else if (tipN > 0) {
    const tx = tipX / tipN;
    // The name sits in the clear above the pile, with a thin leader down to the tail.
    label(c, p, font, s.label, tailL ? 30 : 270, 28, tailL ? "left" : "right", SIL, clamp(kL * 2 - 1));
    line(c, p, tx, 37, tx, tipY - 8, 0.4 * clamp(kL * 2 - 1));
  }
}

// ---- scatter: do two things go together? ----
// A cloud of points. The trend is traced through it as one lit line, or one
// point that does not fit is lit instead.
function drawScatter(c: SkCanvas, p: SkPaint, font: SkFont | null, s: ScatterScene, changes: Change[], f: Frame) {
  "worklet";
  const growing = hasKind(changes, "grow");
  const L = 44;
  const R = 268;
  const T = 22;
  const B = 140;
  const X = (x: number) => L + x * (R - L);
  const Y = (y: number) => B - y * (B - T);
  axes(c, p, font, f, L, T, R, B, s.x, s.y);
  const amp = s.trend === "none" ? 0.8 : s.strength === "strong" ? 0.17 : 0.5;
  const base = (x: number) => (s.trend === "up" ? 0.14 + 0.72 * x : s.trend === "down" ? 0.86 - 0.72 * x : 0.5);
  const N = 22;
  for (let i = 0; i < N; i++) {
    const x = 0.06 + 0.88 * rnd(i * 3 + 1);
    const y = clamp(base(x) + (rnd(i * 7 + 5) - 0.5) * amp, 0.05, 0.95);
    const a = growing ? clamp(f.v * N * 1.05 - i) : beat(f, 0.8 + (i / N) * 1.4, 4);
    dot(c, p, X(x), Y(y), 2.7, a * 0.75);
  }
  const kL = growing ? 1 : beat(f, 3.6, 4);
  const y0 = base(0.04);
  const y1 = base(0.96);
  const outlier = s.lit === "outlier";
  if (outlier) {
    line(c, p, X(0.04), Y(y0), X(0.96), Y(y1), 0.5, SIL, beat(f, 2.6, 4));
    const ox = 0.8;
    const oy = s.trend === "up" ? 0.16 : 0.88;
    dot(c, p, X(ox), Y(oy), kL > 0.5 ? 5 : 2.7, beat(f, 2.4, 4), kL > 0.5 ? BLUE : SIL);
    label(c, p, font, s.label, X(ox) - 9, Y(oy), "right", SIL, clamp(kL * 2 - 1));
  } else {
    // Trace: the line is drawn through the cloud, with a light at its pen tip.
    const dash = s.trend === "none" ? [4, 5] : undefined;
    line(c, p, X(0.04), Y(y0), X(0.96), Y(y1), 1, BLUE, kL, dash, W0 + 0.4);
    if (kL > 0.02 && kL < 0.98) dot(c, p, X(0.04 + 0.92 * kL), Y(y0 + (y1 - y0) * kL), 2.6, 1, BLUE);
    const up = s.trend === "up";
    label(c, p, font, s.label, X(0.96), up ? Y(y1) - 11 : Y(y1) + (s.trend === "down" ? -12 : -11), "right", SIL, clamp(kL * 2 - 1));
  }
}

// ---- matrix: what happens for every combination? ----
function drawMatrix(c: SkCanvas, p: SkPaint, font: SkFont | null, s: MatrixScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const nr = s.rows.length;
  const nc = s.cols.length;
  const L = 100;
  const R = 282;
  const T = 48;
  const B = 150;
  const cw = (R - L) / nc;
  const rh = (B - T) / nr;
  const k0 = beat(f, 0, 3);
  for (let i = 0; i <= nr; i++) line(c, p, L, T + i * rh, R, T + i * rh, i === 0 || i === nr ? 0.34 : 0.22, SIL, k0);
  for (let j = 0; j <= nc; j++) line(c, p, L + j * cw, T, L + j * cw, B, j === 0 || j === nc ? 0.34 : 0.22, SIL, k0);
  label(c, p, font, s.colTitle, (L + R) / 2, 14, "center", LAB, beat(f, 0.4, 3) * 0.8);
  if (font && s.rowTitle) {
    c.save();
    c.translate(16, (T + B) / 2);
    c.rotate(-90, 0, 0);
    rawLabel(c, p, font, s.rowTitle, 0, 0, "center", LAB, beat(f, 0.4, 3) * 0.8);
    c.restore();
  }
  const cells = nr * nc;
  const stepI = Math.min(cells - 1, Math.floor(f.v * cells));
  const lr = stepping ? Math.floor(stepI / nc) : s.litRow;
  const lc = stepping ? stepI % nc : s.litCol;
  const kL = stepping ? 1 : beat(f, 2.7, 3);
  for (let j = 0; j < nc; j++) fitLabel(c, p, font, s.cols[j], L + j * cw + cw / 2, T - 12, "center", j === lc && kL > 0.5 ? SIL : LAB, beat(f, 0.6, 3), cw - 6);
  for (let i = 0; i < nr; i++) label2(c, p, font, s.rows[i], L - 8, T + i * rh + rh / 2, "right", i === lr && kL > 0.5 ? SIL : LAB, beat(f, 0.6, 3), L - 34);
  for (let i = 0; i < nr; i++)
    for (let j = 0; j < nc; j++) {
      const k = beat(f, 1.1 + ((i * nc + j) / cells) * 1.1, 3);
      const lit = i === lr && j === lc && kL > 0.5;
      if (lit) box(c, p, L + j * cw + 3, T + i * rh + 3, cw - 6, rh - 6, 1, true, 6);
      label2(c, p, font, s.cells[i * nc + j], L + j * cw + cw / 2, T + i * rh + rh / 2, "center", lit ? SIL : LAB, k, cw - 10);
    }
}

// ---- geometry: a plain shape with its parts named ----
function drawGeometry(c: SkCanvas, p: SkPaint, font: SkFont | null, s: GeometryScene, changes: Change[], f: Frame) {
  "worklet";
  const k0 = beat(f, 0.2, 3);
  const k1 = beat(f, 1.2, 3);
  const kL = beat(f, 2.7, 3);
  const on = kL > 0.5;
  const L = s.labels;
  const has3 = (i: number) => i < L.length && L[i].length > 0;
  const col = (i: number) => (on && s.lit === i ? BLUE : SIL);
  const al = (i: number) => (on && s.lit === i ? 1 : 0.8);
  const w = (i: number) => (on && s.lit === i ? W0 + 0.5 : W0);
  const tx = (i: number) => (on && s.lit === i ? SIL : LAB);
  if (s.shape === "right_triangle" || s.shape === "triangle") {
    const right = s.shape === "right_triangle";
    const ax = right ? 92 : 84;
    const ay = 134;
    const bx = right ? 214 : 216;
    const by = 134;
    const cx = right ? 214 : 132;
    const cy = 48;
    line(c, p, ax, ay, bx, by, al(0) * k0, col(0), k0, undefined, w(0));
    line(c, p, bx, by, cx, cy, al(right ? 1 : 2) * k0, col(right ? 1 : 2), k0, undefined, w(right ? 1 : 2));
    line(c, p, cx, cy, ax, ay, al(right ? 2 : 1) * k0, col(right ? 2 : 1), k0, undefined, w(right ? 2 : 1));
    if (right) strokePts(c, p, [bx - 10, by, bx - 10, by - 10, bx, by - 10], 0.5 * k1);
    if (has3(0)) label(c, p, font, L[0], (ax + bx) / 2, ay + 13, "center", tx(0), k1);
    if (right) {
      if (has3(1)) label(c, p, font, L[1], bx + 9, (by + cy) / 2, "left", tx(1), k1);
      if (has3(2)) label(c, p, font, L[2], (ax + cx) / 2 - 9, (ay + cy) / 2 - 6, "right", tx(2), k1);
      if (has3(3)) {
        const ang = Math.atan2(ay - cy, cx - ax);
        strokePts(c, p, arcPts(ax, ay, 24, -ang, 0, 10), al(3) * k1, col(3), w(3));
        label(c, p, font, L[3], ax + 31, ay - 9, "left", tx(3), k1);
      }
    } else {
      if (has3(1)) label(c, p, font, L[1], (ax + cx) / 2 - 9, (ay + cy) / 2, "right", tx(1), k1);
      if (has3(2)) label(c, p, font, L[2], (bx + cx) / 2 + 9, (by + cy) / 2, "left", tx(2), k1);
    }
  } else if (s.shape === "circle") {
    const cx = 150;
    const cy = 88;
    const r = 52;
    if (on && s.lit === 2) halo(c, cx, cy, r, 0.5);
    strokePts(c, p, arcPts(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * k0, 48), al(2) * k0, col(2), w(2));
    dot(c, p, cx, cy, 2.4, k1);
    if (has3(1)) {
      line(c, p, cx - r, cy, cx + r, cy, al(1) * k1, col(1), k1, undefined, w(1));
      label(c, p, font, L[1], cx - r / 2, cy + 12, "center", tx(1), k1);
    }
    if (has3(0)) {
      const a = -Math.PI / 3.2;
      line(c, p, cx, cy, cx + r * Math.cos(a), cy + r * Math.sin(a), al(0) * k1, col(0), k1, undefined, w(0));
      label(c, p, font, L[0], cx + (r / 2) * Math.cos(a) - 7, cy + (r / 2) * Math.sin(a) - 4, "right", tx(0), k1);
    }
    if (has3(2)) label(c, p, font, L[2], cx + r * 0.8 + 8, cy - r * 0.72, "left", tx(2), k1);
  } else if (s.shape === "rectangle") {
    const x = 90;
    const y = 50;
    const rw = 120;
    const rh = 80;
    if (on && s.lit === 2) {
      fill(p, BLUE, 0.14);
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, y, rw, rh), 2, 2), p);
    }
    line(c, p, x, y + rh, x + rw, y + rh, al(0) * k0, col(0), k0, undefined, w(0));
    line(c, p, x + rw, y + rh, x + rw, y, al(1) * k0, col(1), k0, undefined, w(1));
    line(c, p, x + rw, y, x, y, 0.8 * k0, on && s.lit === 2 ? BLUE : SIL, k0);
    line(c, p, x, y, x, y + rh, 0.8 * k0, on && s.lit === 2 ? BLUE : SIL, k0);
    if (has3(0)) label(c, p, font, L[0], x + rw / 2, y + rh + 13, "center", tx(0), k1);
    if (has3(1)) label(c, p, font, L[1], x + rw + 9, y + rh / 2, "left", tx(1), k1);
    if (has3(2)) label(c, p, font, L[2], x + rw / 2, y + rh / 2, "center", tx(2), k1);
  } else {
    const vx = 100;
    const vy = 130;
    const ex = 222;
    const ey = 130;
    const fx = 188;
    const fy = 50;
    line(c, p, vx, vy, ex, ey, al(1) * k0, col(1), k0, undefined, w(1));
    line(c, p, vx, vy, fx, fy, al(2) * k0, col(2), k0, undefined, w(2));
    const ang = Math.atan2(vy - fy, fx - vx);
    strokePts(c, p, arcPts(vx, vy, 30, -ang * k1, 0, 12), al(0) * k1, col(0), w(0));
    if (has3(0)) label(c, p, font, L[0], vx + 40, vy - 14, "left", tx(0), k1);
    if (has3(1)) label(c, p, font, L[1], (vx + ex) / 2 + 20, vy + 13, "center", tx(1), k1);
    if (has3(2)) label(c, p, font, L[2], (vx + fx) / 2 - 9, (vy + fy) / 2 - 4, "right", tx(2), k1);
  }
}

// ---- bonds: which atoms are joined, and how strongly? ----
function bondXY(s: BondsScene): number[] {
  "worklet";
  const n = s.atoms.length;
  const out: number[] = [];
  const cx = 150;
  const cy = 84;
  if (s.shape === "bent") {
    out.push(cx - 46, cy + 22, cx, cy - 12, cx + 46, cy + 22);
  } else if (s.shape === "star") {
    out.push(cx, cy);
    const m = n - 1;
    const start = m === 2 ? Math.PI : -Math.PI / 2;
    for (let i = 0; i < m; i++) {
      const a = start + (i * TAU) / m;
      out.push(cx + 52 * Math.cos(a), cy + 46 * Math.sin(a));
    }
  } else if (s.shape === "ring") {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * TAU) / n;
      out.push(cx + 46 * Math.cos(a), cy + 44 * Math.sin(a));
    }
  } else {
    const gap = Math.min(54, 230 / Math.max(1, n - 1));
    for (let i = 0; i < n; i++) out.push(cx + (i - (n - 1) / 2) * gap, s.shape === "chain" ? cy + (i % 2 === 0 ? 12 : -12) : cy);
  }
  return out;
}

function drawBonds(c: SkCanvas, p: SkPaint, font: SkFont | null, s: BondsScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.atoms.length;
  const xy = bondXY(s);
  const R = 11;
  const pairs: number[] = [];
  if (s.shape === "star") for (let i = 1; i < n; i++) pairs.push(0, i);
  else {
    for (let i = 0; i < n - 1; i++) pairs.push(i, i + 1);
    if (s.shape === "ring") pairs.push(n - 1, 0);
  }
  const nb = pairs.length / 2;
  for (let b = 0; b < nb; b++) {
    const i = pairs[b * 2];
    const j = pairs[b * 2 + 1];
    const x1 = xy[i * 2];
    const y1 = xy[i * 2 + 1];
    const x2 = xy[j * 2];
    const y2 = xy[j * 2 + 1];
    const d = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    if (d < 1) continue;
    const ux = (x2 - x1) / d;
    const uy = (y2 - y1) / d;
    const order = b < s.orders.length ? s.orders[b] : 1;
    const k = beat(f, 1.2 + (b / nb) * 0.9, 3);
    for (let o = 0; o < order; o++) {
      const off = (o - (order - 1) / 2) * 4.6;
      line(c, p, x1 + ux * (R + 2) - uy * off, y1 + uy * (R + 2) + ux * off, x2 - ux * (R + 2) - uy * off, y2 - uy * (R + 2) + ux * off, 0.7 * k, SIL, k);
    }
  }
  const litI = stepping ? Math.min(n - 1, Math.floor(f.v * n)) : s.lit;
  const kL = stepping ? 1 : beat(f, 2.7, 3);
  for (let i = 0; i < n; i++) {
    const k = beat(f, 0.3 + (i / n) * 0.9, 3);
    const lit = i === litI && kL > 0.5;
    if (lit) halo(c, xy[i * 2], xy[i * 2 + 1], R, 1);
    ring(c, p, xy[i * 2], xy[i * 2 + 1], R, k * (lit ? 1 : 0.85), lit ? BLUE : SIL);
    label(c, p, font, s.atoms[i], xy[i * 2], xy[i * 2 + 1], "center", SIL, k * (lit ? 1 : 0.85));
  }
  label(c, p, font, s.name, 150, 162, "center", LAB, beat(f, 2, 3));
}

// ---- lever: how does a small push lift a big load? ----
// The effort needed is lit. It shrinks as the pivot moves towards the load.
function drawLever(c: SkCanvas, p: SkPaint, font: SkFont | null, s: LeverScene, changes: Change[], f: Frame) {
  "worklet";
  const sliding = hasKind(changes, "slide");
  const X0 = 56;
  const X1 = 244;
  const Y = 98;
  const at = sliding ? 0.2 + 0.4 * f.v : s.at;
  const px = X0 + at * (X1 - X0);
  const k0 = beat(f, 0, 3);
  const k1 = beat(f, 1, 3);
  line(c, p, 36, Y + 22, 264, Y + 22, 0.3, SIL, k0);
  strokePts(c, p, [px - 11, Y + 22, px, Y + 3, px + 11, Y + 22], 0.8 * k0);
  line(c, p, X0 - 8, Y, X1 + 8, Y, 0.9, SIL, k1);
  label(c, p, font, s.pivot, px, Y + 36, alignAt(px), LAB, k1);
  // The load's arrow is fixed; the effort's is in true proportion to it (load arm over effort arm).
  const LOAD = 44;
  const effortLen = (a: number) => clamp((LOAD * a) / (1 - a), 8, 70);
  const k2 = beat(f, 1.8, 3);
  arrow(c, p, X0, Y - 8 - LOAD, X0, Y - 6, 0.85 * k2, SIL, k2);
  label(c, p, font, s.load, X0 + 8, Y - 8 - LOAD, "left", LAB, k2);
  if (sliding) {
    const g = effortLen(s.at);
    line(c, p, X1 + 7, Y - 8 - g, X1 + 7, Y - 6, 0.25, SIL, 1, [3, 6]);
  }
  const kL = sliding ? 1 : beat(f, 2.7, 3);
  const len = effortLen(at);
  arrow(c, p, X1, Y - 8 - len, X1, Y - 6, kL > 0.01 ? 1 : 0, BLUE, kL);
  label(c, p, font, s.effort, X1 - 8, Y - 8 - len, "right", SIL, clamp(kL * 2 - 1));
}

// ---- working: what happens at each step? ----
// Worked lines, one under the next. A lit dot marks the line being explained;
// what was done to reach it is written beside it.
function drawWorking(c: SkCanvas, p: SkPaint, font: SkFont | null, s: WorkingScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.lines.length;
  const pitch = Math.min(27, 124 / n);
  const y0 = 88 - (pitch * (n - 1)) / 2;
  const litI = stepping ? Math.min(n - 1, Math.floor(f.v * n)) : s.lit;
  const kL = stepping ? 1 : beat(f, 2.7, 3);
  const TX = 44;
  const NX = 278;
  line(c, p, 30, y0 - 4, 30, y0 + (n - 1) * pitch + 4, 0.26, SIL, beat(f, 0, 3));
  for (let i = 0; i < n; i++) {
    const y = y0 + i * pitch;
    const k = stepping ? (i <= litI ? 1 : 0.3) : beat(f, 0.4 + (i / n) * 1.9, 3);
    const lit = i === litI && kL > 0.5;
    const nw = textW(font, s.lines[i].note);
    if (lit) dot(c, p, 30, y, 3.6, 1, BLUE);
    else dot(c, p, 30, y, 2.2, k * 0.7);
    fitLabel(c, p, font, s.lines[i].text, TX, y, "left", SIL, k * (lit ? 1 : 0.72), NX - TX - nw - 14);
    label(c, p, font, s.lines[i].note, NX, y, "right", LAB, k * (lit ? 1 : 0.7));
  }
}

// ---- stage: who does what to whom, and where? ----
// People, things and a place standing on one ground line. What happens between
// them is drawn over their heads: a speech or thought bubble, or an arc from
// one to another (gives, goes, against, with). One actor is lit.
/** How high a list of marks reaches: the smallest y among them, in their own -1 to 1 box. */
function marksTop(marks: ThingMark[]) {
  "worklet";
  let top = 1;
  for (let i = 0; i < marks.length; i++) {
    const v = marks[i] as number[];
    const code = marks[i][0] as string;
    if (code === "f") continue;
    if (code === "l") top = Math.min(top, v[2], v[4]);
    else if (code === "c" || code === "d" || code === "a") top = Math.min(top, v[2] - v[3]);
    else if (code === "b") top = Math.min(top, v[2]);
    else for (let j = 2; j < v.length; j += 2) top = Math.min(top, v[j]);
  }
  return top;
}

/** How high a thing reaches, whether drawn or built from the kit. */
function thingTop(name: string) {
  "worklet";
  const marks = THINGS[name];
  if (marks) return Math.max(-1, marksTop(marks));
  const q = name.split(":");
  if (q[0] === "person") {
    const pose = KIT_POSES[q[1] || "stand"];
    if (!pose) return -1;
    let top = marksTop(pose.m);
    if (q[3] && KIT_HATS[q[3]]) top = Math.min(top, pose.head[1] - 0.58);
    if (q[4] && THINGS[q[4]]) top = Math.min(top, pose.hand[1] - 0.5);
    return Math.max(-1.1, top);
  }
  if (q[0] === "place") {
    const shell = KIT_SHELLS[q[1]];
    if (!shell) return -1;
    return Math.max(-1, Math.min(marksTop(shell.m), q[2] && THINGS[q[2]] ? shell.sign[1] - shell.sign[2] : 1));
  }
  return -1;
}

/** A speech or thought bubble over a head at (x, y + 20). side 1 or -1 sets it to one side, leaving the other free for an arrow. */
function bubble(c: SkCanvas, p: SkPaint, font: SkFont | null, text: string, x: number, y: number, a: number, thought: boolean, colour: string, side: number, maxW: number) {
  "worklet";
  if (!font || !text || a <= 0.01) return;
  const room = side > 0 ? VIEW_W - 4 - (x - 6) : side < 0 ? x + 6 - 4 : maxW;
  const cap = Math.max(30, Math.min(maxW, room));
  const full = textW(font, text);
  // Too long for one line: the bubble grows a second line, so the words are never lost.
  const two = full + 16 > cap && text.indexOf(" ") > 0;
  const w = two ? Math.min(cap, Math.max(44, full * 0.62 + 16)) : Math.min(cap, Math.max(26, full + 16));
  const hh = two ? 14.5 : 9;
  const yy = two ? y - 5.5 : y;
  const bx = side > 0 ? x - 6 : side < 0 ? x + 6 - w : clamp(x - w / 2, 4, VIEW_W - 4 - w);
  stroke(p, colour, 0.75 * a);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(bx, yy - hh, w, hh * 2), 8, 8), p);
  const tx = clamp(x, bx + 9, bx + w - 9);
  if (thought) {
    ring(c, p, tx - 1, yy + hh + 4.5, 2.3, 0.7 * a, colour);
    ring(c, p, tx - 3, yy + hh + 10, 1.4, 0.7 * a, colour);
  } else {
    line(c, p, tx - 3, yy + hh, tx - 4, yy + hh + 7, 0.75 * a, colour);
    line(c, p, tx - 4, yy + hh + 7, tx + 4, yy + hh, 0.75 * a, colour);
  }
  if (two) label2(c, p, font, text, bx + w / 2, yy, "center", SIL, a, w - 10);
  else fitLabel(c, p, font, text, bx + w / 2, yy, "center", SIL, a, w - 8);
}

function drawStage(c: SkCanvas, p: SkPaint, font: SkFont | null, s: StageScene, changes: Change[], f: Frame) {
  "worklet";
  const GY = 134;
  const n = s.actors.length;
  const slots = n + (s.place ? 1 : 0);
  const stepping = hasKind(changes, "step");
  const litI = stepping ? Math.min(n - 1, Math.floor(f.v * n)) : s.lit;
  const kL = stepping ? 1 : beat(f, 2.6, 3);
  const pitch = Math.min(120, 268 / slots);
  const sp = stageSpots(s);
  const xs: number[] = [];
  const hs: number[] = [];
  const tops: number[] = [];
  for (let i = 0; i < slots; i++) {
    xs.push(sp[i * 4]);
    hs.push(sp[i * 4 + 2]);
  }
  const PH = s.place ? hs[n] : 0;
  const uC = carried(f);
  // Once the acts are done, an actor may change pose where they stand, and a cross or a tick may land.
  const kT = beat(f, 3, 3);
  // Each thing stands on the ground; its top is wherever its own marks reach.
  for (let i = 0; i < slots; i++) tops.push(GY - hs[i] * 0.95 + thingTop(i < n ? s.actors[i].thing : s.place) * hs[i]);
  line(c, p, 14, GY, 286, GY, 0.35, SIL, beat(f, 0, 3));
  if (s.place) {
    const k = beat(f, 0.3, 3);
    const crP = f.carry ? f.carry[n] : null;
    toneWash(c, xs[n], GY - PH * 0.95, PH * 1.05, s.placeTone, k);
    if (crP) drawCarried(c, p, crP, s.place, uC, xs[n], GY - PH * 0.95, PH, 0.62, false, false, 1);
    else drawThing(c, p, s.place, xs[n], GY - PH * 0.95, PH, 0.62, false, k);
    label2(c, p, font, s.placeLabel, xs[n], GY + 12, alignAt(xs[n]), LAB, k, pitch - 8);
  }
  for (let i = 0; i < n; i++) {
    const k = beat(f, 0.5 + (i / Math.max(1, n)) * 1.3, 3);
    const lit = i === litI && kL > 0.5;
    const act = s.actors[i];
    const cr = f.carry ? f.carry[i] : null;
    const y = GY - hs[i] * 0.95;
    const fx = sp[i * 4 + 3];
    const dim = act.mark === "cross" ? 1 - 0.45 * kT : 1;
    toneWash(c, xs[i], y, hs[i] * 1.05, act.tone, k);
    // Kept from the last picture: they walk to their new place. It is the same person, so they are not drawn again.
    if (cr && uC < 1) drawCarried(c, p, cr, act.thing, uC, xs[i], y, hs[i], dim, lit, !act.tone, fx);
    else if (act.then && (cr || k >= 1)) drawThingTween(c, p, act.thing, act.then, kT, xs[i], y, hs[i], dim, lit, W0, !act.tone, fx);
    else drawThing(c, p, act.thing, xs[i], y, hs[i], dim, lit, cr ? 1 : k, W0, !act.tone, fx);
    gesture(c, p, act.mark, xs[i], y, hs[i], kT, fx);
    label2(c, p, font, s.actors[i].label, xs[i], GY + 12, alignAt(xs[i]), lit ? SIL : LAB, k, pitch - 8);
  }
  // Which way each actor's arrow leaves or arrives, and who has a bubble: a bubble keeps to the other side.
  const way: number[] = [];
  const talks: boolean[] = [];
  for (let i = 0; i < slots; i++) {
    way.push(0);
    talks.push(false);
  }
  for (let j = 0; j < s.acts.length; j++) {
    const act = s.acts[j];
    if (act.from >= n) continue;
    if (act.kind === "says" || act.kind === "thinks") talks[act.from] = true;
    else {
      const to = act.to < 0 ? n : act.to;
      if (to === act.from || to >= slots) continue;
      const d = xs[to] > xs[act.from] ? 1 : -1;
      if (!way[act.from]) way[act.from] = d;
      if (!way[to]) way[to] = -d;
    }
  }
  let arcs = 0;
  for (let j = 0; j < s.acts.length; j++) {
    const act = s.acts[j];
    const k = beat(f, 2 + j * 0.3, 3);
    if (k <= 0 || act.from >= n) continue;
    if (act.kind === "says" || act.kind === "thinks") {
      bubble(c, p, font, act.label, xs[act.from], Math.max(13, tops[act.from] - 24), k, act.kind === "thinks", act.from === litI && kL > 0.5 ? BLUE : SIL, -way[act.from], Math.min(104, way[act.from] ? 104 : pitch - 6));
      continue;
    }
    const to = act.to < 0 ? n : act.to;
    if (to === act.from || to >= slots) continue;
    const dir = xs[to] > xs[act.from] ? 1 : -1;
    const ax = xs[act.from] + (talks[act.from] ? dir * 9 : 0);
    const bx = xs[to] - (talks[to] ? dir * 9 : 0);
    const y1 = tops[act.from] - 5;
    const y2 = tops[to] - 5;
    let high = Math.min(y1, y2);
    for (let i = Math.min(act.from, to) + 1; i < Math.max(act.from, to); i++) high = Math.min(high, tops[i] - (talks[i] ? 40 : 5));
    const apex = Math.max(24, high - 18 - arcs * 12);
    arcs++;
    // A curve through the apex: the control point sits twice as far out as the apex.
    const cy = 2 * apex - (y1 + y2) / 2;
    const N = 18;
    const pts: number[] = [];
    const upto = Math.max(1, Math.round(N * k));
    for (let i = 0; i <= upto; i++) {
      const t = i / N;
      const u = 1 - t;
      pts.push(u * u * ax + 2 * u * t * ((ax + bx) / 2) + t * t * bx, u * u * y1 + 2 * u * t * cy + t * t * y2);
    }
    strokePts(c, p, pts, 0.6, SIL, W0, act.kind === "with" ? [3, 5] : undefined);
    if (k >= 1 && act.kind !== "with") {
      const m = pts.length;
      const ang = Math.atan2(pts[m - 1] - pts[m - 3], pts[m - 2] - pts[m - 4]);
      line(c, p, bx - Math.cos(ang - 0.5) * 6, y2 - Math.sin(ang - 0.5) * 6, bx, y2, 0.6);
      line(c, p, bx - Math.cos(ang + 0.5) * 6, y2 - Math.sin(ang + 0.5) * 6, bx, y2, 0.6);
      if (act.kind === "against") {
        const a0 = Math.atan2(pts[3] - pts[1], pts[2] - pts[0]) + Math.PI;
        line(c, p, ax - Math.cos(a0 - 0.5) * 6, y1 - Math.sin(a0 - 0.5) * 6, ax, y1, 0.6);
        line(c, p, ax - Math.cos(a0 + 0.5) * 6, y1 - Math.sin(a0 + 0.5) * 6, ax, y1, 0.6);
      }
    }
    fitLabel(c, p, font, act.label, (ax + bx) / 2, apex - 9, "center", LAB, k, Math.max(60, Math.abs(bx - ax) + 30));
    // At rest a small light keeps travelling the way the action goes.
    if (k >= 1 && !f.still && (act.kind === "gives" || act.kind === "goes")) {
      const q = (f.t * 0.42 + j * 0.37) % 1.7;
      if (q < 1) {
        const u = 1 - q;
        dot(c, p, u * u * ax + 2 * u * q * ((ax + bx) / 2) + q * q * bx, u * u * y1 + 2 * u * q * cy + q * q * y2, 2.5, 1, BLUE);
      }
    }
  }
}

// ---- quote: which words carry the meaning? ----
// A short passage set large, one phrase lit and underlined, and a note on what
// that phrase does. For a line from a text, a statute or definition, or a
// sentence in another language.
function bare(t: string) {
  "worklet";
  return t.toLowerCase().replace(/[.,;:!?"'“”‘’()\[\]…]/g, "");
}

function drawQuote(c: SkCanvas, p: SkPaint, font: SkFont | null, s: QuoteScene, changes: Change[], f: Frame) {
  "worklet";
  if (!font) return;
  const K = 1.34;
  const maxW = 232 / K;
  const words = s.text.split(" ");
  const sp = Math.max(2, textW(font, "a a") - 2 * textW(font, "a"));
  const lines: number[][] = [];
  let cur: number[] = [];
  let w = 0;
  for (let i = 0; i < words.length; i++) {
    const ww = textW(font, words[i]);
    if (cur.length && w + sp + ww > maxW) {
      lines.push(cur);
      cur = [];
      w = 0;
    }
    w += (cur.length ? sp : 0) + ww;
    cur.push(i);
  }
  if (cur.length) lines.push(cur);
  // Where the phrase sits among the words.
  const pw = s.phrase.split(" ");
  let a0 = -1;
  for (let i = 0; i + pw.length <= words.length && a0 < 0; i++) {
    let ok = true;
    for (let j = 0; j < pw.length; j++) if (bare(words[i + j]) !== bare(pw[j])) ok = false;
    if (ok) a0 = i;
  }
  const a1 = a0 < 0 ? -1 : a0 + pw.length - 1;
  const nL = lines.length;
  const pitch = nL > 3 ? 16 : 19;
  const mid = s.note ? 62 : 80;
  const y0 = Math.max(20, mid - ((nL - 1) * pitch) / 2);
  const kU = beat(f, 1.9, 3);
  let ux = 150;
  let uy = y0;
  for (let li = 0; li < nL; li++) {
    const L = lines[li];
    let lw = 0;
    for (let j = 0; j < L.length; j++) lw += textW(font, words[L[j]]) + (j ? sp : 0);
    const left = 150 - (K * lw) / 2;
    const y = y0 + li * pitch;
    const k = beat(f, 0.2 + li * 0.45, 3);
    if (li === 0) {
      // The opening mark, from two short strokes.
      line(c, p, left - 11, y - 9, left - 9, y - 4, 0.5 * k);
      line(c, p, left - 7, y - 9, left - 5, y - 4, 0.5 * k);
    }
    let xx = 0;
    let u0 = -1;
    let u1 = -1;
    c.save();
    c.translate(left, y);
    c.scale(K, K);
    for (let j = 0; j < L.length; j++) {
      const wi = L[j];
      const ww = textW(font, words[wi]);
      const lit = wi >= a0 && wi <= a1 && kU > 0.3;
      rawLabel(c, p, font, words[wi], xx, 0, "left", lit ? BLUE : SIL, k * (lit ? 1 : 0.74));
      if (wi >= a0 && wi <= a1) {
        if (u0 < 0) u0 = xx;
        u1 = xx + ww;
      }
      xx += ww + sp;
    }
    c.restore();
    if (u0 >= 0) {
      line(c, p, left + K * u0, y + 8, left + K * u1, y + 8, 0.9, BLUE, kU);
      ux = left + (K * (u0 + u1)) / 2;
      uy = y + 8;
    }
  }
  const bottom = y0 + (nL - 1) * pitch;
  if (s.note) {
    const kN = beat(f, 2.4, 3);
    const ny = Math.min(150, bottom + 30);
    if (a0 >= 0) line(c, p, ux, uy + 3, ux, ny - 9, 0.4 * kN, BLUE, 1, [2, 4]);
    label2(c, p, font, s.note, clamp(ux, 70, 230), ny, "center", SIL, 0.92 * kN, 200);
  }
  rawLabel(c, p, font, s.by, 286, 166, "right", LAB, 0.8 * beat(f, 1.2, 3));
}

// ---- body: where is it in the body? ----
// The figure (or the brain) drawn quietly, with only the named parts drawn on
// it, each where it really is, and its name out at the side on a leader line.
function drawBody(c: SkCanvas, p: SkPaint, font: SkFont | null, s: BodyScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const brain = s.view === "brain";
  const whole = s.view === "whole";
  const X = 150;
  const Y = brain ? 84 : whole ? 13 : 9;
  const H = brain ? 60 : whole ? 150 : 262;
  const half = brain ? 60 : whole ? 28 : 48;
  const n = s.parts.length;
  const litI = stepping ? Math.min(n - 1, Math.floor(f.v * n)) : s.lit;
  const kL = stepping ? 1 : beat(f, 2.7, 3);
  drawMarks(c, p, BODY_FRAMES[brain ? "brain" : "body"], X, Y, H, 0.36, SIL, beat(f, 0, 3), 1.2, 1, 99);
  // Each name goes out to the side its part is on; a part on the midline, or a pair, takes the emptier side.
  const side: number[] = [];
  const ax: number[] = [];
  const ay: number[] = [];
  let nl = 0;
  let nr = 0;
  for (let i = 0; i < n; i++) {
    const q = BODY_PARTS[s.parts[i].part];
    const at = q ? q.at : [0, 0];
    let j = 0;
    let sd = at[0] < 0 ? -1 : 1;
    if (at.length >= 4) {
      sd = nl <= nr ? -1 : 1;
      j = sd < 0 ? 0 : 2;
    } else if (Math.abs(at[0]) * H < 5 || (sd < 0 ? nl : nr) >= 3) sd = nl <= nr ? -1 : 1;
    if (sd < 0) nl++;
    else nr++;
    side.push(sd);
    ax.push(X + at[j] * H);
    ay.push(Y + at[j + 1] * H);
  }
  const maxW = X - half - 22;
  const ly: number[] = [];
  for (let i = 0; i < n; i++) ly.push(ay[i]);
  for (let sd = -1; sd <= 1; sd += 2) {
    // The names on one side, top to bottom, pushed apart until none touch.
    const ids: number[] = [];
    for (let i = 0; i < n; i++) if (side[i] === sd) ids.push(i);
    for (let a = 1; a < ids.length; a++) for (let b = a; b > 0 && ay[ids[b]] < ay[ids[b - 1]]; b--) {
      const t = ids[b];
      ids[b] = ids[b - 1];
      ids[b - 1] = t;
    }
    const tall = (i: number) => (textW(font, s.parts[i].label) > maxW ? 6 : 0);
    for (let a = 0; a < ids.length; a++) {
      const i = ids[a];
      ly[i] = Math.max(14 + tall(i), Math.min(162 - tall(i), ay[i]));
      if (a > 0) ly[i] = Math.max(ly[i], ly[ids[a - 1]] + 14 + tall(i) + tall(ids[a - 1]));
    }
    for (let a = ids.length - 1; a >= 0; a--) {
      const i = ids[a];
      const cap = a === ids.length - 1 ? 162 - tall(i) : ly[ids[a + 1]] - 14 - tall(i) - tall(ids[a + 1]);
      if (ly[i] > cap) ly[i] = cap;
    }
  }
  for (let i = 0; i < n; i++) {
    const q = BODY_PARTS[s.parts[i].part];
    if (!q) continue;
    const k = stepping ? 1 : beat(f, 0.8 + (i / n) * 1.4, 3);
    const lit = i === litI && kL > 0.5;
    if (lit) thingHalo(c, ax[i] - side[i] * (brain ? 0 : 5), ay[i], 12, kL);
    drawMarks(c, p, q.m, X, Y, H, lit ? 1 : brain ? 0.5 : 0.78, lit ? BLUE : SIL, k, lit ? W0 : 1.25, 1, 99);
    const lx = X + side[i] * (half + 16);
    line(c, p, ax[i], ay[i], lx - side[i] * 4, ly[i], 0.3 * k, lit ? BLUE : SIL, k, undefined, 1);
    dot(c, p, ax[i], ay[i], 1.8, k, lit ? BLUE : SIL);
    label2(c, p, font, s.parts[i].label, lx, ly[i], side[i] < 0 ? "right" : "left", lit ? SIL : LAB, k, maxW);
  }
}

// ---- circuit: what is wired to what? ----
/** Half the width a circuit symbol takes out of its wire. */
function symbolHalf(kind: string) {
  "worklet";
  if (kind === "cell") return 3;
  if (kind === "capacitor") return 2.5;
  if (kind === "battery") return 10;
  if (kind === "diode" || kind === "led") return 5.5;
  if (kind === "buzzer") return 7;
  if (kind === "switch_open" || kind === "switch_closed") return 8;
  if (kind === "resistor" || kind === "variable_resistor" || kind === "fuse" || kind === "thermistor" || kind === "ldr") return 11;
  return 8;
}

/** One standard circuit symbol, centred on (x, y) on a wire running left to right. */
function circuitSymbol(c: SkCanvas, p: SkPaint, font: SkFont | null, kind: string, x: number, y: number, a: number, colour: string, closed: boolean) {
  "worklet";
  if (a <= 0.01) return;
  if (kind === "cell" || kind === "battery") {
    const xs = kind === "cell" ? [x - 3, x + 3] : [x - 10, x - 4.5, x + 4.5, x + 10];
    for (let i = 0; i < xs.length; i++) {
      // The long thin plate is positive, the short thick one negative.
      if (i % 2 === 0) line(c, p, xs[i], y - 8, xs[i], y + 8, a, colour);
      else line(c, p, xs[i], y - 4.5, xs[i], y + 4.5, a, colour, 1, undefined, W0 + 1.4);
    }
    if (kind === "battery") line(c, p, x - 4.5, y, x + 4.5, y, a * 0.8, colour, 1, [1.5, 3]);
  } else if (kind === "capacitor") {
    line(c, p, x - 2.5, y - 7, x - 2.5, y + 7, a, colour);
    line(c, p, x + 2.5, y - 7, x + 2.5, y + 7, a, colour);
  } else if (kind === "resistor" || kind === "variable_resistor" || kind === "fuse" || kind === "thermistor" || kind === "ldr") {
    stroke(p, colour, a);
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x - 11, y - 4.5, 22, 9), 1, 1), p);
    if (kind === "fuse") line(c, p, x - 11, y, x + 11, y, a * 0.8, colour);
    if (kind === "variable_resistor") arrow(c, p, x - 10, y + 9, x + 10, y - 9, a, colour);
    if (kind === "thermistor") strokePts(c, p, [x - 13, y + 9, x - 7, y + 9, x + 9, y - 9], a, colour);
    if (kind === "ldr") {
      arrow(c, p, x - 14, y - 17, x - 7, y - 8, a, colour);
      arrow(c, p, x - 6, y - 18, x + 1, y - 9, a, colour);
    }
  } else if (kind === "switch_open" || kind === "switch_closed") {
    dot(c, p, x - 8, y, 1.8, a, colour);
    dot(c, p, x + 8, y, 1.8, a, colour);
    if (closed) line(c, p, x - 8, y, x + 8, y, a, colour);
    else line(c, p, x - 8, y, x + 6, y - 8.5, a, colour);
  } else if (kind === "diode" || kind === "led") {
    strokePts(c, p, [x - 5.5, y - 6, x + 5.5, y, x - 5.5, y + 6, x - 5.5, y - 6], a, colour);
    line(c, p, x + 5.5, y - 6, x + 5.5, y + 6, a, colour);
    if (kind === "led") {
      arrow(c, p, x + 1, y - 9, x + 6, y - 15, a, colour);
      arrow(c, p, x + 7, y - 8, x + 12, y - 14, a, colour);
    }
  } else if (kind === "buzzer") {
    strokePts(c, p, arcPts(x, y, 7, Math.PI, TAU, 14), a, colour);
    line(c, p, x - 7, y, x + 7, y, a, colour);
  } else {
    // A ring with a mark inside: a lamp, a meter, a motor or an a.c. supply.
    fill(p, PANEL, a);
    c.drawCircle(x, y, 8, p);
    ring(c, p, x, y, 8, a, colour);
    if (kind === "bulb") {
      line(c, p, x - 5.6, y - 5.6, x + 5.6, y + 5.6, a, colour);
      line(c, p, x - 5.6, y + 5.6, x + 5.6, y - 5.6, a, colour);
    } else if (kind === "ac_supply") {
      const pts: number[] = [];
      for (let i = 0; i <= 12; i++) pts.push(x - 5 + (i / 12) * 10, y - Math.sin((i / 12) * TAU) * 3);
      strokePts(c, p, pts, a, colour);
    } else rawLabel(c, p, font, kind === "ammeter" ? "A" : kind === "voltmeter" ? "V" : "M", x, y, "center", colour, a);
  }
}

function drawCircuit(c: SkCanvas, p: SkPaint, font: SkFont | null, s: CircuitScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.parts.length;
  // Rung 0 is the top wire. With no parallel branches the supply and switches sit on top and the rest along the bottom.
  let top = 0;
  for (let i = 0; i < n; i++) top = Math.max(top, s.parts[i].branch);
  const rungOf: number[] = [];
  for (let i = 0; i < n; i++) {
    const kd = s.parts[i].kind;
    const supply = kd === "cell" || kd === "battery" || kd === "ac_supply" || kd === "switch_open" || kd === "switch_closed";
    rungOf.push(top > 0 ? s.parts[i].branch : supply ? 0 : 1);
  }
  let rungs = 0;
  for (let i = 0; i < n; i++) rungs = Math.max(rungs, rungOf[i]);
  rungs = Math.max(1, rungs);
  const L = 62;
  const R = 238;
  const T = rungs >= 3 ? 38 : 44;
  const B = rungs === 1 ? 124 : rungs === 2 ? 140 : 152;
  const ry = (r: number) => T + ((B - T) * r) / rungs;
  const count: number[] = [];
  for (let r = 0; r <= rungs; r++) count.push(0);
  for (let i = 0; i < n; i++) count[rungOf[i]]++;
  const seen: number[] = [];
  for (let r = 0; r <= rungs; r++) seen.push(0);
  const cx: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = rungOf[i];
    seen[r]++;
    cx.push(L + ((R - L) * seen[r]) / (count[r] + 1));
  }
  const shut = stepping ? f.v >= 0.5 : false;
  const open: boolean[] = [];
  for (let r = 0; r <= rungs; r++) open.push(false);
  let ac = false;
  for (let i = 0; i < n; i++) if (s.parts[i].kind === "ac_supply") ac = true;
  for (let i = 0; i < n; i++) {
    const kd = s.parts[i].kind;
    // No steady current through an open switch, a voltmeter, or a capacitor on a d.c. supply.
    if ((kd === "switch_open" && !shut) || kd === "voltmeter" || (kd === "capacitor" && !ac)) open[rungOf[i]] = true;
  }
  const live = (r: number) => !open[0] && !open[r] && (top > 0 || !open[1]);
  const k0 = beat(f, 0, 3);
  const litI = s.lit;
  const kL = beat(f, 2.7, 3);
  // Wires: the two rails, then each rung with gaps where its symbols sit.
  line(c, p, L, T, L, B, 0.5 * k0, SIL, k0);
  line(c, p, R, T, R, B, 0.5 * k0, SIL, k0);
  for (let r = 0; r <= rungs; r++) {
    let x = L;
    for (let i = 0; i < n; i++) {
      if (rungOf[i] !== r) continue;
      const h = symbolHalf(s.parts[i].kind);
      line(c, p, x, ry(r), cx[i] - h, ry(r), 0.5 * k0, SIL, k0);
      x = cx[i] + h;
    }
    line(c, p, x, ry(r), R, ry(r), 0.5 * k0, SIL, k0);
    if (r > 0 && r < rungs) {
      dot(c, p, L, ry(r), 2, k0 * 0.8);
      dot(c, p, R, ry(r), 2, k0 * 0.8);
    }
  }
  for (let i = 0; i < n; i++) {
    const r = rungOf[i];
    const k = beat(f, 0.7 + (i / n) * 1.3, 3);
    const lit = i === litI && kL > 0.5;
    const y = ry(r);
    if (lit) thingHalo(c, cx[i], y, 13, kL);
    circuitSymbol(c, p, font, s.parts[i].kind, cx[i], y, lit ? 1 : 0.85 * k, lit ? BLUE : SIL, shut);
    // A lamp with current through it shines.
    if (s.parts[i].kind === "bulb" && live(r) && k > 0.9) {
      for (let j = 0; j < 5; j++) {
        const an = Math.PI * (1.1 + j * 0.2);
        line(c, p, cx[i] + Math.cos(an) * 11, y + Math.sin(an) * 11, cx[i] + Math.cos(an) * 14.5, y + Math.sin(an) * 14.5, 0.55, lit ? BLUE : SIL);
      }
    }
    const tall = s.parts[i].kind === "bulb" || s.parts[i].kind === "ldr" || s.parts[i].kind === "led" ? 4 : 0;
    // With three rungs there is no room under a symbol, so its name sits just past it, above the wire.
    if (rungs >= 3 && r > 0) fitLabel(c, p, font, s.parts[i].label, cx[i] + symbolHalf(s.parts[i].kind) + (tall ? 10 : 6), y - 9, "left", lit ? SIL : LAB, k, (R - L) / (count[r] + 1) - symbolHalf(s.parts[i].kind) - 14);
    else fitLabel(c, p, font, s.parts[i].label, cx[i], r === 0 ? y - 16 - tall : y + 16, "center", lit ? SIL : LAB, k, (R - L) / (count[r] + 0.4) - 4);
  }
  // Current: small dots going round each closed loop, out of the long plate of the supply and back to the short one.
  if (f.still || k0 < 1) return;
  for (let r = 1; r <= rungs; r++) {
    if (!live(r)) continue;
    const yr = ry(r);
    const len = 2 * (R - L) + 2 * (yr - T);
    const gap = 30;
    const m = Math.floor(len / gap);
    for (let j = 0; j < m; j++) {
      const d = (j * gap + f.T * 22) % len;
      let x = 0;
      let y = 0;
      let on = 0;
      if (d < yr - T) {
        x = L;
        y = T + d;
      } else if (d < yr - T + (R - L)) {
        x = L + d - (yr - T);
        y = yr;
        on = r;
      } else if (d < 2 * (yr - T) + (R - L)) {
        x = R;
        y = yr - (d - (yr - T) - (R - L));
      } else {
        x = R - (d - 2 * (yr - T) - (R - L));
        y = T;
      }
      let hid = false;
      for (let i = 0; i < n; i++) if (rungOf[i] === on && Math.abs(y - ry(on)) < 0.5 && Math.abs(x - cx[i]) < symbolHalf(s.parts[i].kind) + 3) hid = true;
      if (!hid) dot(c, p, x, y, 1.5, 0.6);
    }
  }
}

// ---- table: what is in each row? ----
// A verb table, a truth table, a trace table. One row on its own is drawn as
// boxes in a line: an array in memory, with the column names as its indexes.
function drawTable(c: SkCanvas, p: SkPaint, font: SkFont | null, s: TableScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const nr = s.rows.length;
  const nc = s.cols.length;
  const boxes = nr === 1;
  const w: number[] = [];
  let total = 0;
  for (let j = 0; j < nc; j++) {
    let m = textW(font, s.cols[j]);
    for (let i = 0; i < nr; i++) m = Math.max(m, textW(font, s.rows[i][j]));
    w.push(Math.max(boxes ? 34 : 30, Math.min(110, m + 18)));
    total += w[j];
  }
  const kx = total > 272 ? 272 / total : 1;
  total *= kx;
  const L = 150 - total / 2;
  const x0: number[] = [];
  let acc = L;
  for (let j = 0; j < nc; j++) {
    x0.push(acc);
    w[j] *= kx;
    acc += w[j];
  }
  const head = s.title ? 26 : 12;
  const pitch = Math.min(boxes ? 32 : 22, (168 - head) / (nr + 1));
  const top = Math.max(head, 92 + (s.title ? 7 : 0) - ((nr + 1) * pitch) / 2);
  const litR = stepping ? Math.min(nr - 1, Math.floor(f.v * nr)) : s.litRow;
  const kL = stepping ? 1 : beat(f, 2.7, 3);
  const k0 = beat(f, 0, 3);
  label(c, p, font, s.title, 150, top - 11, "center", LAB, k0 * 0.9);
  for (let j = 0; j < nc; j++) fitLabel(c, p, font, s.cols[j], x0[j] + w[j] / 2, top + pitch / 2 + (boxes ? 5 : 0), "center", LAB, beat(f, 0.3, 3), w[j] - 6);
  if (!boxes) line(c, p, L, top + pitch, L + total, top + pitch, 0.34, SIL, k0);
  for (let i = 0; i < nr; i++) {
    const y = top + pitch * (i + 1);
    const k = stepping ? (i <= litR ? 1 : 0.25) : beat(f, 0.7 + (i / nr) * 1.5, 3);
    const rowLit = i === litR && kL > 0.5;
    if (rowLit && s.litCol < 0 && !boxes) box(c, p, L - 3, y + 1.5, total + 6, pitch - 3, 1, true, 6);
    for (let j = 0; j < nc; j++) {
      const lit = rowLit && (s.litCol < 0 || s.litCol === j);
      if (boxes) box(c, p, x0[j] + 2, y + 2, w[j] - 4, pitch - 4, k, lit, 5);
      else if (lit && s.litCol >= 0) box(c, p, x0[j] + 2, y + 1.5, w[j] - 4, pitch - 3, 1, true, 6);
      fitLabel(c, p, font, s.rows[i][j], x0[j] + w[j] / 2, y + pitch / 2, "center", lit ? SIL : j === 0 && !boxes ? LAB : SIL, k * (lit ? 1 : j === 0 && !boxes ? 1 : 0.7), w[j] - 8);
    }
  }
}

// ---- colours: when colour itself is the subject ----
// The only device that is not silver: flat swatches in their real colours,
// each with its name. A row of samples, one band split into parts, or a wheel.
function drawColours(c: SkCanvas, p: SkPaint, font: SkFont | null, s: ColoursScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.swatches.length;
  const litI = stepping ? Math.min(n - 1, Math.floor(f.v * n)) : s.lit;
  const kL = stepping ? 1 : beat(f, 2.7, 3);
  label(c, p, font, s.note, 150, s.layout === "wheel" ? 12 : 26, "center", LAB, beat(f, 0.2, 3) * 0.9);
  if (s.layout === "wheel") {
    const CX = 150;
    const CY = 94;
    const RO = 50;
    const RI = 21;
    for (let i = 0; i < n; i++) {
      const k = beat(f, 0.3 + (i / n) * 1.6, 3);
      const lit = i === litI && kL > 0.5;
      const a0 = -Math.PI / 2 + (i / n) * TAU + 0.02;
      const a1 = -Math.PI / 2 + ((i + 1) / n) * TAU - 0.02;
      const mid = (a0 + a1) / 2;
      const off = lit ? 5 : 0;
      const ox = CX + Math.cos(mid) * off;
      const oy = CY + Math.sin(mid) * off;
      const steps = Math.max(4, Math.round(40 / n));
      const outer = arcPts(ox, oy, RO, a0, a1, steps);
      const inner = arcPts(ox, oy, RI, a1, a0, steps);
      const pts = outer.concat(inner);
      fillPts(c, p, pts, k * (lit || kL < 0.5 ? 0.95 : 0.8), s.swatches[i].hex);
      if (lit) strokePts(c, p, pts.concat([pts[0], pts[1]]), 1, SIL, W0);
      if (n <= 8 || lit) {
        const lx = CX + Math.cos(mid) * (RO + 11 + off);
        const lyy = CY + Math.sin(mid) * (RO + 9 + off);
        const al = Math.cos(mid) > 0.3 ? "left" : Math.cos(mid) < -0.3 ? "right" : "center";
        fitLabel(c, p, font, s.swatches[i].name, lx, lyy, al, lit ? SIL : LAB, k, 86);
      }
    }
    return;
  }
  if (s.layout === "band") {
    const L = 28;
    const R = 272;
    const T = 58;
    const H = 40;
    const w = (R - L) / n;
    for (let i = 0; i < n; i++) {
      const k = beat(f, 0.3 + (i / n) * 1.6, 3);
      fillPts(c, p, [L + i * w, T, L + (i + 1) * w + 0.5, T, L + (i + 1) * w + 0.5, T + H, L + i * w, T + H], k * 0.95, s.swatches[i].hex);
    }
    for (let i = 0; i < n; i++) {
      const k = beat(f, 0.3 + (i / n) * 1.6, 3);
      const lit = i === litI && kL > 0.5;
      if (lit) {
        stroke(p, SIL, 1, W0 + 0.4);
        c.drawRRect(Skia.RRectXY(Skia.XYWHRect(L + i * w - 2, T - 4, w + 4, H + 8), 4, 4), p);
      }
      const up = n > 5 && i % 2 === 1;
      label2(c, p, font, s.swatches[i].name, L + i * w + w / 2, T + H + (up ? 30 : 17), "center", lit ? SIL : LAB, k, n > 5 ? w * 2 - 6 : w - 6);
    }
    return;
  }
  const pitch = Math.min(64, 264 / n);
  const r = Math.min(19, pitch / 2 - 5);
  for (let i = 0; i < n; i++) {
    const k = beat(f, 0.3 + (i / n) * 1.6, 3);
    const lit = i === litI && kL > 0.5;
    const x = 150 + (i - (n - 1) / 2) * pitch;
    fill(p, s.swatches[i].hex, k * 0.95);
    c.drawCircle(x, 82, r * (0.6 + 0.4 * k), p);
    if (lit) {
      stroke(p, SIL, 1, W0);
      c.drawCircle(x, 82, r + 4.5, p);
    }
    const up = n > 5 && i % 2 === 1;
    label2(c, p, font, s.swatches[i].name, x, 82 + r + (up ? 30 : 17), "center", lit ? SIL : LAB, k, n > 5 ? pitch * 2 - 6 : pitch - 4);
  }
}

// ---- stave: which notes, in what order? ----
/** How many steps of the scale a pitch ("C4", "F#4", "Bb3") sits above middle C. */
function pitchStep(pitch: string) {
  "worklet";
  const letter = "CDEFGAB".indexOf(pitch.charAt(0));
  const oct = Number(pitch.charAt(pitch.length - 1));
  return letter + (oct - 4) * 7;
}

function drawStave(c: SkCanvas, p: SkPaint, font: SkFont | null, s: StaveScene, changes: Change[], f: Frame) {
  "worklet";
  const stepping = hasKind(changes, "step");
  const n = s.notes.length;
  const G = 9;
  const MID = 82;
  const L = 26;
  const R = 278;
  const k0 = beat(f, 0, 3);
  for (let i = -2; i <= 2; i++) line(c, p, L, MID + i * G, R, MID + i * G, 0.36, SIL, k0, undefined, 1.1);
  line(c, p, R, MID - 2 * G, R, MID + 2 * G, 0.5 * k0, SIL, 1, undefined, W0 + 0.6);
  line(c, p, R - 4, MID - 2 * G, R - 4, MID + 2 * G, 0.4 * k0, SIL, 1, undefined, 1.1);
  const treble = s.clef !== "bass";
  drawMarks(c, p, THINGS[treble ? "treble_clef" : "bass_clef"], L + 15, MID, G * 3.5, 0.9, SIL, beat(f, 0.3, 3), W0, 1, 99);
  let x0 = L + 34;
  if (s.time && font) {
    const parts = s.time.split("/");
    for (let i = 0; i < 2; i++) {
      c.save();
      c.translate(x0 + 4, MID + (i === 0 ? -G : G) + 0.6);
      c.scale(1.7, 1.7);
      rawLabel(c, p, font, parts[i] ?? "", 0, 0, "center", SIL, beat(f, 0.5, 3) * 0.9);
      c.restore();
    }
    x0 += 20;
  }
  // The step of the bottom line above middle C: E4 for the treble clef, G2 for the bass.
  const base = treble ? 2 : -10;
  const pitch = Math.min(40, (R - 14 - x0) / n);
  const litI = stepping ? Math.min(n - 1, Math.floor(f.v * n)) : s.lit;
  const kL = stepping ? 1 : beat(f, 2.7, 3);
  const tq = s.time ? s.time.split("/") : [];
  const bar = tq.length === 2 ? (Number(tq[0]) * 4) / Number(tq[1]) : 0;
  let beats = 0;
  for (let i = 0; i < n; i++) {
    const nt = s.notes[i];
    const x = x0 + pitch * (i + 0.5);
    const k = stepping ? (i <= litI ? 1 : 0.3) : beat(f, 0.8 + (i / n) * 1.6, 3);
    const lit = i === litI && kL > 0.5;
    const col = lit ? BLUE : SIL;
    const al = lit ? 1 : 0.9 * k;
    if (nt.length === "rest") {
      strokePts(c, p, [x - 2.5, MID - 10, x + 2.5, MID - 4, x - 2.5, MID + 1, x + 2.5, MID + 6, x - 1, MID + 4.5, x - 2, MID + 10], al, col);
    } else {
      const names = nt.pitch.split("+");
      let lo = 99;
      let hi = -99;
      for (let j = 0; j < names.length; j++) {
        const st = pitchStep(names[j]) - base;
        lo = Math.min(lo, st);
        hi = Math.max(hi, st);
      }
      const up = (lo + hi) / 2 < 4;
      if (lit) thingHalo(c, x, MID + 2 * G - ((lo + hi) / 2) * (G / 2), 13, kL);
      for (let l = -2; l >= lo; l -= 2) line(c, p, x - 9, MID + 2 * G - l * (G / 2), x + 9, MID + 2 * G - l * (G / 2), 0.5 * k, SIL, 1, undefined, 1.1);
      for (let l = 10; l <= hi; l += 2) line(c, p, x - 9, MID + 2 * G - l * (G / 2), x + 9, MID + 2 * G - l * (G / 2), 0.5 * k, SIL, 1, undefined, 1.1);
      const hollow = nt.length === "whole" || nt.length === "half";
      for (let j = 0; j < names.length; j++) {
        const st = pitchStep(names[j]) - base;
        const y = MID + 2 * G - st * (G / 2);
        const pts: number[] = [];
        const rx = nt.length === "whole" ? 6 : 5.3;
        for (let q = 0; q < 16; q++) {
          const th = (q / 16) * TAU;
          const ex = rx * Math.cos(th);
          const ey = 3.6 * Math.sin(th);
          pts.push(x + ex * 0.94 + ey * 0.34, y - ex * 0.34 + ey * 0.94);
        }
        if (hollow) strokePts(c, p, pts.concat([pts[0], pts[1]]), al, col, W0 + 0.2);
        else fillPts(c, p, pts, al, col);
        const acc = names[j].length > 2 ? names[j].charAt(1) : "";
        if (acc === "#") {
          line(c, p, x - 14, y - 6, x - 14, y + 6, al, col, 1, undefined, 1.1);
          line(c, p, x - 10.5, y - 6.5, x - 10.5, y + 5.5, al, col, 1, undefined, 1.1);
          line(c, p, x - 16, y - 1.2, x - 8.5, y - 3, al, col, 1, undefined, W0);
          line(c, p, x - 16, y + 3, x - 8.5, y + 1.2, al, col, 1, undefined, W0);
        } else if (acc === "b") {
          strokePts(c, p, [x - 14, y - 10, x - 14, y + 3.5, x - 10, y + 0.5, x - 10, y - 2, x - 12, y - 3, x - 14, y - 1.5], al, col, 1.2);
        }
      }
      if (nt.length !== "whole") {
        const sx = up ? x + 5 : x - 5;
        const y1 = MID + 2 * G - (up ? lo : hi) * (G / 2);
        const y2 = MID + 2 * G - (up ? hi : lo) * (G / 2) + (up ? -28 : 28);
        line(c, p, sx, y1 + (up ? -1.4 : 1.4), sx, y2, al, col);
        if (nt.length === "eighth") strokePts(c, p, up ? [sx, y2, sx + 6, y2 + 7, sx + 5, y2 + 15] : [sx, y2, sx + 6, y2 - 7, sx + 5, y2 - 15], al, col);
      }
    }
    label2(c, p, font, nt.label, x, 150, "center", lit ? SIL : LAB, k, pitch - 3);
    beats += nt.length === "whole" ? 4 : nt.length === "half" ? 2 : nt.length === "eighth" ? 0.5 : 1;
    if (bar > 0 && i < n - 1 && Math.abs(beats / bar - Math.round(beats / bar)) < 0.01) line(c, p, x + pitch / 2, MID - 2 * G, x + pitch / 2, MID + 2 * G, 0.4 * k, SIL, 1, undefined, 1.1);
  }
}

// ---- hand-drawn lines (Dan Koe feel) ----
// A wrapper round the canvas and paint that gives straight lines and outlined
// circles a slight, steady wobble, like a marker. Fills, text and curves stay
// as they are, and the wobble never moves while a line sits still.
function wobble(s: number, seed: number) {
  "worklet";
  return 0.55 * Math.sin(s * 0.085 + seed) + 0.25 * Math.sin(s * 0.21 + seed * 1.7);
}

function handPaint(real: SkPaint, seed = 0, amp = 0) {
  "worklet";
  const hp = {
    real,
    seed,
    amp,
    style: 0,
    setStyle(v: number) {
      hp.style = v;
      real.setStyle(v);
    },
    setColor(v: unknown) {
      real.setColor(v as never);
    },
    setAlphaf(v: number) {
      real.setAlphaf(v);
    },
    setStrokeWidth(v: number) {
      real.setStrokeWidth(v);
    },
    setStrokeCap(v: number) {
      real.setStrokeCap(v);
    },
    setStrokeJoin(v: number) {
      real.setStrokeJoin(v);
    },
    setPathEffect(v: unknown) {
      real.setPathEffect(v as never);
    },
    setMaskFilter(v: unknown) {
      real.setMaskFilter(v as never);
    },
    setAntiAlias(v: boolean) {
      real.setAntiAlias(v);
    },
  };
  return hp;
}

function handCanvas(c: SkCanvas, seed = 0, amp = 0) {
  "worklet";
  // The boil field, the same one wx and wy use.
  const fx = (x: number, y: number) => (amp ? x + amp * (Math.sin(y * 0.045 + x * 0.021 + seed) + 0.5 * Math.sin(y * 0.11 - x * 0.05 + 2.3 * seed)) : x);
  const fy = (x: number, y: number) => (amp ? y + amp * (Math.sin(x * 0.043 - y * 0.019 + 1.7 * seed) + 0.5 * Math.sin(x * 0.12 + y * 0.04 + 3.1 * seed)) : y);
  const unwrap = (p: { real?: SkPaint } | SkPaint) => ((p as { real?: SkPaint }).real ? (p as { real: SkPaint }).real : (p as SkPaint));
  const outlined = (p: { real?: SkPaint; style?: number }) => !!p.real && p.style === 1;
  return {
    drawLine(x1: number, y1: number, x2: number, y2: number, p: SkPaint) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 6) {
        c.drawLine(fx(x1, y1), fy(x1, y1), fx(x2, y2), fy(x2, y2), unwrap(p));
        return;
      }
      const nx = -dy / len;
      const ny = dx / len;
      const seed = (x1 * 0.37 + y1 * 0.71) % TAU;
      const steps = Math.max(3, Math.min(28, Math.round(len / 7)));
      const path = Skia.PathBuilder.Make();
      path.moveTo(fx(x1, y1), fy(x1, y1));
      for (let i = 1; i <= steps; i++) {
        const u = i / steps;
        const d = u * len;
        const o = wobble(d, seed) * Math.min(1, d / 8, (len - d) / 8 + 0.35);
        const qx = x1 + dx * u + nx * o;
        const qy = y1 + dy * u + ny * o;
        path.lineTo(fx(qx, qy), fy(qx, qy));
      }
      c.drawPath(path.build(), unwrap(p));
    },
    drawCircle(x: number, y: number, r: number, p: SkPaint) {
      if (!outlined(p as never) || r < 2.5 || (r < 8 && !amp)) {
        c.drawCircle(fx(x, y), fy(x, y), r, unwrap(p));
        return;
      }
      const path = Skia.PathBuilder.Make();
      if (r < 8) {
        // A small ring keeps its shape and only boils with everything else.
        const M = Math.max(10, Math.round(r * 2.4));
        for (let i = 0; i <= M; i++) {
          const th = (i / M) * TAU;
          const qx = x + r * Math.cos(th);
          const qy = y + r * Math.sin(th);
          if (i === 0) path.moveTo(fx(qx, qy), fy(qx, qy));
          else path.lineTo(fx(qx, qy), fy(qx, qy));
        }
        c.drawPath(path.build(), unwrap(p));
        return;
      }
      // A marker circle: a little uneven, and its end runs just past its start.
      const seed = r * 1.37;
      const N = Math.max(18, Math.min(44, Math.round(r * 1.8)));
      for (let i = 0; i <= N; i++) {
        const th = -Math.PI * 0.6 + (i / N) * (TAU + 0.22);
        const rr = r + 0.45 * Math.sin(th * 2 + seed) + 0.22 * Math.sin(th * 5 + seed * 2) + (i / N) * 0.7;
        const qx = x + rr * Math.cos(th);
        const qy = y + rr * Math.sin(th);
        if (i === 0) path.moveTo(fx(qx, qy), fy(qx, qy));
        else path.lineTo(fx(qx, qy), fy(qx, qy));
      }
      c.drawPath(path.build(), unwrap(p));
    },
    drawPath(path: unknown, p: SkPaint) {
      c.drawPath(path as never, unwrap(p));
    },
    drawRRect(rr: { rect: { x: number; y: number; width: number; height: number }; rx: number }, p: SkPaint) {
      if (!outlined(p as never) || !rr.rect || rr.rect.width < 4 || (rr.rect.width < 12 && !amp)) {
        c.drawRRect(rr as never, unwrap(p));
        return;
      }
      // A marker box: four slightly uneven sides joined by small corner arcs.
      const { x, y, width: w, height: h } = rr.rect;
      const r = Math.min(rr.rx || 0, w / 2, h / 2);
      const seed = (x * 0.53 + y * 0.29) % TAU;
      const path = Skia.PathBuilder.Make();
      const side = (x1: number, y1: number, x2: number, y2: number, first: boolean) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(2, Math.min(24, Math.round(len / 8)));
        for (let i = 0; i <= steps; i++) {
          const u = i / steps;
          const o = len > 10 ? wobble(u * len, seed + x1 * 0.1) * Math.sin(Math.PI * u) : 0;
          const px = x1 + dx * u + (-dy / Math.max(1, len)) * o;
          const py = y1 + dy * u + (dx / Math.max(1, len)) * o;
          if (first && i === 0) path.moveTo(fx(px, py), fy(px, py));
          else path.lineTo(fx(px, py), fy(px, py));
        }
      };
      const corner = (cx: number, cy: number, a0: number) => {
        for (let i = 1; i <= 3; i++) {
          const a = a0 + (i / 3) * (Math.PI / 2);
          path.lineTo(fx(cx + r * Math.cos(a), cy + r * Math.sin(a)), fy(cx + r * Math.cos(a), cy + r * Math.sin(a)));
        }
      };
      side(x + r, y, x + w - r, y, true);
      corner(x + w - r, y + r, -Math.PI / 2);
      side(x + w, y + r, x + w, y + h - r, false);
      corner(x + w - r, y + h - r, 0);
      side(x + w - r, y + h, x + r, y + h, false);
      corner(x + r, y + h - r, Math.PI / 2);
      side(x, y + h - r, x, y + r, false);
      corner(x + r, y + r, Math.PI);
      // The pen runs just past where it started.
      path.lineTo(x + r + 3, y + 0.4);
      c.drawPath(path.build(), unwrap(p));
    },
    drawText(t: string, x: number, y: number, p: SkPaint, font: SkFont) {
      c.drawText(t, x, y, unwrap(p), font);
    },
    save() {
      c.save();
    },
    restore() {
      c.restore();
    },
    translate(x: number, y: number) {
      c.translate(x, y);
    },
    rotate(d: number, x: number, y: number) {
      c.rotate(d, x, y);
    },
    scale(x: number, y: number) {
      c.scale(x, y);
    },
    clipPath(path: unknown, op: number, aa: boolean) {
      c.clipPath(path as never, op as never, aa);
    },
  };
}

/** How fast the scene's clock runs at slider value v, when the slider changes speed. */
export function speedAt(changes: Change[], v: number) {
  "worklet";
  return hasKind(changes, "speed") ? 0.2 + v * 3 : 1;
}

// ---- container: stuff moving between places ----
function drawParticles(c: SkCanvas, p: SkPaint, font: SkFont | null, s: ParticlesScene, changes: Change[], f: Frame) {
  "worklet";
  const n = Math.max(1, s.zones.length);
  const zw = VIEW_W / n;
  const top = 16;
  const bottom = 146;
  const kDiv = beat(f, 0, 3);

  for (let k = 1; k < n; k++) {
    const x = k * zw;
    if (s.divider === "membrane") line(c, p, x, 14, x, 150, 0.35, SIL, kDiv, [6, 7]);
    else if (s.divider === "wall") line(c, p, x, 14, x, 150, 0.45, SIL, kDiv);
    else if (s.divider === "sieve") for (let i = 0; i < 7; i++) line(c, p, x, 17 + i * 19, x, 25 + i * 19, 0.45 * kDiv, SIL, 1, undefined, 3);
  }

  // Bouncing marks, so collisions between different kinds can spark.
  const hx: number[] = [];
  const hy: number[] = [];
  const hg: number[] = [];
  const hf: boolean[] = [];

  for (let g = 0; g < s.things.length; g++) {
    const th = s.things[g];
    const appear = has(changes, th.name, "appear");
    const crosses = has(changes, th.name, "cross");
    const fast = has(changes, th.name, "speed");
    const grows = has(changes, th.name, "grow");
    const lit = crosses || fast || grows;
    const tm = fast ? f.T : f.t;
    const x0 = th.zone * zw + 16;
    const w = zw - 32;
    const tx0 = th.to * zw + 16;
    const h = bottom - top;
    const cx = th.zone * zw + zw / 2;
    const cy = (top + bottom) / 2;
    const dense = th.count > 10;
    let size = th.mark === "dot" ? (dense ? 3.2 : 3.6) : dense ? 7.5 : 9;
    if (grows) size *= 0.55 + f.v * 1.0;

    for (let i = 0; i < th.count; i++) {
      const seed = g * 31 + i;
      const ph = rnd(seed + 9) * TAU;
      const bx = x0 + rnd(seed) * w;
      const by = top + 6 + rnd(seed + 7) * (h - 12);
      let x = bx;
      let y = by;
      let r = size;
      let a = beat(f, 1 + g * 0.5 + i / th.count, 3);
      if (appear) a *= clamp(f.v * th.count - i);

      switch (th.motion) {
        case "drift":
          x = bx + Math.sin(tm * 0.6 + ph) * 2.5;
          y = by + Math.cos(tm * 0.5 + ph) * 2.5;
          break;
        case "jiggle": {
          // Bounce: straight lines off the walls. A short trail of fading dots
          // shows speed, worked out from where the mark was a moment ago, so
          // it bends round the walls with it. Slow marks leave almost none.
          const vx = rnd(seed + 80) - 0.5;
          const vy = rnd(seed + 120) - 0.5;
          const ox = rnd(seed) * w;
          const oy = rnd(seed + 7) * (h - 8);
          x = x0 + bounce(ox + vx * tm * 50, w);
          y = top + 4 + bounce(oy + vy * tm * 50, h - 8);
          if (!f.still && th.mark !== "blocked") {
            const sp = fast ? speedAt(changes, f.v) : 1;
            for (let j = 1; j <= 3; j++) {
              const back = tm - sp * 0.05 * j;
              const gx = x0 + bounce(ox + vx * back * 50, w);
              const gy = top + 4 + bounce(oy + vy * back * 50, h - 8);
              // A trail dot hidden under its own mark would read as a second thing.
              if ((gx - x) * (gx - x) + (gy - y) * (gy - y) <= (size + 2) * (size + 2)) continue;
              dot(c, p, gx, gy, (th.mark === "dot" ? 2.2 : 2.6) * (1 - j * 0.2), a * (0.32 - j * 0.09));
            }
          }
          if (hx.length < 40) {
            hx.push(x);
            hy.push(y);
            hg.push(g);
            hf.push(fast);
          }
          break;
        }
        case "cross": {
          if (th.zone === th.to) break;
          const q = (tm / 3.6 + rnd(seed + 3)) % 1;
          if (th.mark === "blocked") {
            const edge = th.to > th.zone ? (th.zone + 1) * zw - 14 : th.zone * zw + 14;
            x = bx + (edge - bx) * Math.sin(q * Math.PI);
          } else {
            x = bx + (tx0 + rnd(seed) * w - bx) * ease2((q - 0.1) / 0.6);
            a *= q < 0.08 ? q / 0.08 : q > 0.85 ? (1 - q) / 0.15 : 1;
          }
          break;
        }
        case "rise": {
          // Bubbles: sway as they rise and swell a little near the top.
          const q = (tm * 0.18 + rnd(seed + 3)) % 1;
          y = bottom - q * h;
          x = bx + Math.sin(q * TAU * 1.5 + ph) * 4;
          r = size * (0.8 + q * 0.5);
          a *= Math.sin(q * Math.PI);
          break;
        }
        case "fall": {
          // Grains: slow down as they sink, land on the floor, then fade.
          const q = (tm * 0.14 + rnd(seed + 3)) % 1;
          y = top + ease(q * 1.25) * (h - 4);
          a *= q > 0.85 ? (1 - q) / 0.15 : Math.min(1, q / 0.08);
          break;
        }
        case "orbit": {
          const band = i % 3;
          const ang = tm * 0.6 * (1 - band * 0.2) + i * 2.4;
          x = cx + Math.cos(ang) * (16 + band * 14);
          y = cy + Math.sin(ang) * (16 + band * 14) * 0.9;
          break;
        }
        case "pulse":
          r = size * (1 + 0.12 * Math.sin(tm * 1.8 + ph));
          break;
        case "flow": {
          const q = (rnd(seed) + tm * 0.08) % 1;
          x = 10 + q * (VIEW_W - 20);
          a *= Math.min(1, q / 0.08, (1 - q) / 0.08);
          break;
        }
        default:
          break;
      }

      if (crosses && th.zone !== th.to) x += (tx0 - x0) * ease2(clamp(f.v * 0.85 * th.count - i));

      if (th.mark === "dot") dot(c, p, x, y, r, a, lit && th.count <= 6 ? BLUE : SIL);
      else if (th.mark === "ring") ring(c, p, x, y, r, a * 0.85);
      else {
        // Something stopped: a dim ring with a cross through it.
        ring(c, p, x, y, r, a * 0.5);
        const k = r * 0.42;
        line(c, p, x - k, y - k, x + k, y + k, a * 0.5);
        line(c, p, x + k, y - k, x - k, y + k, a * 0.5);
      }
    }
  }
  // Spark where two different kinds meet while things are moving fast.
  if (f.v > 0.3 && !f.still) {
    let sparks = 0;
    for (let i = 0; i < hx.length && sparks < 6; i++)
      for (let j = i + 1; j < hx.length && sparks < 6; j++) {
        if (hg[i] === hg[j] || !(hf[i] || hf[j])) continue;
        const dx = hx[i] - hx[j];
        const dy = hy[i] - hy[j];
        if (dx * dx + dy * dy < 144) {
          spark(c, p, (hx[i] + hx[j]) / 2, (hy[i] + hy[j]) / 2, beat(f, 2, 3));
          sparks++;
        }
      }
  }
  for (let k = 0; k < n; k++) label(c, p, font, s.zones[k], k * zw + zw / 2, 164, "center", LAB, beat(f, 2.5, 3));
}

export function drawScene(canvas: SkCanvas, scene: Scene, changes: Change[], f: Frame, font: SkFont | null) {
  "worklet";
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  // Hand-drawn: the same drawing code, through a canvas that wobbles lines.
  // With boil on, the field behind every stroke changes with f.boil, a few times a second.
  const amp = f.boil && !f.still ? (f.amp ?? BOIL_GENTLE) : 0;
  const seed = amp ? f.boil! * 2.39996 : 0;
  const hand = f.hand || amp > 0;
  const c = hand ? (handCanvas(canvas, seed, amp) as unknown as SkCanvas) : canvas;
  const p = hand ? (handPaint(paint, seed, amp) as unknown as SkPaint) : paint;
  switch (scene.family) {
    case "particles":
      drawParticles(c, p, font, scene, changes, f);
      break;
    case "links":
      drawLinks(c, p, font, scene, changes, f);
      break;
    case "graph":
      drawGraph(c, p, font, scene, changes, f);
      break;
    case "balance":
      drawBalance(c, p, font, scene, changes, f);
      break;
    case "compare":
      drawCompare(c, p, font, scene, changes, f);
      break;
    case "stairs":
      drawStairs(c, p, font, scene, changes, f);
      break;
    case "spectrum":
      drawSpectrum(c, p, font, scene, changes, f);
      break;
    case "venn":
      drawVenn(c, p, font, scene, changes, f);
      break;
    case "pair":
      drawPair(c, p, font, scene, changes, f);
      break;
    case "tree":
      drawTree(c, p, font, scene, changes, f);
      break;
    case "test":
      drawTest(c, p, font, scene, changes, f);
      break;
    case "threshold":
      drawThreshold(c, p, font, scene, changes, f);
      break;
    case "units":
      drawUnits(c, p, font, scene, changes, f);
      break;
    case "crowd":
      drawCrowd(c, p, font, scene, changes, f);
      break;
    case "grid":
      drawGrid(c, p, font, scene, changes, f);
      break;
    case "timeline":
      drawTimeline(c, p, font, scene, changes, f);
      break;
    case "layers":
      drawLayers(c, p, font, scene, changes, f);
      break;
    case "wave":
      drawWave(c, p, font, scene, changes, f);
      break;
    case "mirror":
      drawMirror(c, p, font, scene, changes, f);
      break;
    case "stack":
      drawStack(c, p, font, scene, changes, f);
      break;
    case "radial":
      drawRadial(c, p, font, scene, changes, f);
      break;
    case "cutaway":
      drawCutaway(c, p, font, scene, changes, f);
      break;
    case "funnel":
      drawFunnel(c, p, font, scene, changes, f);
      break;
    case "sankey":
      drawSankey(c, p, font, scene, changes, f);
      break;
    case "fan":
      drawFan(c, p, font, scene, changes, f);
      break;
    case "spiral":
      drawSpiral(c, p, font, scene, changes, f);
      break;
    case "zoom":
      drawZoom(c, p, font, scene, changes, f);
      break;
    case "brace":
      drawBrace(c, p, font, scene, changes, f);
      break;
    case "map":
      drawMap(c, p, font, scene, changes, f);
      break;
    case "things":
      drawThings(c, p, font, scene, changes, f);
      break;
    case "spectra":
      drawSpectra(c, p, font, scene, changes, f);
      break;
    case "pattern":
      drawPattern(c, p, font, scene, changes, f);
      break;
    case "machine":
      drawMachine(c, p, font, scene, changes, f);
      break;
    case "case":
      drawCase(c, p, font, scene, changes, f);
      break;
    case "forces":
      drawForces(c, p, font, scene, changes, f);
      break;
    case "equation":
      drawEquation(c, p, font, scene, changes, f);
      break;
    case "bridge":
      drawBridge(c, p, font, scene, changes, f);
      break;
    case "spread":
      drawSpread(c, p, font, scene, changes, f);
      break;
    case "scatter":
      drawScatter(c, p, font, scene, changes, f);
      break;
    case "matrix":
      drawMatrix(c, p, font, scene, changes, f);
      break;
    case "geometry":
      drawGeometry(c, p, font, scene, changes, f);
      break;
    case "bonds":
      drawBonds(c, p, font, scene, changes, f);
      break;
    case "lever":
      drawLever(c, p, font, scene, changes, f);
      break;
    case "working":
      drawWorking(c, p, font, scene, changes, f);
      break;
    case "stage":
      drawStage(c, p, font, scene, changes, f);
      break;
    case "quote":
      drawQuote(c, p, font, scene, changes, f);
      break;
    case "body":
      drawBody(c, p, font, scene, changes, f);
      break;
    case "circuit":
      drawCircuit(c, p, font, scene, changes, f);
      break;
    case "table":
      drawTable(c, p, font, scene, changes, f);
      break;
    case "colours":
      drawColours(c, p, font, scene, changes, f);
      break;
    case "stave":
      drawStave(c, p, font, scene, changes, f);
      break;
  }
}

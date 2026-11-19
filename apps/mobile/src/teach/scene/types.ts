// The drawn scenes a lesson can send, mirrored from apps/api/src/scene.ts.
// The server has already checked them, so the app can trust the shapes here.
import { hasThing } from "./kit";

export type Mark = "dot" | "ring" | "blocked";
export type Motion = "still" | "drift" | "jiggle" | "cross" | "rise" | "fall" | "orbit" | "pulse" | "flow";

export interface Thing {
  name: string;
  mark: Mark;
  count: number;
  zone: number;
  to: number;
  motion: Motion;
}

export interface ParticlesScene {
  family: "particles";
  zones: string[];
  divider: "none" | "wall" | "membrane" | "sieve";
  things: Thing[];
}

export interface LinksScene {
  family: "links";
  layout: "line" | "fork" | "loop" | "web";
  nodes: string[];
  links: { from: number; to: number; kind: "cause" | "flow" | "tie" }[];
  /** loop layout only: a loop that builds on itself, or one that settles back. Older servers leave it out. */
  feedback?: "reinforcing" | "balancing" | "";
}

export type Shape = "rise" | "fall" | "saturate" | "decay" | "bell" | "s_curve" | "grow" | "u_curve" | "cycle" | "steps";

export interface GraphScene {
  family: "graph";
  x: string;
  y: string;
  curves: { name: string; shape: Shape; label: string }[];
  highlight: "ride" | "crossing" | "half" | "end" | "none";
}

export interface BalanceScene {
  family: "balance";
  left: string;
  right: string;
  leftWeight: number;
  rightWeight: number;
  middle: string;
}

export interface CompareScene {
  family: "compare";
  style: "circles" | "bars";
  items: { label: string; value: number }[];
}

export interface StairsScene {
  family: "stairs";
  steps: string[];
  at: number;
}

export interface SpectrumScene {
  family: "spectrum";
  left: string;
  right: string;
  min: number;
  max: number;
  marks: { label: string; at: number }[];
  at: number;
}

export interface VennScene {
  family: "venn";
  a: string;
  b: string;
  both: string;
  overlap: number;
}

export type PairShape = "line" | "curve" | "jagged" | "smooth" | "split" | "join" | "scatter" | "aligned" | "one" | "many" | "loop" | "path";

/** Colour for meaning: one soft wash behind a thing. Green for good, red for bad. Older servers leave it out. */
export type Tone = "" | "good" | "bad";

export interface PairSide {
  label: string;
  shape: PairShape;
  count: number;
  note: string;
  tone?: Tone;
}

/** The difference between X and Y: two small pictures side by side, one lit. */
export interface PairScene {
  family: "pair";
  left: PairSide;
  right: PairSide;
  lit: "left" | "right";
}

/** What branches from what: a root, branches and leaves, one path lit. */
export interface TreeScene {
  family: "tree";
  root: string;
  branches: { label: string; leaves: string[] }[];
  /** leaf -1 means the branch itself. */
  lit: { branch: number; leaf: number };
}

/** Does it pass every condition? A case meets each gate in turn. */
export interface TestScene {
  family: "test";
  case: string;
  gates: string[];
  /** The first gate it fails, or -1 if it passes them all. */
  fails: number;
  outcome: string;
}

/** Has it crossed the line? A level rises against one marked line. */
export interface ThresholdScene {
  family: "threshold";
  level: string;
  line: string;
  at: number;
  value: number;
}

/** How many out of 100. */
export interface UnitsScene {
  family: "units";
  lit: number;
  label: string;
  rest: string;
  /** A thing to count with instead of dots (person, coin), or "". Older servers leave it out. */
  thing?: string;
  /** A second group among the rest, drawn as rings (people who test positive without the disease). Older servers leave it out. */
  also?: number;
  alsoLabel?: string;
}

/** Which one stands out from many. */
export interface CrowdScene {
  family: "crowd";
  x: string;
  y: string;
  count: number;
  crowd: "rise" | "fall" | "flat";
  lit: string;
  litShape: "rise" | "fall" | "flat" | "peak" | "dip";
}

/** Where it falls on two scales at once. quadrants: top left, top right, bottom left, bottom right. */
export interface GridScene {
  family: "grid";
  x: string;
  y: string;
  quadrants: string[];
  item: string;
  atX: number;
  atY: number;
}

/** When, and in what order. */
export interface TimelineScene {
  family: "timeline";
  events: { label: string; when: string; t: number }[];
  scale: "even" | "true";
  at: number;
}

/** What is built on, or inside, what. Top or outermost first. */
export interface LayersScene {
  family: "layers";
  layers: string[];
  style: "stack" | "nested";
  at: number;
  whole: string;
}

/** What repeats as it travels. */
export interface WaveScene {
  family: "wave";
  kind: "transverse" | "longitudinal";
  what: string;
  wavelength: string;
  amplitude: string;
}

/** What is the partner of this. */
export interface MirrorScene {
  family: "mirror";
  leftTitle: string;
  rightTitle: string;
  pairs: { left: string; right: string }[];
  lit: number;
}

/** Last in, first out. Items bottom first. */
export interface StackScene {
  family: "stack";
  label: string;
  items: string[];
  action: "push" | "pop";
}

/** What sits round one centre. */
export interface RadialScene {
  family: "radial";
  centre: string;
  spokes: string[];
  lit: number;
  cycle: boolean;
}

/** A whole and its shares (percentages). */
export interface CutawayScene {
  family: "cutaway";
  whole: string;
  parts: { label: string; share: number }[];
  lit: number;
}

/** Drop off at each stage. */
export interface FunnelScene {
  family: "funnel";
  stages: { label: string; value: number }[];
  lit: number;
}

/** One flow split by amount (percentages). */
export interface SankeyScene {
  family: "sankey";
  source: string;
  splits: { label: string; share: number }[];
  lit: number;
}

/** A forecast that widens. */
export interface FanScene {
  family: "fan";
  x: string;
  y: string;
  shape: "rise" | "fall" | "flat";
  now: number;
  label: string;
}

/** A loop that climbs. */
export interface SpiralScene {
  family: "spiral";
  stages: string[];
  turns: number;
  label: string;
}

/** The same thing at each scale, biggest first. */
export interface ZoomScene {
  family: "zoom";
  levels: { label: string; size: string }[];
  at: number;
}

/** Which belong together. */
export interface BraceScene {
  family: "brace";
  items: string[];
  groups: { label: string; from: number; to: number }[];
  lit: number;
}

/** A schematic map, north up. x 0 west to 1 east, y 0 south to 1 north. */
export interface MapScene {
  family: "map";
  places: { label: string; x: number; y: number }[];
  routes: { from: number; to: number }[];
  lit: number;
}

/** Drawn objects, people and places (names from things.ts). */
export interface ThingsScene {
  family: "things";
  layout: "row" | "versus" | "chain" | "orbit" | "scale" | "parts";
  items: { thing: string; label: string; size: number; tone?: Tone }[];
  /** parts layout: named parts of the one thing, each at a spot on it. Older servers leave it out. */
  parts?: { label: string; at: string }[];
  lit: number;
}

/** Where one thing sits on several scales at once. */
export interface SpectraScene {
  family: "spectra";
  item: string;
  rows: { left: string; right: string; at: number }[];
  lit: number;
}

/** What comes next: a run of terms with one gap, then its answer. */
export interface PatternScene {
  family: "pattern";
  items: string[];
  gap: number;
  answer: string;
  rule: string;
}

/** What goes in, what is done to it, what comes out. */
export interface MachineScene {
  family: "machine";
  name: string;
  inputs: string[];
  outputs: string[];
  lit: number;
}

/** A claim, the reasons under it, and one objection. lit -1 is the objection. */
export interface CaseScene {
  family: "case";
  claim: string;
  reasons: string[];
  objection: string;
  lit: number;
}

/** Pushes and pulls on one object, and what they add up to. */
export interface ForcesScene {
  family: "forces";
  object: string;
  forces: { label: string; dir: "up" | "down" | "left" | "right"; size: number }[];
  result: string;
}

export type Sign = "plus" | "minus" | "times" | "over" | "equals" | "gives" | "both";

/** Terms joined by signs: a reaction, a formula, an identity. */
export interface EquationScene {
  family: "equation";
  terms: { label: string; note: string }[];
  signs: Sign[];
  lit: number;
}

/** What maps to what: two sets and the links between them. */
export interface BridgeScene {
  family: "bridge";
  leftTitle: string;
  rightTitle: string;
  left: string[];
  right: string[];
  maps: { from: number; to: number }[];
  lit: number;
}

/** How values are spread: dots piled into a shape. */
export interface SpreadScene {
  family: "spread";
  x: string;
  shape: "normal" | "skew_right" | "skew_left" | "uniform" | "bimodal";
  lit: "middle" | "left_tail" | "right_tail" | "outlier" | "width";
  label: string;
}

/** Do two things go together: a cloud of points and its trend. */
export interface ScatterScene {
  family: "scatter";
  x: string;
  y: string;
  trend: "up" | "down" | "none";
  strength: "strong" | "weak";
  lit: "line" | "outlier";
  label: string;
}

/** Every combination of two choices: a small table, one cell lit. Cells row by row. */
export interface MatrixScene {
  family: "matrix";
  rowTitle: string;
  colTitle: string;
  rows: string[];
  cols: string[];
  cells: string[];
  litRow: number;
  litCol: number;
}

/** A plain shape with its parts named. */
export interface GeometryScene {
  family: "geometry";
  shape: "right_triangle" | "triangle" | "circle" | "rectangle" | "angle";
  labels: string[];
  lit: number;
}

/** Atoms and the bonds between them. */
export interface BondsScene {
  family: "bonds";
  shape: "line" | "bent" | "star" | "chain" | "ring";
  atoms: string[];
  orders: number[];
  lit: number;
  name: string;
}

/** A small push far from the pivot lifts a big load near it. at: where the pivot sits, 0 (at the load) to 1. */
export interface LeverScene {
  family: "lever";
  load: string;
  effort: string;
  pivot: string;
  at: number;
}

/** Worked steps, one line at a time: algebra, a proof, a trace through code. */
export interface WorkingScene {
  family: "working";
  lines: { text: string; note: string }[];
  lit: number;
}

export type Scene =
  | ParticlesScene
  | LinksScene
  | GraphScene
  | BalanceScene
  | CompareScene
  | StairsScene
  | SpectrumScene
  | VennScene
  | PairScene
  | TreeScene
  | TestScene
  | ThresholdScene
  | UnitsScene
  | CrowdScene
  | GridScene
  | TimelineScene
  | LayersScene
  | WaveScene
  | MirrorScene
  | StackScene
  | RadialScene
  | CutawayScene
  | FunnelScene
  | SankeyScene
  | FanScene
  | SpiralScene
  | ZoomScene
  | BraceScene
  | MapScene
  | ThingsScene
  | SpectraScene
  | PatternScene
  | MachineScene
  | CaseScene
  | ForcesScene
  | EquationScene
  | BridgeScene
  | SpreadScene
  | ScatterScene
  | MatrixScene
  | GeometryScene
  | BondsScene
  | LeverScene
  | WorkingScene
  | StageScene
  | QuoteScene;

/** Who does what to whom, and where: people and things on one ground line, with what happens between them. */
export interface StageScene {
  family: "stage";
  /** A place drawn behind them at the right, or "". */
  place: string;
  placeLabel: string;
  placeTone?: Tone;
  actors: { thing: string; label: string; size: "small" | "normal" | "big"; tone?: Tone }[];
  /** to -1 is the place. says and thinks ignore to. */
  acts: { from: number; to: number; kind: "says" | "thinks" | "gives" | "goes" | "against" | "with"; label: string }[];
  lit: number;
}
/** The exact words: a short passage with one phrase lit and a note on it. */
export interface QuoteScene {
  family: "quote";
  text: string;
  phrase: string;
  note: string;
  by: string;
}

/** The families this build of the app can draw. A newer server may send others: those fall back to the simple diagram. */
export const DRAWABLE: readonly string[] = [
  "particles", "links", "graph", "balance", "compare", "stairs", "spectrum", "venn", "pair", "tree", "test", "threshold", "units", "crowd",
  "grid", "timeline", "layers", "wave", "mirror", "stack", "radial", "cutaway", "funnel", "sankey", "fan", "spiral", "zoom", "brace", "map", "things",
  "spectra", "pattern", "machine", "case", "forces", "equation", "bridge", "spread", "scatter", "matrix", "geometry", "bonds", "lever", "working",
  "stage", "quote",
];

/** True when this build can draw the scene: a known family, and every thing in it known. */
export function canDraw(scene: Scene | null | undefined): scene is Scene {
  if (!scene || !DRAWABLE.includes(scene.family)) return false;
  if (scene.family === "things") return scene.items.every((t) => hasThing(t.thing));
  if (scene.family === "stage") return scene.actors.every((t) => hasThing(t.thing)) && (!scene.place || hasThing(scene.place));
  return true;
}

export type ChangeKind = "appear" | "cross" | "speed" | "grow" | "step" | "shift" | "stretch" | "ride" | "weigh" | "climb" | "slide" | "overlap" | "fill";
export interface Change {
  target: string;
  does: ChangeKind;
}

export interface Play {
  prompt: string;
  low: string;
  high: string;
  readouts: string[];
  changes: Change[];
}

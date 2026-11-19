// Drawn scenes for Teach me. The lesson writer never draws pixels: for each
// bite it fills in one scene from a fixed kit (forty-four families covering
// forty-eight devices: scale, comparison, path, fork, loop, network,
// container, plot, stairs, spectrum, Venn, balance, pair, tree, test,
// threshold, units, crowd, grid, timeline, layers, wave, mirror, stack,
// radial, cutaway, funnel, sankey, fan, spiral, zoom, brace, map, things,
// and since v10 spectra, pattern, machine, case, forces, equation, bridge,
// spread, scatter, matrix, geometry, bonds, lever and working),
// and the app draws it live with Skia. Things are drawn objects (people,
// planets, cells, coins, buildings, metaphors) from the same few marks.
// The look follows the principles of Visual Value, softened for Fenny: one
// idea per picture, silver lines on near-black, only one thing lit.
// One bite per lesson may also carry a "play" slider that changes the scene.
//
// The visual language (see the Fenny Drawing Kit page) is enforced here: the
// model can only choose from these lists, and checkScene() trims anything the
// app could not draw well. A broken scene becomes null, and the app falls back
// to the simple diagram.

export const FAMILIES = [
  "particles", "links", "graph", "balance", "compare", "stairs", "spectrum", "venn", "pair", "tree", "test", "threshold", "units", "crowd",
  "grid", "timeline", "layers", "wave", "mirror", "stack", "radial", "cutaway", "funnel", "sankey", "fan", "spiral", "zoom", "brace", "map", "things",
  "spectra", "pattern", "machine", "case", "forces", "equation", "bridge", "spread", "scatter", "matrix", "geometry", "bonds", "lever", "working",
  "stage", "quote",
] as const;
export const STAGE_KINDS = ["says", "thinks", "gives", "goes", "against", "with"] as const;
export const STAGE_SIZES = ["small", "normal", "big"] as const;
export const MARKS = ["dot", "ring", "blocked"] as const;
export const MOTIONS = ["still", "drift", "jiggle", "cross", "rise", "fall", "orbit", "pulse", "flow"] as const;
export const DIVIDERS = ["none", "wall", "membrane", "sieve"] as const;
export const LAYOUTS = ["line", "fork", "loop", "web"] as const;
export const LINK_KINDS = ["cause", "flow", "tie"] as const;
export const SHAPES = ["rise", "fall", "saturate", "decay", "bell", "s_curve", "grow", "u_curve", "cycle", "steps"] as const;
export const HIGHLIGHTS = ["ride", "crossing", "half", "end", "none"] as const;
export const CHANGES = ["appear", "cross", "speed", "grow", "step", "shift", "stretch", "ride", "weigh", "climb", "slide", "overlap", "fill"] as const;
export const COMPARE_STYLES = ["circles", "bars"] as const;
/** The little pictures a pair can set side by side. Each has one meaning. */
export const PAIR_SHAPES = ["line", "curve", "jagged", "smooth", "split", "join", "scatter", "aligned", "one", "many", "loop", "path"] as const;
/** The shape of the many grey lines in a crowd, and of the one that stands out. */
export const CROWD_SHAPES = ["rise", "fall", "flat"] as const;
export const STANDOUT_SHAPES = ["rise", "fall", "flat", "peak", "dip"] as const;
export const TIMELINE_SCALES = ["even", "true"] as const;
export const LAYER_STYLES = ["stack", "nested"] as const;
export const WAVE_KINDS = ["transverse", "longitudinal"] as const;
export const STACK_ACTIONS = ["push", "pop"] as const;
export const THING_LAYOUTS = ["row", "versus", "chain", "orbit", "scale", "parts"] as const;
/** A loop that builds on itself, or one that settles back. "" for any other links scene. */
export const FEEDBACKS = ["", "reinforcing", "balancing"] as const;
export const FORCE_DIRS = ["up", "down", "left", "right"] as const;
/** What joins two terms of an equation. gives is an arrow, both a reaction that runs both ways. */
export const SIGNS = ["plus", "minus", "times", "over", "equals", "gives", "both"] as const;
export const SPREAD_SHAPES = ["normal", "skew_right", "skew_left", "uniform", "bimodal"] as const;
export const SPREAD_LITS = ["middle", "left_tail", "right_tail", "outlier", "width"] as const;
export const TRENDS = ["up", "down", "none"] as const;
export const STRENGTHS = ["strong", "weak"] as const;
export const SCATTER_LITS = ["line", "outlier"] as const;
export const GEOMETRY_SHAPES = ["right_triangle", "triangle", "circle", "rectangle", "angle"] as const;
export const BOND_SHAPES = ["line", "bent", "star", "chain", "ring"] as const;
/** Where a named part sits on a drawn thing, for the parts layout. */
export const PART_SPOTS = ["top", "bottom", "left", "right", "top left", "top right", "bottom left", "bottom right", "centre"] as const;
/** Every drawn thing the app knows (apps/mobile/src/teach/scene/things.ts), by group. A test keeps the two lists the same. */
export const THING_GROUPS = {
  "People and the body": ["person", "people", "face", "hand", "eye", "brain", "heart", "lungs", "cell", "dna", "virus", "bacterium", "tooth", "bone", "kidney", "stomach", "neuron", "ear", "chromosome", "mitochondrion", "skeleton", "family"],
  "Earth and space": ["sun", "moon", "planet", "earth", "star", "rocket", "cloud", "raindrop", "lightning", "snowflake", "flame", "mountain", "tree", "leaf", "flower", "sprout", "water", "volcano"],
  "Science": ["atom", "molecule", "flask", "magnet", "battery", "bulb", "gear", "thermometer", "pill", "spring", "microscope", "telescope", "magnifier", "prism", "pendulum", "beaker", "circuit", "testtube", "burner", "lens", "pulley", "crystal", "weight", "petri"],
  "Money and society": ["coin", "banknote", "house", "factory", "building", "crown", "flag", "ballot", "justice", "book", "document", "contract", "pin", "graduation", "speech", "handshake", "shop", "gavel", "prison", "hospital", "school", "handcuffs", "fence", "passport", "placard", "border", "throne", "cannon", "bomb", "tank", "treaty", "tax", "gold", "shopping_bag", "chains"],
  "Technology": ["computer", "phone", "chip", "database", "lock", "key", "envelope", "signal", "robot", "code", "satellite", "camera", "server", "cloudstore", "laptop", "printer", "network", "drone", "browser", "folder", "bug", "cursor", "mouse", "keyboard", "usb", "router", "password", "apps", "binary", "ai"],
  "Time and ideas": ["clock", "hourglass", "calendar", "target", "trophy", "question", "idea", "puzzle", "shield", "umbrella", "thought", "chain", "hammer", "scales", "mirror"],
  "Transport": ["car", "ship", "plane", "train", "bicycle", "bus", "lorry", "sailboat", "helicopter"],
  "Living things": ["apple", "bird", "fish", "cat", "footprint", "dog", "butterfly", "bee", "frog", "mushroom", "snake", "spider", "whale", "rabbit", "snail"],
  "Metaphors": ["iceberg", "dominoes", "snowball", "ladder", "bridge", "door", "signpost", "anchor", "funnel", "wall", "seesaw", "maze", "path", "seed", "gift", "rope", "key_hole", "balloon", "tug", "crossroads", "hill", "toolbox", "battery_low", "staircase", "bucket", "flagpeak", "glass", "onion", "ripple", "net", "sieve", "spotlight", "tightrope", "thermostat"],
  "Health and medicine": ["syringe", "stethoscope", "plaster", "medical", "bed", "clipboard", "drip", "wheelchair", "blood", "facemask", "pulse", "ambulance", "baby", "elder", "liver", "spine", "muscle", "xray", "crutch", "scalpel"],
  "Energy and environment": ["turbine", "solar", "pylon", "plug", "barrel", "recycle", "tap", "smoke"],
  "Maths and data": ["dice", "card", "ruler", "protractor", "triangle", "cube", "barchart", "linechart", "pie", "abacus", "infinity", "compasses"],
  "Arts, music and sport": ["note", "piano", "guitar", "headphones", "microphone", "palette", "brush", "frame", "ball", "runner", "dumbbell", "medal", "theatre", "drum", "violin", "trumpet", "stave", "easel", "vase", "stage", "goal", "racket", "whistle", "stopwatch", "chess"],
  "History and places": ["castle", "sword", "scroll", "pyramid", "helmet", "candle", "globe", "map", "compass", "quill", "wheel", "tent"],
  "Food and farming": ["bread", "carrot", "wheat", "cow", "cup", "egg", "tractor", "milk", "cheese", "banana", "bowl", "pot", "meat", "cake", "salt"],
  "Business and work": ["briefcase", "cart", "pricetag", "creditcard", "bank", "piggybank", "safe", "calculator", "receipt", "parcel", "crane", "conveyor"],
  "Language and media": ["alphabet", "quote", "dictionary", "newspaper", "megaphone", "tv", "radio", "pencil", "blackboard", "film", "podium", "translate"],
  "Places and buildings": ["river", "island", "cactus", "city", "arch", "column", "dome", "lighthouse", "road", "dam", "windmill", "coast", "church", "mosque", "temple", "pagoda", "palace", "parliament", "courthouse", "skyscraper", "flats", "cottage", "hut", "igloo", "barn", "market_stall", "station", "port", "mine", "well", "gate", "ruins", "statue", "monument", "colosseum", "tomb", "village", "street", "stadium", "library", "museum", "office", "warehouse", "power_station", "greenhouse", "tunnel", "forest", "desert", "waterfall", "cave", "cliff", "lake", "valley", "glacier", "beach", "farm_field", "tornado", "rainbow", "earthquake"],
  "People in action": ["person_waving", "person_pointing", "person_presenting", "person_thinking", "person_idea", "person_shrugging", "person_cheering", "person_sad", "person_angry", "person_worried", "person_surprised", "person_proud", "person_refusing", "person_running", "person_walking", "person_sitting", "person_kneeling", "person_climbing", "person_pushing", "person_pulling", "person_carrying", "person_lifting", "person_falling", "person_sleeping", "person_reading", "person_writing", "person_shouting", "person_listening", "person_bowing", "person_praying", "person_dancing", "person_kicking", "person_throwing", "person_jumping", "person_digging", "person_saluting", "person_asking", "person_giving", "person_voting", "person_protesting", "person_at_computer", "person_shopping", "person_hiding", "person_winning", "person_losing"],
  "People together": ["people_talking", "people_arguing", "people_agreeing", "people_teaching", "people_helping", "people_hugging", "people_trading", "people_fighting", "parent_and_child", "people_chasing", "people_interview", "master_and_servant", "leader_and_followers", "queue", "team", "meeting", "audience", "march", "crowd_and_one", "generations"],
  "Roles and jobs": ["monarch", "soldier", "knight", "judge", "doctor", "nurse", "teacher", "student", "farmer", "builder", "scientist", "artist", "merchant", "monk", "police", "chef", "athlete", "explorer", "detective", "musician", "writer", "politician", "worker", "pilgrim", "sailor", "child"],
  "Home and everyday": ["chair", "table", "window", "lamp", "sofa", "bottle", "plate", "cutlery", "pan", "bag", "shoe", "hat", "shirt", "dress", "glasses", "watch", "scissors", "broom", "box", "basket", "fridge", "oven", "washing_machine", "bath", "bin", "bench", "streetlamp", "traffic_light", "teddy", "wallet", "ring", "soap"],
  "Signs and beliefs": ["tick", "cross_mark", "warning", "no_entry", "plus", "minus", "percent", "arrow_up", "arrow_down", "cycle", "exclamation", "sleep", "christian_cross", "crescent", "star_of_david", "yin_yang", "dharma_wheel", "oil_lamp", "peace", "skull", "ghost", "mask", "angel"],
} as const;
export const THING_NAMES: readonly string[] = Object.values(THING_GROUPS).flat();
/** A drawn thing by name, or one built from the kit of parts (see asThing). */
type ThingName = string;

/** Colour for meaning: one soft wash behind a thing. Green for good, red for bad, nothing otherwise. */
export const TONES = ["", "good", "bad"] as const;
export type Tone = (typeof TONES)[number];

// The kit of parts. A person is a pose with any feeling, any hat and any thing
// in its hand; a building is a shell with any thing as its sign. The app holds
// the parts (kitparts.ts); these are their names, copied over by mirror.py.
// KIT:start
export const KIT_POSES: readonly string[] = ["waving", "pointing", "presenting", "thinking", "idea", "shrugging", "cheering", "sad", "angry", "worried", "surprised", "proud", "refusing", "running", "walking", "sitting", "kneeling", "climbing", "pushing", "pulling", "carrying", "lifting", "falling", "reading", "writing", "shouting", "listening", "bowing", "praying", "dancing", "kicking", "throwing", "jumping", "digging", "saluting", "asking", "giving", "voting", "protesting", "at_computer", "shopping", "hiding", "winning", "losing", "stand", "holding"];
export const KIT_MOODS: readonly string[] = ["happy", "laugh", "sad", "angry", "worried", "surprised", "neutral", "think", "sleep"];
export const KIT_WEARS: readonly string[] = ["crown", "cap", "hardhat", "mortarboard", "chefhat", "helmet", "widehat", "beret", "wig", "tophat", "hood", "nursecap"];
export const KIT_SHELLS: readonly string[] = ["block", "house", "hall", "tower", "shop"];
// KIT:end

/**
 * Tidies the name of something to draw. A drawn thing passes as it is. A kit
 * name is checked part by part and rebuilt: person:POSE:MOOD:WEARS:HOLDS or
 * place:SHELL:SIGN, where an unknown part is dropped, not the whole picture.
 * Returns "" when it is neither.
 */
export function asThing(x: unknown): string {
  if (typeof x !== "string") return "";
  const s = x.trim();
  if (THING_NAMES.includes(s)) return s;
  const q = s.split(":").map((v) => v.trim().toLowerCase().replace(/\s+/g, "_"));
  if (q[0] === "person" && q.length > 1) {
    const holds = THING_NAMES.includes(q[4] ?? "") ? q[4] : "";
    let pose = (q[1] ?? "").replace(/^person_/, "");
    if (!KIT_POSES.includes(pose)) pose = "stand";
    // Something in the hand needs a hand held out.
    if (holds && pose === "stand") pose = "holding";
    const mood = KIT_MOODS.includes(q[2] ?? "") ? q[2] : "";
    const wears = KIT_WEARS.includes(q[3] ?? "") ? q[3] : "";
    return ["person", pose, mood, wears, holds].join(":").replace(/:+$/, "");
  }
  if (q[0] === "place" && KIT_SHELLS.includes(q[1] ?? "")) {
    const sign = THING_NAMES.includes(q[2] ?? "") ? q[2] : "";
    return sign ? `place:${q[1]}:${sign}` : `place:${q[1]}`;
  }
  return "";
}

export interface Thing {
  name: string;
  mark: (typeof MARKS)[number];
  count: number;
  zone: number;
  /** For motion "cross" or the "cross" change: the zone it heads to. */
  to: number;
  motion: (typeof MOTIONS)[number];
}
export interface ParticlesScene {
  family: "particles";
  zones: string[];
  divider: (typeof DIVIDERS)[number];
  things: Thing[];
}
export interface LinksScene {
  family: "links";
  layout: (typeof LAYOUTS)[number];
  nodes: string[];
  links: { from: number; to: number; kind: (typeof LINK_KINDS)[number] }[];
  /** Loop layout with 3 or more nodes: which kind of feedback loop it is, or "". */
  feedback: (typeof FEEDBACKS)[number];
}
export interface GraphScene {
  family: "graph";
  x: string;
  y: string;
  curves: { name: string; shape: (typeof SHAPES)[number]; label: string }[];
  highlight: (typeof HIGHLIGHTS)[number];
}
export interface BalanceScene {
  family: "balance";
  left: string;
  right: string;
  leftWeight: number;
  rightWeight: number;
  middle: string;
}
/** Scale or comparison: circles sized by value, or bars. */
export interface CompareScene {
  family: "compare";
  style: (typeof COMPARE_STYLES)[number];
  items: { label: string; value: number }[];
}
/** Levels climbed in order, bottom first. */
export interface StairsScene {
  family: "stairs";
  steps: string[];
  at: number;
}
/** Where something sits between two ends. */
export interface SpectrumScene {
  family: "spectrum";
  left: string;
  right: string;
  min: number;
  max: number;
  marks: { label: string; at: number }[];
  at: number;
}
/** What two things share. overlap is 0 (apart) to 1 (mostly shared). */
export interface VennScene {
  family: "venn";
  a: string;
  b: string;
  both: string;
  overlap: number;
}
/** The difference between X and Y: two small pictures side by side, one lit. */
export interface PairSide {
  label: string;
  shape: (typeof PAIR_SHAPES)[number];
  /** For split, join and many: how many. */
  count: number;
  /** A word or two under the picture, or "". */
  note: string;
  /** A soft wash of colour behind this side: good, bad or "". */
  tone: Tone;
}
export interface PairScene {
  family: "pair";
  left: PairSide;
  right: PairSide;
  lit: "left" | "right";
}
/** What branches from what: a root, 2 to 4 branches, a few leaves, one path lit. */
export interface TreeScene {
  family: "tree";
  root: string;
  branches: { label: string; leaves: string[] }[];
  /** The path the lesson is about. leaf -1 means the branch itself. */
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
  /** Where the line sits, 0 (bottom) to 1 (top). */
  at: number;
  /** Where the level ends, 0 to 1. Above at means it crosses. */
  value: number;
}
/** How many out of 100: a grid of 100 dots, some lit. */
export interface UnitsScene {
  family: "units";
  lit: number;
  label: string;
  rest: string;
  /** A thing to count with instead of dots (person, coin), or "". */
  thing: string;
  /** A second group among the rest, drawn as rings: how many in 100, or 0. */
  also: number;
  alsoLabel: string;
}
/** Which one stands out from many: grey lines, one lit and named. */
export interface CrowdScene {
  family: "crowd";
  x: string;
  y: string;
  count: number;
  crowd: (typeof CROWD_SHAPES)[number];
  lit: string;
  litShape: (typeof STANDOUT_SHAPES)[number];
}
/** Where it falls on two scales at once: a two by two with one item placed. */
export interface GridScene {
  family: "grid";
  x: string;
  y: string;
  /** Top left, top right, bottom left, bottom right; "" for none. */
  quadrants: string[];
  item: string;
  /** Where the item sits, 0 to 1 along each axis (y 1 is the top). */
  atX: number;
  atY: number;
}
/** When, and in what order: events along a line, one lit. */
export interface TimelineScene {
  family: "timeline";
  events: { label: string; when: string; t: number }[];
  /** even spaces events equally; true places them by t. */
  scale: (typeof TIMELINE_SCALES)[number];
  at: number;
}
/** What is built on, or inside, what: bands top first, one lit. */
export interface LayersScene {
  family: "layers";
  layers: string[];
  style: (typeof LAYER_STYLES)[number];
  at: number;
  whole: string;
}
/** What repeats as it travels: particles move up and down (or to and fro), the wave moves along. */
export interface WaveScene {
  family: "wave";
  kind: (typeof WAVE_KINDS)[number];
  what: string;
  wavelength: string;
  amplitude: string;
}
/** What is the partner of this: two columns across a mirror line; lighting one lights its partner. */
export interface MirrorScene {
  family: "mirror";
  leftTitle: string;
  rightTitle: string;
  pairs: { left: string; right: string }[];
  lit: number;
}
/** What goes on top, and what comes off first: boxes, bottom first. */
export interface StackScene {
  family: "stack";
  label: string;
  items: string[];
  action: (typeof STACK_ACTIONS)[number];
}
/** What sits round one centre: spokes, or stages round a circle. */
export interface RadialScene {
  family: "radial";
  centre: string;
  spokes: string[];
  lit: number;
  /** True when the spokes are stages gone round in order. */
  cycle: boolean;
}
/** What a whole is made of, and in what shares. */
export interface CutawayScene {
  family: "cutaway";
  whole: string;
  parts: { label: string; share: number }[];
  lit: number;
}
/** How many drop out at each stage. Values fall from the top stage down. */
export interface FunnelScene {
  family: "funnel";
  stages: { label: string; value: number }[];
  lit: number;
}
/** How one flow splits, by amount. */
export interface SankeyScene {
  family: "sankey";
  source: string;
  splits: { label: string; share: number }[];
  lit: number;
}
/** How uncertain a forecast gets further ahead: the past, then a widening fan. */
export interface FanScene {
  family: "fan";
  x: string;
  y: string;
  shape: (typeof CROWD_SHAPES)[number];
  /** Where the past ends, 0.3 to 0.8 of the way along. */
  now: number;
  label: string;
}
/** A loop that climbs: stages gone round again and again, each time further out. */
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
/** Which belong together: a row of items with braces under groups. */
export interface BraceScene {
  family: "brace";
  items: string[];
  groups: { label: string; from: number; to: number }[];
  lit: number;
}
/** Where places are, and what moves between them. A schematic map, north up. */
export interface MapScene {
  family: "map";
  places: { label: string; x: number; y: number }[];
  routes: { from: number; to: number }[];
  lit: number;
}
/** Real objects, people and places, drawn: in a row, two against each other,
 * one becoming the next, one going round another, at their real sizes, or one
 * thing drawn big with its parts named. */
export interface ThingsScene {
  family: "things";
  layout: (typeof THING_LAYOUTS)[number];
  items: { thing: ThingName; label: string; size: number; tone: Tone }[];
  /** The parts layout only: 2 to 4 named parts, each pointed at where it sits. Empty otherwise. */
  parts: { label: string; at: (typeof PART_SPOTS)[number] }[];
  lit: number;
}
/** Where one thing sits on several scales at once: 2 to 4 rows, one lit. */
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
  forces: { label: string; dir: (typeof FORCE_DIRS)[number]; size: number }[];
  result: string;
}
/** Terms joined by signs: a reaction, a formula, an identity. */
export interface EquationScene {
  family: "equation";
  terms: { label: string; note: string }[];
  signs: (typeof SIGNS)[number][];
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
/** How values are spread: dots piled into a shape, one part lit. */
export interface SpreadScene {
  family: "spread";
  x: string;
  shape: (typeof SPREAD_SHAPES)[number];
  lit: (typeof SPREAD_LITS)[number];
  label: string;
}
/** Do two things go together: a cloud of points and its trend. */
export interface ScatterScene {
  family: "scatter";
  x: string;
  y: string;
  trend: (typeof TRENDS)[number];
  strength: (typeof STRENGTHS)[number];
  lit: (typeof SCATTER_LITS)[number];
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
  shape: (typeof GEOMETRY_SHAPES)[number];
  labels: string[];
  lit: number;
}
/** Atoms and the bonds between them. */
export interface BondsScene {
  family: "bonds";
  shape: (typeof BOND_SHAPES)[number];
  atoms: string[];
  orders: number[];
  lit: number;
  name: string;
}
/** A small push far from the pivot lifts a big load near it. */
export interface LeverScene {
  family: "lever";
  load: string;
  effort: string;
  pivot: string;
  /** Where the pivot sits along the beam, 0.2 (by the load) to 0.6 (past the middle). */
  at: number;
}
/** Worked steps, one line at a time. */
export interface WorkingScene {
  family: "working";
  lines: { text: string; note: string }[];
  lit: number;
}
/** Who does what to whom, and where: people and things on one ground line, with what happens between them. */
export interface StageScene {
  family: "stage";
  /** A place drawn behind them at the right, or "". */
  place: string;
  placeLabel: string;
  /** A soft wash of colour behind the place: good, bad or "". */
  placeTone: Tone;
  actors: { thing: string; label: string; size: (typeof STAGE_SIZES)[number]; tone: Tone }[];
  /** to -1 is the place. says and thinks ignore to. */
  acts: { from: number; to: number; kind: (typeof STAGE_KINDS)[number]; label: string }[];
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
export type Scene =
  | StageScene
  | QuoteScene
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
  | WorkingScene;

export interface Play {
  prompt: string;
  low: string;
  high: string;
  /** What to say at the low end, the middle and the high end of the slider. */
  readouts: string[];
  changes: { target: string; does: (typeof CHANGES)[number] }[];
}

// ---- schema (works with OpenAI strict mode and Claude structured output) ----

const str = { type: "string" };
const int = { type: "integer" };
const num = { type: "number" };
const strs = { type: "array", items: str };
const en = (values: readonly string[]) => ({ type: "string", enum: [...values] });
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const arr = (items: unknown) => ({ type: "array", items });
const bool = { type: "boolean" };

export const SCENE_SCHEMA = {
  anyOf: [
    obj({
      family: en(["particles"]),
      zones: strs,
      divider: en(DIVIDERS),
      things: { type: "array", items: obj({ name: str, mark: en(MARKS), count: int, zone: int, to: int, motion: en(MOTIONS) }) },
    }),
    obj({
      family: en(["links"]),
      layout: en(LAYOUTS),
      nodes: strs,
      links: { type: "array", items: obj({ from: int, to: int, kind: en(LINK_KINDS) }) },
      feedback: en(FEEDBACKS),
    }),
    obj({
      family: en(["graph"]),
      x: str,
      y: str,
      curves: { type: "array", items: obj({ name: str, shape: en(SHAPES), label: str }) },
      highlight: en(HIGHLIGHTS),
    }),
    obj({ family: en(["balance"]), left: str, right: str, leftWeight: int, rightWeight: int, middle: str }),
    obj({ family: en(["compare"]), style: en(COMPARE_STYLES), items: { type: "array", items: obj({ label: str, value: num }) } }),
    obj({ family: en(["stairs"]), steps: strs, at: int }),
    obj({ family: en(["spectrum"]), left: str, right: str, min: num, max: num, marks: { type: "array", items: obj({ label: str, at: num }) }, at: num }),
    obj({ family: en(["venn"]), a: str, b: str, both: str, overlap: num }),
    obj({
      family: en(["pair"]),
      left: obj({ label: str, shape: en(PAIR_SHAPES), count: int, note: str, tone: en(TONES) }),
      right: obj({ label: str, shape: en(PAIR_SHAPES), count: int, note: str, tone: en(TONES) }),
      lit: en(["left", "right"]),
    }),
    obj({ family: en(["tree"]), root: str, branches: { type: "array", items: obj({ label: str, leaves: strs }) }, lit: obj({ branch: int, leaf: int }) }),
    obj({ family: en(["test"]), case: str, gates: strs, fails: int, outcome: str }),
    obj({ family: en(["threshold"]), level: str, line: str, at: num, value: num }),
    obj({ family: en(["units"]), lit: int, label: str, rest: str, thing: str, also: int, alsoLabel: str }),
    obj({ family: en(["crowd"]), x: str, y: str, count: int, crowd: en(CROWD_SHAPES), lit: str, litShape: en(STANDOUT_SHAPES) }),
    obj({ family: en(["grid"]), x: str, y: str, quadrants: strs, item: str, atX: num, atY: num }),
    obj({ family: en(["timeline"]), events: arr(obj({ label: str, when: str, t: num })), scale: en(TIMELINE_SCALES), at: int }),
    obj({ family: en(["layers"]), layers: strs, style: en(LAYER_STYLES), at: int, whole: str }),
    obj({ family: en(["wave"]), kind: en(WAVE_KINDS), what: str, wavelength: str, amplitude: str }),
    obj({ family: en(["mirror"]), leftTitle: str, rightTitle: str, pairs: arr(obj({ left: str, right: str })), lit: int }),
    obj({ family: en(["stack"]), label: str, items: strs, action: en(STACK_ACTIONS) }),
    obj({ family: en(["radial"]), centre: str, spokes: strs, lit: int, cycle: bool }),
    obj({ family: en(["cutaway"]), whole: str, parts: arr(obj({ label: str, share: num })), lit: int }),
    obj({ family: en(["funnel"]), stages: arr(obj({ label: str, value: num })), lit: int }),
    obj({ family: en(["sankey"]), source: str, splits: arr(obj({ label: str, share: num })), lit: int }),
    obj({ family: en(["fan"]), x: str, y: str, shape: en(CROWD_SHAPES), now: num, label: str }),
    obj({ family: en(["spiral"]), stages: strs, turns: int, label: str }),
    obj({ family: en(["zoom"]), levels: arr(obj({ label: str, size: str })), at: int }),
    obj({ family: en(["brace"]), items: strs, groups: arr(obj({ label: str, from: int, to: int })), lit: int }),
    obj({ family: en(["map"]), places: arr(obj({ label: str, x: num, y: num })), routes: arr(obj({ from: int, to: int })), lit: int }),
    obj({ family: en(["things"]), layout: en(THING_LAYOUTS), items: arr(obj({ thing: str, label: str, size: num, tone: en(TONES) })), parts: arr(obj({ label: str, at: en(PART_SPOTS) })), lit: int }),
    obj({ family: en(["spectra"]), item: str, rows: arr(obj({ left: str, right: str, at: num })), lit: int }),
    obj({ family: en(["pattern"]), items: strs, gap: int, answer: str, rule: str }),
    obj({ family: en(["machine"]), name: str, inputs: strs, outputs: strs, lit: int }),
    obj({ family: en(["case"]), claim: str, reasons: strs, objection: str, lit: int }),
    obj({ family: en(["forces"]), object: str, forces: arr(obj({ label: str, dir: en(FORCE_DIRS), size: int })), result: str }),
    obj({ family: en(["equation"]), terms: arr(obj({ label: str, note: str })), signs: arr(en(SIGNS)), lit: int }),
    obj({ family: en(["bridge"]), leftTitle: str, rightTitle: str, left: strs, right: strs, maps: arr(obj({ from: int, to: int })), lit: int }),
    obj({ family: en(["spread"]), x: str, shape: en(SPREAD_SHAPES), lit: en(SPREAD_LITS), label: str }),
    obj({ family: en(["scatter"]), x: str, y: str, trend: en(TRENDS), strength: en(STRENGTHS), lit: en(SCATTER_LITS), label: str }),
    obj({ family: en(["matrix"]), rowTitle: str, colTitle: str, rows: strs, cols: strs, cells: strs, litRow: int, litCol: int }),
    obj({ family: en(["geometry"]), shape: en(GEOMETRY_SHAPES), labels: strs, lit: int }),
    obj({ family: en(["bonds"]), shape: en(BOND_SHAPES), atoms: strs, orders: arr(int), lit: int, name: str }),
    obj({ family: en(["lever"]), load: str, effort: str, pivot: str, at: num }),
    obj({ family: en(["working"]), lines: arr(obj({ text: str, note: str })), lit: int }),
    obj({ family: en(["stage"]), place: str, placeLabel: str, placeTone: en(TONES), actors: arr(obj({ thing: str, label: str, size: en(STAGE_SIZES), tone: en(TONES) })), acts: arr(obj({ from: int, to: int, kind: en(STAGE_KINDS), label: str })), lit: int }),
    obj({ family: en(["quote"]), text: str, phrase: str, note: str, by: str }),
    { type: "null" },
  ],
} as const;

export const PLAY_SCHEMA = {
  anyOf: [
    obj({
      prompt: str,
      low: str,
      high: str,
      readouts: strs,
      changes: { type: "array", items: obj({ target: str, does: en(CHANGES) }) },
    }),
    { type: "null" },
  ],
} as const;

const THING_MENU = Object.entries(THING_GROUPS)
  .map(([g, names]) => `  ${g}: ${names.join(", ")}.`)
  .join("\n");

export const SCENE_PROMPT = `Each bite also gets a scene: one small live drawing that makes one point. You do not draw. You pick one device and fill in its slots, and the app draws it in Fenny's style (soft silver lines on near-black, one thing lit, built in a few beats). Use a scene for almost every bite. Use null only when no device fits, and then the picture field is used instead.

How to choose, in this order:
1. Find the question the idea answers (who or what, who did what to whom, how much, where, when, how, why). Who did what to whom, or what happens between people: stage. Which exact words: quote. Who or what: things (show the real object, person or place), geometry or bonds. How much: compare, spectrum, graph, units, cutaway, funnel, spread, scatter or things with layout scale. When: timeline, links line or stairs. Where: map, grid or layers. How: links, particles, wave, loop, machine, working, lever or things with layout chain or orbit. Why: graph, balance, forces or case. What kind: tree, venn, brace, pair, matrix or bridge. What comes next: pattern. What is it made of: equation or cutaway.
2. If the idea is "the difference between X and Y", use pair.
3. If no picture comes to mind, turn the key sentence into a chart: "A and B overlap" is a venn, "more X gives more Y" is a graph.
4. Check it before you answer. Clear at a glance? Builds left to right in the order it is spoken? Uses a real example the student knows? Simple but never wrong, so a lecturer could not mark it wrong? If any answer is no, simplify or use null.

Pick the device by the question the idea answers:
- How big compared with what? compare (style circles for size, bars for amounts).
- What steps, in what order? links with layout line.
- What choice or branching outcome? links with layout fork (node 0 is the start, the others are the outcomes).
- What goes round and round? links with layout loop (2 nodes on a loop makes a circuit).
- How are many things connected? links with layout web.
- What crosses a boundary, or moves around inside? particles.
- How does one thing change with another? graph.
- What levels are climbed in order? stairs.
- Where does it sit between two ends? spectrum.
- What do two things share? venn.
- Which of two sides wins? balance.
- What is the difference between two things? pair.
- What branches from what (kinds of, a family, a classification)? tree.
- Does it pass every condition (a legal test, diagnostic criteria)? test.
- Has it crossed a line (a standard of proof, a quota, a firing threshold)? threshold.
- How many out of how many (a risk, a probability, a proportion)? units.
- Which one stands out from many (one country, case or patient against the rest)? crowd.
- Where does it fall on two scales at once (a two by two, like urgent and important)? grid.
- When did things happen, and in what order over time? timeline.
- What is built on, or inside, what (a protocol stack, the Earth's layers, skin)? layers.
- Who does what to whom, and where (an event in history, a deal, a conflict, a social situation, a moment in a story or a case)? stage.
- Which exact words carry the meaning (a line from a text, a legal definition, a sentence in another language)? quote.
- What repeats as it travels (sound, light, a wave on a rope)? wave.
- What is the partner or opposite of this (a right and its duty, oxidation and reduction)? mirror.
- What goes on top, and what comes off first (last in, first out)? stack.
- What sits round one centre, or goes round in stages (a hub and spokes, a story circle)? radial.
- What is a whole made of, and in what shares (air, a budget, a genome)? cutaway.
- How many drop out at each stage (applicants to offers, visitors to buyers)? funnel.
- How does one flow split, by amount (energy in, useful energy out)? sankey.
- How uncertain is a forecast as it reaches further ahead? fan.
- What cycle builds on itself each time round (the spiral curriculum, compounding practice)? spiral.
- What does it look like at each scale, from big to small (body to cell to molecule)? zoom.
- Which items belong together in groups (ionising and non-ionising radiation)? brace.
- Where are places, and what moves between them (a trade route, a migration, a campaign)? map.
- What does it look like, who is involved, or what real object is it (the Earth and Moon, a cell, a bank and a factory)? things.
- What are its parts, and where are they (a labelled diagram, a metaphor with named parts)? things with layout parts.
- Where does one thing sit on several scales at once (a research method judged on depth, cost and reach)? spectra.
- What comes next, or what rule does a run follow (a number series, half-lives, a periodic trend, a chord progression)? pattern.
- What goes in, what is done to it, and what comes out (photosynthesis, an enzyme, a function, a court)? machine.
- What supports a claim, and what stands against it (an argument, a legal submission, an essay's thesis)? case.
- What pushes and pulls on one thing, and what do they add up to (a free body diagram, pressures on a price)? forces.
- What combines into what, or what is a formula made of (a chemical reaction, F = ma, profit = revenue - cost)? equation.
- What maps to what between two sets (a function, an analogy, codons to amino acids, words in two languages)? bridge.
- How are the values spread (a normal distribution, skewed incomes, an outlier, a tail)? spread.
- Do two things go together, and how tightly (a correlation)? scatter.
- What happens for every combination of two choices (a Punnett square, a payoff matrix, a truth table, true and false positives)? matrix.
- What are the parts of a plain shape (a right-angled triangle, a circle, a rectangle, an angle)? geometry.
- Which atoms are joined, and by what bonds (water, carbon dioxide, methane, benzene)? bonds.
- How does a small push move a big load (moments, mechanical advantage, gearing)? lever.
- What happens at each step of working something out (solving an equation, a proof, a calculation, tracing code)? working.

The devices:
particles: zones (1 to 3 area labels, left to right, "" for none), divider (none, wall, membrane = dashed and crossable, sieve = gaps), things (1 to 3 groups: name, mark dot = something that moves, ring = an object, blocked = something stopped, at most one group; count 1 to 16; zone it starts in; to = zone it heads to, same as zone if it stays; motion still, drift, jiggle like heat, cross from zone to "to", rise, fall, orbit, pulse, flow).
links: layout line, fork, loop or web. nodes 2 to 7 labels. links from and to node indexes, in the order they happen, kind cause (one light travels the cause links in the order listed, lighting each node it reaches, so list them in the order things happen), flow (stream of dots), tie (faint dashed bond, like an alliance). feedback: for a loop of 3 or more nodes that is a feedback loop, reinforcing (each time round makes it stronger, like a bank run) or balancing (it pulls back to a set level, like a thermostat or homeostasis); "" for everything else.
graph: x and y axis labels. curves 1 or 2: name, shape (rise, fall = straight lines, saturate = rises then levels off, decay = falls then levels off, bell, s_curve, grow = compounding, slow then steep, u_curve = high, low, then high again, cycle = up and down in waves, like a business cycle, steps = jumps between flat levels), label of 1 or 2 letters or a short word. highlight ride (a lit point travels the curve), crossing (where two curves meet), half (half height of a saturate curve, like Km), end (value at the right), none.
balance: left and right labels, leftWeight and rightWeight 0 to 6, middle = a short label under the pivot or "".
compare: style circles or bars. items 2 to 6 with a label and a positive value in real proportion (Earth 1, Sun 109). The biggest or most important item is lit.
stairs: steps 2 to 6 labels, bottom step first. at = index of the step that is lit.
spectrum: left and right end labels, min and max numbers, marks 0 to 4 reference points (label, at), at = where the lit marker sits.
venn: a and b labels, both = the label for the overlap, overlap 0 to 1.
pair: left and right, each with a label, a shape and count (2 to 8, only for split, join and many) and a short note or "". lit = the side the lesson points to. Shapes, each with one meaning: line = steady, linear growth; curve = compounding, exponential; jagged = noisy, short-term ups and downs; smooth = the long-run trend; split = one becomes several; join = several become one; scatter = random, unfocused; aligned = ordered, all one way; one = a single whole; many = lots of small parts; loop = repeats in a cycle; path = one way, start to end.
tree: root label, branches 2 to 4 (label, leaves 0 to 3 labels, at most 6 leaves in all), lit = the path the lesson is about: branch index and leaf index (leaf -1 for the branch itself). A light travels from the root down that path.
test: case = what is tested (1 to 3 words), gates = 2 to 5 conditions in the order they are applied (1 or 2 words each), fails = index of the first gate it fails, or -1 if it passes them all, outcome = what follows (1 to 3 words, like "No duty" or "Liable").
threshold: level = what builds up, line = the name of the line, at = where the line sits (0 bottom to 1 top), value = where the level ends (0 to 1). It crosses when value is above at.
units: lit = how many in 100 (a real figure from the notes or standard knowledge, rounded), label = what the lit ones are, rest = what the others are, each 1 to 4 words.
crowd: x and y axis labels, count 8 to 16 grey lines, crowd = their shape (rise, fall, flat), lit = the label of the one that stands out, litShape = its shape (rise, fall, flat, peak, dip).
grid: x and y axis names (the axis grows to the right and upwards), quadrants = 4 short labels in the order top left, top right, bottom left, bottom right ("" for none), item = what is placed, atX and atY = where it sits, 0 to 1.
timeline: events 2 to 6 in time order (label 1 to 3 words, when = a short date like "1914" or "65 Mya", t = a number for that time in one unit, years BC negative), scale even (equal gaps) or true (gaps in proportion to t, only when the gaps are the point), at = index of the lit event.
layers: layers 2 to 6, top or outermost first, style stack (each built on the one below) or nested (each inside the one before, drawn as half rings), at = index of the lit layer, whole = what they make up, or "".
wave: kind transverse (particles move up and down, like a rope or light) or longitudinal (particles move to and fro along the wave, like sound), what = what the particles are (1 to 3 words), wavelength and amplitude = their labels, or "" to leave one out.
mirror: leftTitle and rightTitle name the two sides, pairs 2 to 4 (left and right, partners on the same row), lit = the pair the lesson is about.
stack: label = what the stack is, items 2 to 6, bottom first, action push (the top item arrives last) or pop (the top item comes off).
radial: centre label, spokes 3 to 8 labels clockwise from the top, lit = index of the lit spoke, cycle true when the spokes are stages gone round in order (a light travels round the rim), false for a hub and its parts.
cutaway: whole = what is cut open, parts 2 to 6 (label and share, real percentages that add up to about 100), lit = index of the lit part.
funnel: stages 2 to 6, top first, each with a label and a real value that never rises down the funnel, lit = the stage the lesson is about (often the biggest drop).
sankey: source = what flows in, splits 2 to 5 (label and share, real percentages adding up to 100), lit = index of the lit split.
fan: x and y axis labels, shape = the trend (rise, fall, flat), now = where the record ends and the forecast begins (0.3 to 0.8), label = what the central forecast is.
spiral: stages 2 to 5 for one turn, turns 2 or 3, label = what grows each time round, or "".
zoom: levels 2 to 5, biggest first (label and size, like "Cell" and "10 µm", size "" if unknown), at = index of the lit level.
brace: items 3 to 7 in a row, groups 1 to 3 (label, from and to = the first and last item index in the group, groups never overlap), lit = index of the lit group.
map: places 2 to 6 (label, x = 0 west to 1 east, y = 0 south to 1 north, rough real positions, never invented), routes 0 to 6 (from and to place indexes, in the order they happen), lit = index of the lit place. It draws dots and routes only, never coastlines.
things: drawn objects, people and places from the list below, each with a label (1 to 3 words) and a size. layout row (1 to 5 things side by side: examples of a kind, or one big picture), versus (exactly 2, set against each other), chain (2 to 4, each becoming or causing the next, joined by arrows), orbit (2 or 3: item 1 goes round item 0, and item 2 goes round item 1, like the Sun, Earth and Moon), scale (2 to 4 drawn at their real relative sizes standing on one line; size = a real number in one unit, smallest first), parts (exactly 1 thing drawn big, with parts = 2 to 4 of its named parts, each with a label of 1 to 4 words and at = where that part sits on the drawing: top, bottom, left, right, top left, top right, bottom left, bottom right or centre, each spot once; only when they really are parts of that drawn thing, where the drawing shows them, never labels hung on a symbol like a bulb or a book). size is 1 for other layouts. parts is [] for every layout but parts. lit = index of the lit thing, or for parts the index of the lit part. Only use names from this list; if nothing in it is the thing, use another device:
${THING_MENU}
  People: choose the pose, pair or role that shows what the person is doing, feeling or is (person_thinking, people_trading, judge). Use plain person only when nothing is happening.
  The kit of parts: when no drawn person or building says it exactly, build one. Anywhere a thing goes you may write a kit name instead.
    A person is person:POSE:MOOD:WEARS:HOLDS. POSE is one of: ${KIT_POSES.join(", ")}. MOOD is one of: ${KIT_MOODS.join(", ")}. WEARS is one hat that says who they are: ${KIT_WEARS.join(", ")}. HOLDS is any one thing from the list above, drawn small in the hand (use pose holding). Leave a part empty to skip it and drop empty parts from the end: person:refusing:angry:crown is a furious king saying no, person:holding:happy::scroll is someone with a scroll, person:kneeling:sad is a beaten person, person:walking:worried:hood is a refugee on the road.
    A building is place:SHELL:SIGN. SHELL is one of: ${KIT_SHELLS.join(", ")} (block: a plain public building, house: a home or small school, hall: a grand building with columns, tower: a tall office, shop: a shop front). SIGN is any one thing from the list, drawn on the building to say what it is: place:hall:scales is a court, place:block:pill a pharmacy, place:shop:bread a bakery, place:tower:newspaper a newspaper office, place:block:shield a police station, place:hall:coin a central bank.
    Keep the same person through a lesson: if the worker is person:stand:neutral:cap in one bite, in the next they are person:refusing:angry:cap or person:cheering:laugh:cap, the same hat in a new pose and feeling, so the learner follows one character through the story.
  A metaphor (iceberg, dominoes, snowball, ladder, bridge and so on) only when the notes use that image or it is the standard teaching image for the idea, never as decoration.
units: also thing = a thing from the list to count with instead of dots (person for people, coin for money), or "". also and alsoLabel: a second group among the rest, drawn as rings (out of 100 people, 1 is ill and tests positive, lit, and 9 are well but test positive, also); 0 and "" when there is no second group.
spectra: item = what is placed (1 to 4 words), rows 2 to 4 scales (left and right end labels of 1 or 2 words, at = where the item sits, 0 left to 1 right), lit = index of the row that decides.
pattern: items 3 to 7 terms in order, 1 or 2 short words or a number each, with "?" where the gap is, gap = index of the gap, answer = what fills it, rule = the rule in 2 to 6 words ("Halves each half-life"). The answer and rule must be true.
machine: name = what does the work (1 to 3 words), inputs 1 to 3 and outputs 1 to 3 labels (1 to 3 words), lit = index of the output the lesson is about.
case: claim = the conclusion (2 to 5 words), reasons 1 to 3 that support it (1 to 3 words each; 2 at most with an objection), objection = one point against it or "", lit = index of the reason the lesson turns on, or -1 for the objection.
forces: object = what the forces act on, forces 2 to 4 (label, dir up, down, left or right, size 1 to 5 in real proportion), result = what happens (1 to 3 words: "Speeds up", "Steady speed", "Sinks"). The app adds them up and lights the resultant, or the object if they cancel.
equation: terms 2 to 5 in reading order (label = a symbol, formula or word up to 10 letters, like "2H₂", "F" or "Revenue"; note = its name in 1 or 2 words, or ""), signs = one fewer than terms, the sign between each pair (plus, minus, times, over, equals, gives = an arrow, both = a reaction that runs both ways), lit = index of the term the lesson is about. It must balance and be correct.
bridge: leftTitle and rightTitle name the two sets, left 2 to 4 and right 1 to 4 labels (1 or 2 words), maps 1 to 6 (from = left index, to = right index), lit = index of the map the lesson is about. Several on the left may map to one on the right.
spread: x = what is measured, shape (normal, skew_right = a long tail of high values, skew_left = a long tail of low values, uniform, bimodal = two humps), lit = the part the lesson is about (middle = the average, left_tail, right_tail, outlier = one case far from the rest, width = how spread out), label = its name in 1 to 5 words.
scatter: x and y axis labels, trend (up, down, none), strength (strong = points hug the line, weak = a loose cloud), lit line (the trend) or outlier (one point that does not fit), label = what the lit thing is in 1 to 4 words ("Strong positive", "No link").
matrix: rowTitle and colTitle name the two choices, rows 2 or 3 and cols 2 or 3 labels (1 or 2 short words), cells = every cell, row by row (rows times cols of them, 1 or 2 short words each), litRow and litCol = the cell the lesson is about.
geometry: shape and labels in a fixed order, "" to leave one out. right_triangle: base, upright, hypotenuse, the angle at the base. triangle: bottom, left side, right side. circle: radius, diameter, circumference. rectangle: width, height, area. angle: the angle, lower arm, upper arm. lit = index of the labelled part the lesson is about.
bonds: shape line (2 to 4 atoms in a row, like O=C=O), bent (exactly 3, the middle one first raised, like water: H, O, H), star (atom 0 in the centre and 2 to 5 round it, like methane), chain (3 to 6 in a zigzag, like a carbon chain) or ring (3 to 6 in a closed ring). atoms = element symbols in drawing order. orders = the bond between each pair in order, 1 single, 2 double, 3 triple (star: centre to each; ring: one more to close it). lit = index of the atom the lesson is about. name = the molecule's name. Only real molecules with their real bonds.
lever: load, effort and pivot = labels (1 or 2 words), at = where the pivot sits along the beam, 0.2 (close to the load, so the effort is small) to 0.5 (the middle, so the effort equals the load) to 0.6.
working: lines 2 to 5 in order (text = the line as written, up to 26 characters, like "2x + 3 = 11"; note = what was done to get it, 2 to 5 words, "" for the first), lit = index of the line the lesson is about. Every line must follow from the one before.
stage: people, things and a place standing on one ground line, with what happens between them. actors = 1 to 3 from the things list (thing, a label of 1 to 3 words, size small, normal or big: big for the powerful or the adult, small for the weak or the child, normal otherwise). place = one thing from the list for where it happens (a building or a landscape), or "", and placeLabel = its name or "". acts = 1 or 2 things that happen: from = an actor index, to = an actor index or -1 for the place, kind says (a speech bubble over from; label = the 1 to 3 words said), thinks (a thought bubble; label = the thought), gives or goes (an arrow from one to the other; label = what is given, or why they go), against (in conflict; label = what over) or with (allied; label = the tie). lit = index of the actor the lesson is about. Choose each person by what they do or who they are: a pose (person_running, person_refusing), a pair or group (people_arguing, march, queue) or a role (monarch, merchant, judge, soldier, farmer). Or build the exact person from the kit (person:pointing:angry:crown) and the exact building (place:hall:scales). People turn to face whoever they act on. Use stage when the idea is an event or a relationship between people, never for an abstract process.
quote: text = the exact words, up to 20 words (a line from the text studied, a statute or a definition, or a sentence in the language being learned). phrase = the 1 to 5 words inside it that the lesson turns on, copied exactly. note = what that phrase does or means, in 2 to 7 words. by = where it is from in 1 to 4 words ("Macbeth, Act 1"), or "". Only quote words you are sure are exact: from the notes, or a text you know word for word. If unsure of the wording, use another device.

tone (on each side of a pair, each item of things, each actor of a stage, and placeTone for a stage's place): colour for meaning, one soft wash behind that thing. "good" is green, "bad" is red, "" is none, and "" is right almost every time. Use a tone only when the idea itself sets something good against something bad (a healthy cell and a cancer cell, a fair deal and a scam), or when one thing in the picture is plainly a harm or a gain (the shop where prices rose, the buyer who gets the deal). Never to decorate, never for "important" (the light does that), never on both sides the same, never for a matter of opinion (a political side, a religion, a people), and at most two in a picture.

play: at most one bite per lesson (usually the first or second) gets a slider that changes its scene, so the student tries the idea with their own hands. Others get null.
  prompt: an instruction under 8 words, like "Add sugar to the right." low and high: 1 to 3 word slider end labels.
  readouts: exactly 3 short lines for the low end, the middle and the high end. Each says what they see and why, under 16 words.
  changes: 1 or 2. target names a thing, curve or compare item, "left" or "right" for balance, "" for links, stairs, spectrum and venn.
    particles: appear (fades in as the slider rises), cross (moves from zone to "to"), speed, grow.
    links: step (links appear one by one, like time passing), speed.
    graph: shift (curve moves right), stretch (levels off later, bell wider), ride (lit point moves along).
    balance: weigh (that side goes from nothing to 6).
    compare: grow (that item's value rises from small to its value), step (items appear one at a time).
    stairs: climb. spectrum: slide (marker moves from min to max). venn: overlap (from apart to mostly shared).
    pair: step (the right side builds in as the slider rises, so the difference appears).
    tree: step (the light walks down the lit path). test: step (the case moves through the gates). threshold: fill (the level rises from empty to full). units: grow (the lit dots count up to lit).
    grid: slide (the item moves from the opposite corner to its place). wave: speed (higher frequency), stretch (longer wavelength), grow (bigger amplitude). fan: grow (the forecast's spread widens).
    timeline, layers, mirror, stack, radial, cutaway, funnel, sankey, spiral, zoom, brace and map: step (the light moves through the parts in order).
    things: step (the light moves through the things in order, or through the parts), speed (for orbit: it goes round faster).
    spectra, machine, case, equation, bridge, matrix, bonds and working: step (the light moves through the parts in order). pattern: step (the answer lands in the gap).
    stage: step (the light moves through the actors in order). quote: no slider.
    forces: grow (the last force listed grows from nothing to its size, and the resultant changes with it). lever: slide (the pivot moves from the load end to the effort end). spread and scatter: grow (the sample grows from a few points to all of them).

caption: one short sentence under 9 words that states the point, ending with a full stop, like "Water follows the sugar."

What makes a good scene:
- One idea per picture. If you need two pictures, it belongs in two bites.
- Use real names from the notes or topic: "Serbia", never "A" or "State 1". "Sucrose", not "solute 2". Every group or item has a different name.
- Show what the idea needs and nothing else. A demand shift needs the supply curve too. Osmosis needs the solute as well as the water.
- A slider moves the cause so they can watch the effect. Never a slider that only makes things busier unless speed is the idea.
- Be honest. compare values must be real quantities in one unit (convert first: Neptune is 30 AU, Proxima Centauri is about 268,000 AU). Never invent numbers to compare two ideas.
- Labels name real things (Serbia, Supply, Sucrose), never placeholder steps like "One move", "Start" or "Allies react".
- Plan the pictures first: devices lists the device for each bite, in order, all different (or none). Then write each bite's scene with its planned device. Most ideas fit more than one device honestly, so the student sees something new every time.
- links is the device most often reached for and most often the wrong one. Use it only when the idea really is a chain of causes or a network, and at most once a lesson. Before links, check: levels climbed in order (stairs), dates (timeline), stages gone round (radial with cycle), how many out of how many (units), a tipping point (threshold), a range (spectrum), a real object or person (things).
- Never the same device twice in one lesson, pair and things included.
- Near neighbours. equation or machine: equation when the terms themselves combine, machine when one thing does the work. case or test: a case weighs reasons for a claim, a test runs one thing through fixed conditions. bridge or mirror: mirror for one to one partners, bridge when several map to one. spread or a bell graph: spread when it is about cases or people, graph for a law. scatter or graph: scatter for data and how tightly it follows, graph for the relationship itself. matrix or grid: a matrix says what happens in each cell, a grid places one item. spectra or spectrum: one scale is a spectrum. working or links: working for written lines of maths, logic or code. forces or balance: forces act on one object in directions, a balance weighs two sides.
- compare is for real quantities in one unit. Without real numbers, choose by the question the idea answers instead.
- If no device honestly fits, use null. A wrong picture is worse than none.

Examples (scene, then play):
Osmosis: {"family":"particles","zones":["Dilute","Concentrated"],"divider":"membrane","things":[{"name":"water","mark":"dot","count":14,"zone":0,"to":1,"motion":"drift"},{"name":"sugar","mark":"ring","count":8,"zone":1,"to":1,"motion":"still"}]} play {"prompt":"Add sugar to the right.","low":"No sugar","high":"Lots of sugar","readouts":["Same on both sides, so no overall movement.","More sugar on the right, so water starts moving right.","Lots of sugar on the right. Most of the water has crossed."],"changes":[{"target":"sugar","does":"appear"},{"target":"water","does":"cross"}]}
Demand rises: {"family":"graph","x":"Quantity","y":"Price","curves":[{"name":"supply","shape":"rise","label":"S"},{"name":"demand","shape":"fall","label":"D"}],"highlight":"crossing"} play {"prompt":"Raise demand.","low":"Old demand","high":"Demand up","readouts":["Demand meets supply at one price, the equilibrium.","Demand shifts right, so there is a shortage and price is bid up.","New equilibrium with a higher price and more sold."],"changes":[{"target":"demand","does":"shift"}]}
Alliances in 1914: {"family":"links","layout":"web","nodes":["Austria-Hungary","Serbia","Russia","Germany","France","Britain"],"links":[{"from":0,"to":1,"kind":"cause"},{"from":2,"to":1,"kind":"tie"},{"from":3,"to":2,"kind":"cause"},{"from":3,"to":4,"kind":"cause"},{"from":5,"to":3,"kind":"cause"}]} play {"prompt":"Step through summer 1914.","low":"28 June","high":"4 August","readouts":["Austria-Hungary declares war on Serbia.","Russia backs Serbia, so Germany declares war on Russia and France.","Britain joins. A local crisis is now a European war."],"changes":[{"target":"","does":"step"}]}
Size of the Sun: {"family":"compare","style":"circles","items":[{"label":"Earth","value":1},{"label":"Sun","value":109}]}
Maslow: {"family":"stairs","steps":["Body","Safety","Belonging","Esteem","Growth"],"at":0} play {"prompt":"Climb the needs.","low":"Basic","high":"Growth","readouts":["Food, water and sleep come first.","Belonging rests on feeling safe.","Growth only once the steps below hold."],"changes":[{"target":"","does":"climb"}]}
pH: {"family":"spectrum","left":"Acid","right":"Alkaline","min":0,"max":14,"marks":[{"label":"Lemon","at":2},{"label":"Water","at":7},{"label":"Bleach","at":13}],"at":7}
Probability of A and B: {"family":"venn","a":"Rain","b":"Wind","both":"Both","overlap":0.4}
Km: {"family":"graph","x":"Substrate","y":"Rate","curves":[{"name":"rate","shape":"saturate","label":""}],"highlight":"half"}
Civil burden of proof: {"family":"balance","left":"Defendant","right":"Claimant","leftWeight":3,"rightWeight":4,"middle":"51%"}
Mitosis and meiosis: {"family":"pair","left":{"label":"Mitosis","shape":"split","count":2,"note":"2 identical cells","tone":""},"right":{"label":"Meiosis","shape":"split","count":4,"note":"4 different cells","tone":""},"lit":"right"}
Kinds of animal: {"family":"tree","root":"Animals","branches":[{"label":"Vertebrates","leaves":["Mammals","Birds","Fish"]},{"label":"Invertebrates","leaves":["Insects","Molluscs"]}],"lit":{"branch":0,"leaf":0}}
Duty of care (Caparo): {"family":"test","case":"Claim","gates":["Foreseeable","Proximity","Fair"],"fails":2,"outcome":"No duty"}
Action potential: {"family":"threshold","level":"Voltage","line":"Threshold","at":0.6,"value":0.85}
Side effect risk: {"family":"units","lit":4,"label":"get a side effect","rest":"do not","thing":"person"}
Life expectancy in the 1990s: {"family":"crowd","x":"Year","y":"Life expectancy","count":12,"crowd":"rise","lit":"Russia","litShape":"dip"}
Eisenhower matrix: {"family":"grid","x":"Urgent","y":"Important","quadrants":["Schedule","Do now","Drop","Delegate"],"item":"Exam revision","atX":0.3,"atY":0.85}
Life on Earth: {"family":"timeline","events":[{"label":"First life","when":"3.8 bn","t":-3800},{"label":"First animals","when":"600 Mya","t":-600},{"label":"Dinosaurs die","when":"66 Mya","t":-66},{"label":"Humans","when":"0.3 Mya","t":-0.3}],"scale":"true","at":3}
Layers of the Earth: {"family":"layers","layers":["Crust","Mantle","Outer core","Inner core"],"style":"nested","at":2,"whole":"Earth"}
Sound: {"family":"wave","kind":"longitudinal","what":"Air particles","wavelength":"Wavelength","amplitude":""}
Hohfeld: {"family":"mirror","leftTitle":"I have","rightTitle":"You have","pairs":[{"left":"Right","right":"Duty"},{"left":"Privilege","right":"No-right"}],"lit":0}
Call stack: {"family":"stack","label":"Call stack","items":["main","sort","swap"],"action":"push"}
Composition of air: {"family":"cutaway","whole":"Air","parts":[{"label":"Nitrogen","share":78},{"label":"Oxygen","share":21},{"label":"Other","share":1}],"lit":1}
Power station: {"family":"sankey","source":"Fuel energy","splits":[{"label":"Electricity","share":35},{"label":"Heat lost","share":65}],"lit":0}
Levels of organisation: {"family":"zoom","levels":[{"label":"Body","size":"1.7 m"},{"label":"Heart","size":"12 cm"},{"label":"Muscle cell","size":"100 µm"}],"at":2}
Triangular trade: {"family":"map","places":[{"label":"Britain","x":0.55,"y":0.85},{"label":"West Africa","x":0.6,"y":0.4},{"label":"Caribbean","x":0.1,"y":0.5}],"routes":[{"from":0,"to":1},{"from":1,"to":2},{"from":2,"to":0}],"lit":1}
Earth and Moon: {"family":"things","layout":"orbit","items":[{"thing":"sun","label":"Sun","size":1,"tone":""},{"thing":"earth","label":"Earth","size":1,"tone":""},{"thing":"moon","label":"Moon","size":1,"tone":""}],"parts":[],"lit":2}
Growth from a seed: {"family":"things","layout":"chain","items":[{"thing":"seed","label":"Seed","size":1,"tone":""},{"thing":"sprout","label":"Seedling","size":1,"tone":""},{"thing":"tree","label":"Tree","size":1,"tone":""}],"parts":[],"lit":2}
Climbing Everest: {"family":"things","layout":"scale","items":[{"thing":"person","label":"Climber, 1.8 m","size":1.8,"tone":""},{"thing":"house","label":"House, 8 m","size":8,"tone":""},{"thing":"mountain","label":"Everest, 8,849 m","size":8849,"tone":""}],"parts":[],"lit":0}
Visible and hidden costs: {"family":"things","layout":"row","items":[{"thing":"iceberg","label":"Most costs are hidden","size":1,"tone":""}],"parts":[],"lit":0}
Viruses and bacteria: {"family":"things","layout":"versus","items":[{"thing":"virus","label":"Virus","size":1,"tone":""},{"thing":"bacterium","label":"Bacterium","size":1,"tone":""}],"parts":[],"lit":0}
A healthy cell and a cancer cell: {"family":"things","layout":"versus","items":[{"thing":"cell","label":"Healthy cell","size":1,"tone":"good"},{"thing":"cell","label":"Cancer cell","size":1,"tone":"bad"}],"parts":[],"lit":1}
The iceberg model of culture: {"family":"things","layout":"parts","items":[{"thing":"iceberg","label":"Culture","size":1,"tone":""}],"parts":[{"label":"Food and dress","at":"top"},{"label":"Values and beliefs","at":"bottom"}],"lit":1}
Interviews as a research method: {"family":"spectra","item":"Interviews","rows":[{"left":"Shallow","right":"Deep","at":0.9},{"left":"Cheap","right":"Costly","at":0.7},{"left":"Few people","right":"Many people","at":0.15}],"lit":0}
Radioactive decay: {"family":"pattern","items":["80","40","20","?","5"],"gap":3,"answer":"10","rule":"Halves each half-life"}
Photosynthesis: {"family":"machine","name":"Chloroplast","inputs":["Light","Water","Carbon dioxide"],"outputs":["Glucose","Oxygen"],"lit":0}
Duress in contract law: {"family":"case","claim":"The contract binds","reasons":["Offer accepted","Consideration given"],"objection":"Signed under duress","lit":-1}
Terminal velocity: {"family":"forces","object":"Skydiver","forces":[{"label":"Weight","dir":"down","size":4},{"label":"Air resistance","dir":"up","size":4}],"result":"Steady speed"} play {"prompt":"Let the air resistance build.","low":"Just jumped","high":"Terminal velocity","readouts":["Only weight acts, so the skydiver speeds up.","Air resistance grows with speed, so the net force shrinks.","The two forces cancel. Speed stays steady."],"changes":[{"target":"","does":"grow"}]}
Making water: {"family":"equation","terms":[{"label":"2H₂","note":"Hydrogen"},{"label":"O₂","note":"Oxygen"},{"label":"2H₂O","note":"Water"}],"signs":["plus","gives"],"lit":2}
Newton's second law: {"family":"equation","terms":[{"label":"F","note":"Force"},{"label":"m","note":"Mass"},{"label":"a","note":"Acceleration"}],"signs":["equals","times"],"lit":0}
The genetic code is redundant: {"family":"bridge","leftTitle":"Codon","rightTitle":"Amino acid","left":["AUG","GGU","GGC"],"right":["Methionine","Glycine"],"maps":[{"from":0,"to":0},{"from":1,"to":1},{"from":2,"to":1}],"lit":2}
Income distribution: {"family":"spread","x":"Household income","shape":"skew_right","lit":"right_tail","label":"A few very high incomes"}
Revision and marks: {"family":"scatter","x":"Hours revised","y":"Exam mark","trend":"up","strength":"weak","lit":"line","label":"Weak positive"}
A monohybrid cross: {"family":"matrix","rowTitle":"Mother","colTitle":"Father","rows":["B","b"],"cols":["B","b"],"cells":["BB","Bb","Bb","bb"],"litRow":1,"litCol":1}
Sine, cosine and tangent: {"family":"geometry","shape":"right_triangle","labels":["Adjacent","Opposite","Hypotenuse","θ"],"lit":2}
Why water is polar: {"family":"bonds","shape":"bent","atoms":["H","O","H"],"orders":[1,1],"lit":1,"name":"Water"}
Moments: {"family":"lever","load":"Load","effort":"Effort","pivot":"Pivot","at":0.25} play {"prompt":"Move the pivot.","low":"By the load","high":"Past the middle","readouts":["The pivot is close to the load, so a small push lifts it.","The pivot nears the middle, so the push must nearly match the load.","Past the middle, you must push harder than the load itself."],"changes":[{"target":"","does":"slide"}]}
Solving a linear equation: {"family":"working","lines":[{"text":"2x + 3 = 11","note":""},{"text":"2x = 8","note":"Take 3 from both sides"},{"text":"x = 4","note":"Divide both sides by 2"}],"lit":2}
The Peasants' Revolt, 1381: {"family":"stage","place":"palace","placeLabel":"London","placeTone":"","actors":[{"thing":"march","label":"Rebels","size":"normal","tone":""},{"thing":"monarch","label":"Richard II","size":"normal","tone":""}],"acts":[{"from":0,"to":1,"kind":"against","label":"The poll tax"}],"lit":0}
A strike over pay: {"family":"stage","place":"place:block:gear","placeLabel":"The factory","placeTone":"","actors":[{"thing":"person:refusing:angry:cap","label":"Workers","size":"normal","tone":""},{"thing":"person:holding:worried:tophat:banknote","label":"Owner","size":"normal","tone":""}],"acts":[{"from":0,"to":1,"kind":"against","label":"Pay"},{"from":0,"to":0,"kind":"says","label":"No work"}],"lit":0}
Macbeth's ambition: {"family":"quote","text":"I have no spur to prick the sides of my intent, but only vaulting ambition","phrase":"vaulting ambition","note":"Ambition alone drives him","by":"Macbeth, Act 1"}
Compound interest: {"family":"graph","x":"Years","y":"Savings","curves":[{"name":"savings","shape":"grow","label":""}],"highlight":"ride"}
A bank run: {"family":"links","layout":"loop","nodes":["Fear","Withdrawals","Low reserves"],"links":[{"from":0,"to":1,"kind":"cause"},{"from":1,"to":2,"kind":"cause"},{"from":2,"to":0,"kind":"cause"}],"feedback":"reinforcing"}
A positive test for a rare disease: {"family":"units","lit":1,"label":"ill, test positive","rest":"well, test negative","thing":"","also":9,"alsoLabel":"well, test positive"}
Weather and climate: {"family":"pair","left":{"label":"Weather","shape":"jagged","count":0,"note":"Day to day","tone":""},"right":{"label":"Climate","shape":"smooth","count":0,"note":"Over 30 years","tone":""},"lit":"right"}`;

// ---- checking ----

const clampInt = (n: unknown, lo: number, hi: number, d: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
};
/** The longest single word a label slot will keep whole. */
const LONGEST_WORD = 18;
const short = (s: unknown, words = 3, max = 22) => {
  // Whole words only, up to max characters, so a cut never leaves half a word.
  // One long word on its own ("Neurotransmitter") is kept whole and the app
  // sets it a little smaller; only something far too long to be a word is cut.
  const ws = String(s ?? "").trim().split(/\s+/).filter(Boolean).slice(0, words);
  const first = max >= 8 ? Math.max(max, LONGEST_WORD) : max;
  let out = ws.length ? ws[0].slice(0, first) : "";
  let cut = ws.length > 0 && ws[0].length > first;
  for (let i = 1; i < ws.length; i++) {
    if (out.length + 1 + ws[i].length > max) { cut = true; break; }
    out += " " + ws[i];
  }
  if (String(s ?? "").trim().split(/\s+/).filter(Boolean).length > ws.length) cut = true;
  // A cut that leaves a bracket open drops the bracketed part: "Before (per" is "Before".
  out = out.replace(/\s*\([^)]*$/, "").replace(/[\s,;:]+$/, "");
  // A cut never ends on a little joining word: "Add to cart" cut short is "Add", not "Add to".
  if (cut) while (/\s(to|of|the|a|an|and|or|for|in|on|at|by|with|from|into|as|is|are)$/i.test(out)) out = out.replace(/\s+\S+$/, "");
  return out;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);

const num01 = (x: unknown, d: number, lo = 0, hi = 1) => (Number.isFinite(Number(x)) ? Math.max(lo, Math.min(hi, Number(x))) : d);
const labels = (x: unknown, max: number, words = 3) => (Array.isArray(x) ? x : []).map((v) => short(v, words)).filter(Boolean).slice(0, max);
/** Shares as fractions adding to 1, or equal shares if they are missing. */
const shares = (xs: number[]) => {
  const ok = xs.every((v) => Number.isFinite(v) && v > 0);
  const total = ok ? xs.reduce((a, b) => a + b, 0) : 0;
  return xs.map((v) => (ok && total > 0 ? v / total : 1 / xs.length));
};

const ALLOWED: Record<Scene["family"], readonly Play["changes"][number]["does"][]> = {
  particles: ["appear", "cross", "speed", "grow"],
  links: ["step", "speed"],
  graph: ["shift", "stretch", "ride"],
  balance: ["weigh"],
  compare: ["grow", "step"],
  stairs: ["climb"],
  spectrum: ["slide"],
  venn: ["overlap"],
  pair: ["step"],
  tree: ["step"],
  test: ["step"],
  threshold: ["fill"],
  units: ["grow"],
  crowd: [],
  grid: ["slide"],
  timeline: ["step"],
  layers: ["step"],
  wave: ["speed", "stretch", "grow"],
  mirror: ["step"],
  stack: ["step"],
  radial: ["step"],
  cutaway: ["step"],
  funnel: ["step"],
  sankey: ["step"],
  fan: ["grow"],
  spiral: ["step"],
  zoom: ["step"],
  brace: ["step"],
  map: ["step"],
  things: ["step", "speed"],
  spectra: ["step"],
  pattern: ["step"],
  machine: ["step"],
  case: ["step"],
  forces: ["grow"],
  equation: ["step"],
  bridge: ["step"],
  spread: ["grow"],
  scatter: ["grow"],
  matrix: ["step"],
  geometry: [],
  bonds: ["step"],
  lever: ["slide"],
  working: ["step"],
  stage: ["step"],
  quote: [],
};
/** Families whose slider changes name a thing in the scene. All others use "". */
const NAMED_TARGETS: readonly string[] = ["particles", "graph", "balance", "compare"];

/** Trims a scene to what the app can draw well, or returns null if there is nothing usable. */
export function checkScene(s: unknown): Scene | null {
  if (!s || typeof s !== "object") return null;
  const r = s as Record<string, unknown>;
  try {
    if (r.family === "particles") {
      const zones = (Array.isArray(r.zones) ? r.zones : []).slice(0, 3).map((z) => short(z));
      if (!zones.length) zones.push("");
      const zi = (n: unknown) => clampInt(n, 0, zones.length - 1, 0);
      let things: Thing[] = (Array.isArray(r.things) ? r.things : []).slice(0, 3).map((t: Record<string, unknown>) => {
        const zone = zi(t.zone);
        return {
          name: String(t.name ?? "").trim().toLowerCase() || "things",
          mark: oneOf(t.mark, MARKS, "dot"),
          count: clampInt(t.count, 1, 16, 8),
          zone,
          to: t.to === undefined ? zone : zi(t.to),
          motion: oneOf(t.motion, MOTIONS, "drift"),
        };
      });
      // Names are how a slider finds a group, so they must be unique.
      const seen = new Set<string>();
      things = things.map((t, i) => {
        const name = seen.has(t.name) ? `${t.name} ${i + 1}` : t.name;
        seen.add(name);
        return { ...t, name };
      });
      // At most one blocked group, and no more than 36 marks in all.
      let coral = false;
      things = things.map((t) => {
        if (t.mark !== "blocked") return t;
        if (coral) return { ...t, mark: "ring" as const };
        coral = true;
        return { ...t, count: Math.min(t.count, 3) };
      });
      while (things.reduce((n, t) => n + t.count, 0) > 36) {
        const big = things.reduce((a, b) => (b.count > a.count ? b : a));
        big.count -= 1;
      }
      if (!things.length) return null;
      return { family: "particles", zones, divider: zones.length > 1 ? oneOf(r.divider, DIVIDERS, "membrane") : "none", things };
    }
    if (r.family === "links") {
      const nodes = (Array.isArray(r.nodes) ? r.nodes : []).slice(0, 7).map((n) => short(n, 2)).filter(Boolean);
      if (nodes.length < 2) return null;
      const ni = (n: unknown) => clampInt(n, 0, nodes.length - 1, 0);
      const links = (Array.isArray(r.links) ? r.links : [])
        .slice(0, 8)
        .map((l: Record<string, unknown>) => ({ from: ni(l.from), to: ni(l.to), kind: oneOf(l.kind, LINK_KINDS, "cause") }))
        .filter((l) => l.from !== l.to);
      if (!links.length) return null;
      const layout = oneOf(r.layout, LAYOUTS, "line");
      return { family: "links", layout, nodes, links, feedback: layout === "loop" && nodes.length > 2 ? oneOf(r.feedback, FEEDBACKS, "") : "" };
    }
    if (r.family === "graph") {
      const curves = (Array.isArray(r.curves) ? r.curves : []).slice(0, 2).map((c: Record<string, unknown>, i) => ({
        name: String(c.name ?? "").trim().toLowerCase() || `curve${i + 1}`,
        shape: oneOf(c.shape, SHAPES, "rise"),
        label: short(c.label, 2, 10),
      }));
      if (!curves.length) return null;
      let highlight = oneOf(r.highlight, HIGHLIGHTS, "ride");
      if (highlight === "crossing" && curves.length < 2) highlight = "ride";
      if (highlight === "half" && !curves.some((c) => c.shape === "saturate")) highlight = "ride";
      return { family: "graph", x: short(r.x), y: short(r.y), curves, highlight };
    }
    if (r.family === "balance") {
      return {
        family: "balance",
        left: short(r.left),
        right: short(r.right),
        leftWeight: clampInt(r.leftWeight, 0, 6, 3),
        rightWeight: clampInt(r.rightWeight, 0, 6, 3),
        middle: short(r.middle, 3, 8),
      };
    }
    if (r.family === "compare") {
      const items = (Array.isArray(r.items) ? r.items : [])
        .slice(0, 6)
        .map((it: Record<string, unknown>) => ({ label: short(it.label, 2), value: Math.abs(Number(it.value)) }))
        .filter((it) => it.label && Number.isFinite(it.value) && it.value > 0);
      if (items.length < 2) return null;
      return { family: "compare", style: oneOf(r.style, COMPARE_STYLES, "bars"), items };
    }
    if (r.family === "stairs") {
      const steps = (Array.isArray(r.steps) ? r.steps : []).slice(0, 6).map((x) => short(x, 2)).filter(Boolean);
      if (steps.length < 2) return null;
      return { family: "stairs", steps, at: clampInt(r.at, 0, steps.length - 1, 0) };
    }
    if (r.family === "spectrum") {
      let min = Number(r.min);
      let max = Number(r.max);
      if (!Number.isFinite(min)) min = 0;
      if (!Number.isFinite(max) || max <= min) max = min + 10;
      const inRange = (x: unknown) => Math.max(min, Math.min(max, Number.isFinite(Number(x)) ? Number(x) : (min + max) / 2));
      const marks = (Array.isArray(r.marks) ? r.marks : []).slice(0, 4).map((m: Record<string, unknown>) => ({ label: short(m.label, 2), at: inRange(m.at) })).filter((m) => m.label);
      return { family: "spectrum", left: short(r.left), right: short(r.right), min, max, marks, at: inRange(r.at) };
    }
    if (r.family === "pair") {
      const side = (x: unknown): PairSide | null => {
        if (!x || typeof x !== "object") return null;
        const o = x as Record<string, unknown>;
        const label = short(o.label);
        if (!label) return null;
        const shape = oneOf(o.shape, PAIR_SHAPES, "path");
        const counted = shape === "split" || shape === "join" || shape === "many";
        return { label, shape, count: counted ? clampInt(o.count, 2, 8, shape === "many" ? 8 : 2) : 0, note: short(o.note, 4, 26), tone: oneOf(o.tone, TONES, "") };
      };
      const left = side(r.left);
      const right = side(r.right);
      if (!left || !right) return null;
      // Two sides washed the same colour say nothing: colour is for good against bad.
      if (left.tone && left.tone === right.tone) left.tone = right.tone = "";
      return { family: "pair", left, right, lit: r.lit === "left" ? "left" : "right" };
    }
    if (r.family === "tree") {
      let room = 6;
      const branches = (Array.isArray(r.branches) ? r.branches : [])
        .slice(0, 4)
        .map((b: Record<string, unknown>) => {
          const leaves = (Array.isArray(b.leaves) ? b.leaves : []).map((x) => short(x, 2)).filter(Boolean).slice(0, Math.min(3, room));
          room -= leaves.length;
          return { label: short(b.label, 2), leaves };
        })
        .filter((b) => b.label);
      if (branches.length < 2) return null;
      const lit = (r.lit ?? {}) as Record<string, unknown>;
      const branch = clampInt(lit.branch, 0, branches.length - 1, 0);
      const leaves = branches[branch].leaves.length;
      const leaf = leaves ? clampInt(lit.leaf, -1, leaves - 1, 0) : -1;
      return { family: "tree", root: short(r.root, 2) || "All", branches, lit: { branch, leaf } };
    }
    if (r.family === "test") {
      const gates = (Array.isArray(r.gates) ? r.gates : []).slice(0, 5).map((g) => short(g, 2)).filter(Boolean);
      if (gates.length < 2) return null;
      return { family: "test", case: short(r.case) || "Case", gates, fails: clampInt(r.fails, -1, gates.length - 1, -1), outcome: short(r.outcome) };
    }
    if (r.family === "threshold") {
      const unit = (x: unknown, d: number) => (Number.isFinite(Number(x)) ? Math.max(0.05, Math.min(0.95, Number(x))) : d);
      return { family: "threshold", level: short(r.level), line: short(r.line, 4, 26), at: unit(r.at, 0.6), value: unit(r.value, 0.8) };
    }
    if (r.family === "units") {
      const label = short(r.label, 4, 26);
      if (!label) return null;
      const lit = clampInt(r.lit, 1, 99, 10);
      const alsoLabel = short(r.alsoLabel, 4, 26);
      const also = alsoLabel ? clampInt(r.also, 0, 99 - lit, 0) : 0;
      return { family: "units", lit, label, rest: short(r.rest, 4, 26), thing: asThing(r.thing), also, alsoLabel: also ? alsoLabel : "" };
    }
    if (r.family === "crowd") {
      const lit = short(r.lit, 2);
      if (!lit) return null;
      return {
        family: "crowd",
        x: short(r.x),
        y: short(r.y),
        count: clampInt(r.count, 6, 16, 12),
        crowd: oneOf(r.crowd, CROWD_SHAPES, "rise"),
        lit,
        litShape: oneOf(r.litShape, STANDOUT_SHAPES, "peak"),
      };
    }
    if (r.family === "grid") {
      const q = (Array.isArray(r.quadrants) ? r.quadrants : []).slice(0, 4).map((v) => short(v, 2));
      while (q.length < 4) q.push("");
      const item = short(r.item, 3);
      if (!item) return null;
      return { family: "grid", x: short(r.x, 2), y: short(r.y, 2), quadrants: q, item, atX: num01(r.atX, 0.7, 0.06, 0.94), atY: num01(r.atY, 0.7, 0.06, 0.94) };
    }
    if (r.family === "timeline") {
      const events = (Array.isArray(r.events) ? r.events : [])
        .slice(0, 6)
        .map((e: Record<string, unknown>) => ({ label: short(e.label, 3, 18), when: short(e.when, 2, 12), t: Number(e.t) }))
        .filter((e) => e.label);
      if (events.length < 2) return null;
      // True spacing needs times in order with real gaps; otherwise space them evenly.
      const ordered = events.every((e, i) => Number.isFinite(e.t) && (i === 0 || e.t > events[i - 1].t));
      const scale = r.scale === "true" && ordered ? "true" : "even";
      return { family: "timeline", events: events.map((e, i) => ({ ...e, t: Number.isFinite(e.t) ? e.t : i })), scale, at: clampInt(r.at, 0, events.length - 1, events.length - 1) };
    }
    if (r.family === "layers") {
      const layers = labels(r.layers, 6);
      if (layers.length < 2) return null;
      return { family: "layers", layers, style: oneOf(r.style, LAYER_STYLES, "stack"), at: clampInt(r.at, 0, layers.length - 1, 0), whole: short(r.whole, 3) };
    }
    if (r.family === "wave") {
      return { family: "wave", kind: oneOf(r.kind, WAVE_KINDS, "transverse"), what: short(r.what, 3), wavelength: short(r.wavelength, 2), amplitude: short(r.amplitude, 2) };
    }
    if (r.family === "mirror") {
      const pairs = (Array.isArray(r.pairs) ? r.pairs : [])
        .slice(0, 4)
        .map((x: Record<string, unknown>) => ({ left: short(x.left, 2, 16), right: short(x.right, 2, 16) }))
        .filter((x) => x.left && x.right);
      if (pairs.length < 2) return null;
      return { family: "mirror", leftTitle: short(r.leftTitle, 3), rightTitle: short(r.rightTitle, 3), pairs, lit: clampInt(r.lit, 0, pairs.length - 1, 0) };
    }
    if (r.family === "stack") {
      const items = labels(r.items, 6);
      if (items.length < 2) return null;
      return { family: "stack", label: short(r.label, 3), items, action: oneOf(r.action, STACK_ACTIONS, "push") };
    }
    if (r.family === "radial") {
      const spokes = labels(r.spokes, 8, 2);
      if (spokes.length < 3) return null;
      return { family: "radial", centre: short(r.centre, 2, 12), spokes, lit: clampInt(r.lit, 0, spokes.length - 1, 0), cycle: r.cycle === true };
    }
    if (r.family === "cutaway" || r.family === "sankey") {
      const list = (Array.isArray(r.family === "cutaway" ? r.parts : r.splits) ? ((r.family === "cutaway" ? r.parts : r.splits) as Record<string, unknown>[]) : [])
        .slice(0, r.family === "cutaway" ? 6 : 5)
        .map((x) => ({ label: short(x.label, 2), share: Number(x.share) }))
        .filter((x) => x.label);
      if (list.length < 2) return null;
      const fr = shares(list.map((x) => x.share));
      const parts = list.map((x, i) => ({ label: x.label, share: Math.round(fr[i] * 1000) / 10 }));
      const lit = clampInt(r.lit, 0, parts.length - 1, 0);
      return r.family === "cutaway"
        ? { family: "cutaway", whole: short(r.whole, 2), parts, lit }
        : { family: "sankey", source: short(r.source, 3), splits: parts, lit };
    }
    if (r.family === "funnel") {
      const stages = (Array.isArray(r.stages) ? r.stages : [])
        .slice(0, 6)
        .map((x: Record<string, unknown>) => ({ label: short(x.label, 3, 18), value: Math.abs(Number(x.value)) }))
        .filter((x) => x.label && Number.isFinite(x.value) && x.value > 0);
      if (stages.length < 2) return null;
      // A funnel only narrows.
      for (let i = 1; i < stages.length; i++) if (stages[i].value > stages[i - 1].value) return null;
      return { family: "funnel", stages, lit: clampInt(r.lit, 0, stages.length - 1, stages.length - 1) };
    }
    if (r.family === "fan") {
      return { family: "fan", x: short(r.x), y: short(r.y), shape: oneOf(r.shape, CROWD_SHAPES, "rise"), now: num01(r.now, 0.55, 0.3, 0.8), label: short(r.label, 2) };
    }
    if (r.family === "spiral") {
      const stages = labels(r.stages, 5, 2);
      if (stages.length < 2) return null;
      return { family: "spiral", stages, turns: clampInt(r.turns, 2, 3, 2), label: short(r.label, 5, 32) };
    }
    if (r.family === "zoom") {
      const levels = (Array.isArray(r.levels) ? r.levels : [])
        .slice(0, 5)
        .map((x: Record<string, unknown>) => ({ label: short(x.label, 2, 18), size: short(x.size, 2, 12) }))
        .filter((x) => x.label);
      if (levels.length < 2) return null;
      return { family: "zoom", levels, at: clampInt(r.at, 0, levels.length - 1, levels.length - 1) };
    }
    if (r.family === "brace") {
      const items = labels(r.items, 7, 2);
      if (items.length < 3) return null;
      const ii = (n: unknown, d: number) => clampInt(n, 0, items.length - 1, d);
      const groups: { label: string; from: number; to: number }[] = [];
      for (const g of (Array.isArray(r.groups) ? r.groups : []).slice(0, 3) as Record<string, unknown>[]) {
        const label = short(g.label, 3);
        let from = ii(g.from, 0);
        let to = ii(g.to, from);
        if (to < from) [from, to] = [to, from];
        // Groups never overlap: drop one that does.
        if (!label || groups.some((h) => from <= h.to && to >= h.from)) continue;
        groups.push({ label, from, to });
      }
      if (!groups.length) return null;
      groups.sort((a, b) => a.from - b.from);
      return { family: "brace", items, groups, lit: clampInt(r.lit, 0, groups.length - 1, 0) };
    }
    if (r.family === "map") {
      const places = (Array.isArray(r.places) ? r.places : [])
        .slice(0, 6)
        .map((x: Record<string, unknown>) => ({ label: short(x.label, 2), x: num01(x.x, 0.5), y: num01(x.y, 0.5) }))
        .filter((x) => x.label);
      if (places.length < 2) return null;
      const pi = (n: unknown) => clampInt(n, 0, places.length - 1, 0);
      const routes = (Array.isArray(r.routes) ? r.routes : [])
        .slice(0, 6)
        .map((x: Record<string, unknown>) => ({ from: pi(x.from), to: pi(x.to) }))
        .filter((x) => x.from !== x.to);
      return { family: "map", places, routes, lit: clampInt(r.lit, 0, places.length - 1, 0) };
    }
    if (r.family === "things") {
      const layout = oneOf(r.layout, THING_LAYOUTS, "row");
      const max = { row: 5, versus: 2, chain: 4, orbit: 3, scale: 4, parts: 1 }[layout];
      let items = (Array.isArray(r.items) ? r.items : [])
        .filter((t: Record<string, unknown>) => t && asThing(t.thing))
        .slice(0, max)
        .map((t: Record<string, unknown>) => ({ thing: asThing(t.thing), label: short(t.label, layout === "row" || layout === "scale" ? 4 : 3, 26), size: Number(t.size) > 0 ? Number(t.size) : 1, tone: oneOf(t.tone, TONES, "") }));
      // Colour is for good against bad: no wash on a lone thing, in an orbit or on a labelled diagram,
      // never the same colour on everything, and at most two in a picture.
      const toned = items.filter((t) => t.tone);
      if (items.length < 2 || layout === "orbit" || layout === "parts" || toned.length > 2 || (toned.length === items.length && toned.every((t) => t.tone === toned[0].tone)))
        items = items.map((t) => ({ ...t, tone: "" as Tone }));
      const min = layout === "row" || layout === "parts" ? 1 : 2;
      if (items.length < min) return null;
      if (layout === "scale") {
        // Smallest first, and only real sizes: drop a scale whose sizes are all the same.
        items = items.sort((a, b) => a.size - b.size);
        if (items[items.length - 1].size <= items[0].size) return null;
      } else items = items.map((t) => ({ ...t, size: 1 }));
      if (layout === "parts") {
        // One thing, drawn big, with 2 to 4 of its parts named. Each spot is used once.
        const seen = new Set<string>();
        const parts = (Array.isArray(r.parts) ? r.parts : [])
          .map((x: Record<string, unknown>) => ({ label: short(x?.label, 4, 26), at: oneOf(x?.at, PART_SPOTS, "centre") }))
          .filter((x) => x.label && !seen.has(x.at) && seen.add(x.at))
          .slice(0, 4);
        if (parts.length < 2) return { family: "things", layout: "row", items, parts: [], lit: 0 };
        return { family: "things", layout, items, parts, lit: clampInt(r.lit, 0, parts.length - 1, 0) };
      }
      return { family: "things", layout, items, parts: [], lit: clampInt(r.lit, 0, items.length - 1, items.length - 1) };
    }
    if (r.family === "spectra") {
      const rows = (Array.isArray(r.rows) ? r.rows : [])
        .slice(0, 4)
        .map((x: Record<string, unknown>) => ({ left: short(x?.left, 2, 14), right: short(x?.right, 2, 14), at: num01(x?.at, 0.5, 0.04, 0.96) }))
        .filter((x) => x.left && x.right);
      if (rows.length < 2) return null;
      return { family: "spectra", item: short(r.item, 4, 28), rows, lit: clampInt(r.lit, 0, rows.length - 1, 0) };
    }
    if (r.family === "pattern") {
      const items = (Array.isArray(r.items) ? r.items : []).slice(0, 7).map((v) => short(v, 2, 8) || "?");
      const answer = short(r.answer, 2, 8);
      if (items.length < 3 || !answer) return null;
      // The gap is where the writer put the question mark, if it put one.
      const marked = items.indexOf("?");
      const gap = marked >= 0 ? marked : clampInt(r.gap, 0, items.length - 1, items.length - 1);
      return { family: "pattern", items: items.map((v, i) => (i === gap ? "?" : v)), gap, answer, rule: short(r.rule, 6, 34) };
    }
    if (r.family === "machine") {
      const name = short(r.name, 3, 16);
      const inputs = labels(r.inputs, 3);
      const outputs = labels(r.outputs, 3);
      if (!name || !inputs.length || !outputs.length) return null;
      return { family: "machine", name, inputs, outputs, lit: clampInt(r.lit, 0, outputs.length - 1, 0) };
    }
    if (r.family === "case") {
      const claim = short(r.claim, 5, 34);
      const objection = short(r.objection, 3, 20);
      const reasons = (Array.isArray(r.reasons) ? r.reasons : []).map((v) => short(v, 3, 20)).filter(Boolean).slice(0, objection ? 2 : 3);
      if (!claim || !reasons.length || reasons.length + (objection ? 1 : 0) < 2) return null;
      return { family: "case", claim, reasons, objection, lit: clampInt(r.lit, objection ? -1 : 0, reasons.length - 1, 0) };
    }
    if (r.family === "forces") {
      const forces = (Array.isArray(r.forces) ? r.forces : [])
        .filter((x: Record<string, unknown>) => x && (FORCE_DIRS as readonly string[]).includes(x.dir as string))
        .slice(0, 4)
        .map((x: Record<string, unknown>) => ({ label: short(x.label, 2, 16), dir: x.dir as (typeof FORCE_DIRS)[number], size: clampInt(x.size, 1, 5, 3) }))
        .filter((x) => x.label);
      if (forces.length < 2) return null;
      return { family: "forces", object: short(r.object, 2, 14), forces, result: short(r.result, 3, 22) };
    }
    if (r.family === "equation") {
      const terms = (Array.isArray(r.terms) ? r.terms : [])
        .slice(0, 5)
        .map((x: Record<string, unknown>) => ({ label: short(x?.label, 2, 14), note: short(x?.note, 2, 14) }))
        .filter((x) => x.label);
      if (terms.length < 2) return null;
      const raw = Array.isArray(r.signs) ? r.signs : [];
      const signs = terms.slice(1).map((_, i) => oneOf(raw[i], SIGNS, i === terms.length - 2 ? "equals" : "plus"));
      return { family: "equation", terms, signs, lit: clampInt(r.lit, 0, terms.length - 1, terms.length - 1) };
    }
    if (r.family === "bridge") {
      const left = (Array.isArray(r.left) ? r.left : []).map((v) => short(v, 2, 14)).filter(Boolean).slice(0, 4);
      const right = (Array.isArray(r.right) ? r.right : []).map((v) => short(v, 2, 14)).filter(Boolean).slice(0, 4);
      if (left.length < 2 || !right.length) return null;
      const seen = new Set<string>();
      const maps = (Array.isArray(r.maps) ? r.maps : [])
        .map((x: Record<string, unknown>) => ({ from: Math.round(Number(x?.from)), to: Math.round(Number(x?.to)) }))
        .filter((x) => x.from >= 0 && x.from < left.length && x.to >= 0 && x.to < right.length && !seen.has(`${x.from}>${x.to}`) && seen.add(`${x.from}>${x.to}`))
        .slice(0, 6);
      if (!maps.length) return null;
      return { family: "bridge", leftTitle: short(r.leftTitle, 2, 14), rightTitle: short(r.rightTitle, 2, 14), left, right, maps, lit: clampInt(r.lit, 0, maps.length - 1, 0) };
    }
    if (r.family === "spread") {
      const lit = oneOf(r.lit, SPREAD_LITS, "middle");
      const fallback = { middle: "Average", left_tail: "Lowest few", right_tail: "Highest few", outlier: "Outlier", width: "Spread" }[lit];
      return { family: "spread", x: short(r.x, 3), shape: oneOf(r.shape, SPREAD_SHAPES, "normal"), lit, label: short(r.label, 5, 30) || fallback };
    }
    if (r.family === "scatter") {
      const trend = oneOf(r.trend, TRENDS, "up");
      // No trend has no line to stray from, so nothing can be an outlier.
      const lit = trend === "none" ? "line" : oneOf(r.lit, SCATTER_LITS, "line");
      return { family: "scatter", x: short(r.x), y: short(r.y), trend, strength: trend === "none" ? "weak" : oneOf(r.strength, STRENGTHS, "strong"), lit, label: short(r.label, 4, 24) || (trend === "none" ? "No link" : lit === "outlier" ? "Outlier" : "Trend") };
    }
    if (r.family === "matrix") {
      const rows = (Array.isArray(r.rows) ? r.rows : []).map((v) => short(v, 2, 14)).filter(Boolean).slice(0, 3);
      const cols = (Array.isArray(r.cols) ? r.cols : []).map((v) => short(v, 2, 12)).filter(Boolean).slice(0, 3);
      if (rows.length < 2 || cols.length < 2) return null;
      const cells = (Array.isArray(r.cells) ? r.cells : []).slice(0, rows.length * cols.length).map((v) => short(v, 3, 16));
      // A table with holes says less than no table.
      if (cells.length < rows.length * cols.length || cells.some((v) => !v)) return null;
      return { family: "matrix", rowTitle: short(r.rowTitle, 2, 16), colTitle: short(r.colTitle, 2, 16), rows, cols, cells, litRow: clampInt(r.litRow, 0, rows.length - 1, 0), litCol: clampInt(r.litCol, 0, cols.length - 1, 0) };
    }
    if (r.family === "geometry") {
      const shape = oneOf(r.shape, GEOMETRY_SHAPES, "right_triangle");
      const max = shape === "right_triangle" ? 4 : 3;
      const list = (Array.isArray(r.labels) ? r.labels : []).slice(0, max).map((v) => short(v, 2, 14));
      while (list.length < max) list.push("");
      const named = list.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
      if (!named.length) return null;
      const lit = clampInt(r.lit, 0, max - 1, named[0]);
      return { family: "geometry", shape, labels: list, lit: list[lit] ? lit : named[0] };
    }
    if (r.family === "bonds") {
      const atoms = (Array.isArray(r.atoms) ? r.atoms : []).map((v) => short(v, 1, 3)).filter(Boolean).slice(0, 6);
      if (atoms.length < 2) return null;
      let shape = oneOf(r.shape, BOND_SHAPES, "line");
      // Each shape only holds so many atoms; anything else is drawn as a row or a zigzag.
      if (shape === "bent" && atoms.length !== 3) shape = "line";
      if ((shape === "star" || shape === "chain" || shape === "ring") && atoms.length < 3) shape = "line";
      if (shape === "line" && atoms.length > 4) shape = "chain";
      const count = shape === "ring" ? atoms.length : atoms.length - 1;
      const raw = Array.isArray(r.orders) ? r.orders : [];
      const orders = Array.from({ length: count }, (_, i) => clampInt(raw[i], 1, 3, 1));
      return { family: "bonds", shape, atoms, orders, lit: clampInt(r.lit, 0, atoms.length - 1, 0), name: short(r.name, 3, 24) };
    }
    if (r.family === "lever") {
      return { family: "lever", load: short(r.load, 2, 14) || "Load", effort: short(r.effort, 2, 14) || "Effort", pivot: short(r.pivot, 2, 14) || "Pivot", at: num01(r.at, 0.3, 0.2, 0.6) };
    }
    if (r.family === "stage") {
      const actors = (Array.isArray(r.actors) ? r.actors : [])
        .filter((t: Record<string, unknown>) => t && asThing(t.thing))
        .slice(0, 3)
        .map((t: Record<string, unknown>) => ({ thing: asThing(t.thing), label: short(t.label, 3, 22), size: oneOf(t.size, STAGE_SIZES, "normal"), tone: oneOf(t.tone, TONES, "") }));
      if (!actors.length) return null;
      const place = asThing(r.place);
      const n = actors.length;
      const bubble = (k: string) => k === "says" || k === "thinks";
      const spoke = new Set<number>();
      const acts = (Array.isArray(r.acts) ? r.acts : [])
        .map((x: Record<string, unknown>) => ({ from: clampInt(x?.from, 0, n - 1, 0), to: Number(x?.to) < 0 ? -1 : clampInt(x?.to, 0, n - 1, 0), kind: oneOf(x?.kind, STAGE_KINDS, "says"), label: short(x?.label, 3, 20) }))
        // A bubble needs words; an arrow needs two different ends, and the place only if there is one.
        .filter((a) => (bubble(a.kind) ? !!a.label : a.to !== a.from && (a.to >= 0 || !!place)))
        // One bubble per actor.
        .filter((a) => (bubble(a.kind) ? !spoke.has(a.from) && !!spoke.add(a.from) : true))
        .slice(0, 2);
      // Something has to happen: one actor alone with nothing said is a things row, not a stage.
      if (n + (place ? 1 : 0) < 2 && !acts.length) return null;
      // At most two washes in a picture; more than that and colour stops meaning anything.
      let placeTone: Tone = place ? oneOf(r.placeTone, TONES, "") : "";
      if (actors.filter((t) => t.tone).length + (placeTone ? 1 : 0) > 2) {
        placeTone = "";
        for (const t of actors) t.tone = "";
      }
      return { family: "stage", place, placeLabel: place ? short(r.placeLabel, 3, 22) : "", placeTone, actors, acts, lit: clampInt(r.lit, 0, n - 1, 0) };
    }
    if (r.family === "quote") {
      const tidy = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().replace(/^["“”']+|["“”']+$/g, "");
      const text = tidy(r.text);
      const phrase = tidy(r.phrase);
      const words = text.split(" ");
      if (!text || text.length > 124 || words.length > 22) return null;
      const bare = (t: string) => t.toLowerCase().replace(/[.,;:!?"'“”‘’()[\]…]/g, "");
      const tw = words.map(bare);
      const pw = phrase.split(" ").map(bare).filter(Boolean);
      // The lit phrase must be whole words of the passage, in order. No phrase, no picture.
      let found = false;
      for (let i = 0; i + pw.length <= tw.length && !found; i++) found = pw.every((w, j) => tw[i + j] === w);
      if (!pw.length || pw.length > 6 || !found) return null;
      return { family: "quote", text, phrase: phrase.split(" ").filter((w) => bare(w)).join(" "), note: short(r.note, 7, 46), by: short(r.by, 5, 30) };
    }
    if (r.family === "working") {
      const lines = (Array.isArray(r.lines) ? r.lines : [])
        .slice(0, 5)
        .map((x: Record<string, unknown>) => ({ text: short(x?.text, 12, 26), note: short(x?.note, 5, 26) }))
        .filter((x) => x.text);
      if (lines.length < 2) return null;
      return { family: "working", lines, lit: clampInt(r.lit, 0, lines.length - 1, lines.length - 1) };
    }
    if (r.family === "venn") {
      const a = short(r.a);
      const b = short(r.b);
      if (!a || !b) return null;
      const o = Number(r.overlap);
      return { family: "venn", a, b, both: short(r.both), overlap: Number.isFinite(o) ? Math.max(0, Math.min(1, o)) : 0.4 };
    }
  } catch {
    return null;
  }
  return null;
}

/** Keeps a play slider only if every change points at something in its scene. */
export function checkPlay(p: unknown, scene: Scene | null): Play | null {
  if (!p || typeof p !== "object" || !scene) return null;
  const r = p as Record<string, unknown>;
  const names =
    scene.family === "particles" ? scene.things.map((t) => t.name) : scene.family === "graph" ? scene.curves.map((c) => c.name) : scene.family === "balance" ? ["left", "right"] : scene.family === "compare" ? [...scene.items.map((it) => it.label.toLowerCase()), ""] : [""];
  const changes = (Array.isArray(r.changes) ? r.changes : [])
    .slice(0, 2)
    .map((c: Record<string, unknown>) => ({ target: String(c.target ?? "").trim().toLowerCase(), does: c.does as Play["changes"][number]["does"] }))
    .filter((c) => ALLOWED[scene.family].includes(c.does))
    .map((c) => (!NAMED_TARGETS.includes(scene.family) || (scene.family === "compare" && c.does === "step") ? { ...c, target: "" } : c))
    .filter((c) => names.includes(c.target));
  const readouts = (Array.isArray(r.readouts) ? r.readouts : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
  if (!changes.length || readouts.length < 2) return null;
  while (readouts.length < 3) readouts.splice(1, 0, readouts[0]);
  return { prompt: String(r.prompt ?? "").trim() || "Move the slider.", low: short(r.low) || "Less", high: short(r.high) || "More", readouts, changes };
}

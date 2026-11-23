// The drawing code runs on the phone's UI thread as worklets. There each
// worklet is rebuilt from its own code string with eval and bound to the values
// it captured (react-native-worklets valueUnpacker), and nothing else is in
// scope. A parameter default that names a captured value (w = W0) runs before
// the captured values are unpacked, so it throws, and the panel stays blank.
// The browser preview never showed this because it does not use worklets.
// This test runs the real drawing code the way the phone does, with every
// example scene from the writer's instructions.
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { buildSync } from "esbuild";
import { describe, expect, it } from "vitest";
import { SCENE_PROMPT, checkScene } from "../src/scene";

// The app's own Babel, untyped here, so loaded with require.
const { transformSync } = require("@babel/core") as { transformSync: (code: string, opts: object) => { code?: string | null } | null };

const SCENE_DIR = join(__dirname, "../../mobile/src/teach/scene");
const ROOT = join(__dirname, "../../..");

/** Compiles the scene folder as the app's build does (worklets plugin), then bundles it with a stand-in Skia. */
function phoneBundle(): Record<string, unknown> {
  const files: Record<string, string> = {};
  for (const f of readdirSync(SCENE_DIR).filter((n) => n.endsWith(".ts"))) {
    files[f.replace(/\.ts$/, ".js")] = transformSync(readFileSync(join(SCENE_DIR, f), "utf8"), {
      filename: join(SCENE_DIR, f),
      babelrc: false,
      configFile: false,
      presets: [[require.resolve("@babel/preset-typescript", { paths: [ROOT] }), {}]],
      plugins: [require.resolve("react-native-worklets/plugin", { paths: [ROOT] })],
    })!.code!;
  }
  const skia = `const mk = (l) => new Proxy(function () {}, { get(_t, k) { if (k === "__host") return true; if (k === Symbol.toPrimitive) return () => 0; if (k === "then") return undefined; return mk(l + "." + String(k)); }, apply(_t, _s, a) { const n = l.split(".").pop(); if (/^draw/.test(n)) globalThis.__draws = (globalThis.__draws || 0) + 1; if (n === "getTextWidth" || n === "measureText") return 10; return mk(l + "()"); } });
export const Skia = mk("Skia"); export const canvas = mk("canvas"); export const font = mk("font");`;
  const dir = mkdtempSync(join(tmpdir(), "fenny-phone-"));
  for (const [f, code] of Object.entries(files)) writeFileSync(join(dir, f), code);
  writeFileSync(join(dir, "skia.js"), skia);
  writeFileSync(join(dir, "entry.js"), `export * from "./draw.js"; export { canvas as fakeCanvas, font as fakeFont } from "./skia.js";`);
  const out = buildSync({ entryPoints: [join(dir, "entry.js")], bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent", define: { global: "globalThis" }, alias: { "@shopify/react-native-skia": join(dir, "skia.js") } });
  rmSync(dir, { recursive: true, force: true });
  const mod = { exports: {} as Record<string, unknown> };
  new Function("module", "exports", "require", out.outputFiles[0].text)(mod, mod.exports, require);
  return mod.exports;
}

/** Rebuilds a worklet the way the phone's UI thread does. */
function onPhone(ctx: vm.Context) {
  const cache = new Map<unknown, unknown>();
  const toUI = (v: any): any => {
    if (v && (typeof v === "object" || typeof v === "function") && v.__host) return v;
    if (typeof v === "function") {
      if (cache.has(v)) return cache.get(v);
      if (!v.__initData) {
        const stub = () => {
          throw new Error(`non-worklet function called on the UI thread: ${v.name}`);
        };
        cache.set(v, stub);
        return stub;
      }
      const holder: { __closure?: unknown } = {};
      const compiled = vm.runInContext(v.__initData.code, ctx);
      const fn = (...a: unknown[]) => compiled.apply(holder, a);
      cache.set(v, fn);
      holder.__closure = Array.isArray(v.__closure) ? v.__closure.map(toUI) : {};
      return fn;
    }
    if (Array.isArray(v)) return v.map(toUI);
    if (v && typeof v === "object") {
      if (cache.has(v)) return cache.get(v);
      const o: Record<string, unknown> = {};
      cache.set(v, o);
      for (const k of Object.keys(v)) o[k] = toUI(v[k]);
      return o;
    }
    return v;
  };
  return toUI;
}

/** Every "Name: {scene}" example in the writer's instructions. */
function examples(): { name: string; scene: unknown }[] {
  const out: { name: string; scene: unknown }[] = [];
  for (const line of SCENE_PROMPT.split("\n")) {
    const m = line.match(/^\s*([^{]{2,80}?):?\s+(\{"family".*?\})(\s+play\s+\{.*)?$/);
    if (!m) continue;
    try {
      const s = checkScene(JSON.parse(m[2]));
      if (s) out.push({ name: m[1].trim(), scene: s });
    } catch {
      // not a single scene on this line
    }
  }
  return out;
}

describe("drawings on the phone's UI thread", () => {
  const m = phoneBundle();
  const ctx = vm.createContext({ console, Math, JSON, Number, String, Array, Object, Infinity, NaN, isNaN, isFinite, parseFloat, parseInt, Error, Map, Set, Symbol, Float32Array, Boolean, RegExp, Date });
  vm.runInContext("globalThis.global = globalThis", ctx);
  const toUI = onPhone(ctx);
  const draw = toUI(m.drawScene);
  const scenes = examples();

  it("finds the worked examples", () => {
    expect(scenes.length).toBeGreaterThan(40);
  });

  for (const { name, scene } of scenes) {
    it(`draws ${name}`, () => {
      for (const f of [
        { t: 6, T: 6, v: 0.6, intro: 1, still: false, hand: false, boil: 0, amp: 0.42, age: 9 },
        { t: 0.6, T: 0.6, v: 0, intro: 0.4, still: false, hand: true, boil: 3, amp: 0.42, age: 0.2 },
      ]) {
        (globalThis as any).__draws = 0;
        draw(m.fakeCanvas, scene, [], f, m.fakeFont);
        expect((globalThis as any).__draws).toBeGreaterThan(0);
      }
    });
  }
});

// The background, drawn in code to look like the old photo backgrounds
// (horizon.webp, aurora.webp): a near-black ground with ONE soft light and a
// fine grain, nothing else. The light drifts a little all the time, and each
// screen puts it somewhere else (a wash at the top on Today, over to the
// right on Topics, a low horizon in a session), so a change of screen glides
// it to its new place. Still under Reduce Motion.
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { Blur, Canvas, Fill, Group, Oval, Rect, Shader, Skia } from "@shopify/react-native-skia";
import { Easing, type SharedValue, useDerivedValue, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

export type AuraScene = "today" | "topics" | "me" | "session" | "intro" | "topic";

// The one light per screen: centre (fractions of the screen), size
// (fractions of width and height) and strength.
type Light = { x: number; y: number; w: number; h: number; o: number };
const SCENES: Record<AuraScene, Light> = {
  // Like aurora.webp: a soft silver-blue wash across the top.
  today: { x: 0.4, y: 0.015, w: 1.1, h: 0.21, o: 0.72 },
  topics: { x: 0.84, y: 0.01, w: 0.9, h: 0.19, o: 0.64 },
  me: { x: 0.14, y: 0.01, w: 0.9, h: 0.18, o: 0.58 },
  topic: { x: 0.5, y: 0.0, w: 1.0, h: 0.17, o: 0.5 },
  // A soft wash rising from the bottom edge only, under the button.
  session: { x: 0.5, y: 1.0, w: 1.7, h: 0.32, o: 0.7 },
  intro: { x: 0.5, y: 0.07, w: 1.2, h: 0.24, o: 0.7 },
};

let lastScene: AuraScene = "today";
const SHIFT_MS = 1400;
const ease = Easing.bezier(0.25, 0.1, 0.25, 1);

// Fine film grain, as the photos had. Static, and very faint.
const grain = Skia.RuntimeEffect.Make(`
half4 main(float2 xy) {
  float g = fract(sin(dot(floor(xy), float2(12.9898, 78.233))) * 43758.5453);
  return half4(half3(g), 1.0) * 0.035;
}
`);

// Streaks, relative to the light's box: centre (0 to 1), length and
// thickness as shares of it, blur, colour, and how far and which way it drifts.
type StreakSpec = { cx: number; cy: number; l: number; t: number; blur: number; color: string; move: number };
const STREAKS: StreakSpec[] = [
  { cx: 0.42, cy: 0.42, l: 0.8, t: 0.16, blur: 16, color: "rgba(214,224,242,0.55)", move: 0.08 },
  { cx: 0.6, cy: 0.55, l: 0.7, t: 0.1, blur: 12, color: "rgba(176,194,228,0.5)", move: -0.1 },
  { cx: 0.35, cy: 0.66, l: 0.6, t: 0.08, blur: 10, color: "rgba(150,170,212,0.45)", move: 0.12 },
  { cx: 0.58, cy: 0.3, l: 0.55, t: 0.07, blur: 10, color: "rgba(230,236,247,0.35)", move: -0.06 },
];

function Streak({ st, ox, oy, ow, oh, drift, breath }: { st: StreakSpec; ox: SharedValue<number>; oy: SharedValue<number>; ow: SharedValue<number>; oh: SharedValue<number>; drift: SharedValue<number>; breath: SharedValue<number> }) {
  const w = useDerivedValue(() => ow.value * st.l);
  const h = useDerivedValue(() => oh.value * st.t * (0.9 + 0.2 * breath.value));
  const x = useDerivedValue(() => ox.value + ow.value * (st.cx + st.move * (drift.value - 0.5)) - w.value / 2);
  const y = useDerivedValue(() => oy.value + oh.value * st.cy - h.value / 2);
  return (
    <Oval x={x} y={y} width={w} height={h} color={st.color}>
      <Blur blur={st.blur} />
    </Oval>
  );
}

export function FennyAura({ scene = "today" }: { scene?: AuraScene }) {
  const { width: W, height: H } = useWindowDimensions();
  const reduce = useReducedMotion();
  const from = SCENES[lastScene];
  const x = useSharedValue(from.x);
  const y = useSharedValue(from.y);
  const w = useSharedValue(from.w);
  const h = useSharedValue(from.h);
  const o = useSharedValue(from.o);
  const drift = useSharedValue(0);
  const breath = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    drift.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.sin) }), -1, true);
    breath.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, drift, breath]);

  useEffect(() => {
    lastScene = scene;
    const to = SCENES[scene];
    const go = (v: { value: number }, n: number) => {
      v.value = reduce ? n : withTiming(n, { duration: SHIFT_MS, easing: ease });
    };
    go(x, to.x);
    go(y, to.y);
    go(w, to.w);
    go(h, to.h);
    go(o, to.o);
  }, [scene, reduce, x, y, w, h, o]);

  // A small drift sideways and a slow breath in size and brightness.
  const ow = useDerivedValue(() => W * w.value * (1 + 0.05 * breath.value));
  const oh = useDerivedValue(() => H * h.value * (1 + 0.08 * breath.value));
  const ox = useDerivedValue(() => W * (x.value + 0.06 * (drift.value - 0.5)) - ow.value / 2);
  const oy = useDerivedValue(() => H * (y.value + 0.015 * (drift.value - 0.5)) - oh.value / 2);
  const op = useDerivedValue(() => o.value * (0.88 + 0.12 * breath.value));

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Rect x={0} y={0} width={W} height={H} color="#07080A" />
      <Group opacity={op}>
        <Blur blur={64} />
        <Oval x={ox} y={oy} width={ow} height={oh} color="#8FA5D2" />
      </Group>
      {/* Long soft streaks through the light, like the blurred photo of a dusk
          sky the canvas used (cooled to silver-blue). Each drifts on its own. */}
      <Group opacity={op} blendMode="screen">
        {STREAKS.map((st, i) => (
          <Streak key={i} st={st} ox={ox} oy={oy} ow={ow} oh={oh} drift={drift} breath={breath} />
        ))}
      </Group>
      {grain && (
        <Fill blendMode="plus">
          <Shader source={grain} />
        </Fill>
      )}
    </Canvas>
  );
}

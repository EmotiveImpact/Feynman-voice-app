// A drawn scene on its soft panel, with its one-sentence caption. The clock, the build-in and the
// smoothed slider value live on the UI thread, and each frame is recorded as
// one Skia picture, so dozens of moving marks stay smooth. Under Reduce
// Motion nothing loops, but the slider still changes the scene.
// In Teach me's film the voice drives it instead: build (0 to 1) says how far
// the drawing has built, and nothing moves until moving turns to 1, on the
// line that names the change, so a guess is never given away.
// The look comes from Me: clean lines, hand-drawn lines, or hand-drawn lines
// that are redrawn a few times a second (the wobble), which keeps going even
// while the film holds the scene still. Reduce Motion stops the wobble.
import { useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Canvas, Group, Picture, createPicture, useFont } from "@shopify/react-native-skia";
import { useDerivedValue, useFrameCallback, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { BOIL_FPS, BOIL_GENTLE, carryPlan, drawScene, speedAt, VIEW_H, VIEW_W } from "./draw";
import type { Change, Scene } from "./types";
import { T } from "../../ui/kit";
import { useProfile } from "../../data/profile";

const INTER = require("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf");

export function SceneView({
  scene,
  changes = [],
  value,
  label,
  caption,
  build,
  moving,
  from,
}: {
  scene: Scene;
  changes?: Change[];
  value?: SharedValue<number>;
  label?: string;
  caption?: string;
  /** Driven by the film: how far the drawing has built, 0 to 1. */
  build?: SharedValue<number>;
  /** Driven by the film: 1 once the scene may move. */
  moving?: SharedValue<number>;
  /** The picture this one follows. A person or thing in both moves across to its new place and is not drawn again. */
  from?: Scene | null;
}) {
  const [width, setWidth] = useState(0);
  const font = useFont(INTER, 9.5);
  const reduce = useReducedMotion();
  const t = useSharedValue(reduce ? 1.2 : 0);
  const clock = useSharedValue(reduce ? 1.2 : 0);
  const v = useSharedValue(value ? value.value : 0);
  const intro = useSharedValue(build ? build.value : reduce ? 1 : 0);
  const style = useProfile().drawStyle ?? "alive";
  const hand = style !== "clean";
  const alive = style === "alive" && !reduce;
  // The wobble's own clock: a whole number that steps a few times a second.
  const wobble = useSharedValue(0);
  const boil = useSharedValue(0);
  // What this picture keeps from the one before, and how long it has been up. The age runs
  // even while the film holds the build, so a kept thing never waits at its old place.
  const carry = useMemo(() => carryPlan(from, scene), [from, scene]);
  const age = useSharedValue(reduce || !carry ? 9 : 0);

  useFrameCallback((info) => {
    "worklet";
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const target = value ? value.value : 0;
    if (build) intro.value = build.value;
    if (age.value < 9) age.value += dt;
    if (reduce) {
      v.value = target;
      return;
    }
    if (alive) {
      wobble.value += dt;
      const step = Math.floor(wobble.value * BOIL_FPS) + 1;
      if (step !== boil.value) boil.value = step;
    }
    v.value += (target - v.value) * Math.min(1, dt * 5);
    if (moving && moving.value < 1) return;
    t.value += dt;
    const speed = speedAt(changes, v.value);
    clock.value += dt * (Number.isFinite(speed) ? speed : 1);
    if (!build && intro.value < 1) intro.value = Math.min(1, intro.value + dt * 0.55);
  });

  const k = width / VIEW_W;
  const picture = useDerivedValue(() =>
    createPicture((canvas) => {
      "worklet";
      // This runs on the UI thread, where an error closes the app. A drawing
      // that cannot draw is left blank instead.
      try {
        drawScene(canvas, scene, changes, { t: t.value, T: clock.value, v: v.value, intro: intro.value, still: reduce, hand, boil: alive ? boil.value : 0, amp: BOIL_GENTLE, age: age.value, carry }, font);
      } catch (e) {
        // Nothing drawn this frame. Say why in development, so a blank panel is never a mystery.
        if (__DEV__) console.warn("Scene could not draw:", String(e));
      }
    }),
  );

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{
        borderRadius: 26,
        backgroundColor: "rgba(255,255,255,0.03)",
        overflow: "hidden",
      }}
    >
      <View style={{ aspectRatio: VIEW_W / VIEW_H }}>
        {width > 0 && (
          <Canvas style={{ width, height: (width * VIEW_H) / VIEW_W }}>
            <Group transform={[{ scale: k }]}>
              <Picture picture={picture} />
            </Group>
          </Canvas>
        )}
      </View>
      {caption ? (
        <T size={14.5} style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
          {caption}
        </T>
      ) : null}
    </View>
  );
}

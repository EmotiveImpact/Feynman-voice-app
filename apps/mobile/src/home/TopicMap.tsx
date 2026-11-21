// A topic's ideas as a small constellation: one star per key idea in
// Fenny's checklist, lit once you have explained it. Stars you lit in your
// latest session arrive last, in steel blue, with a ring of light. Line art,
// one weight, one thing lit at a time (the Visual Value rules).
import { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Line } from "react-native-svg";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { TELL_ME } from "../data/lastCall";
import { ago, findTopic, useProfile, type SavedGap } from "../data/profile";
import { colour } from "../theme";
import { Backdrop, Icon, Label, PillButton, T } from "../ui/kit";
import { HEADER_H, ScreenHeader, useHeaderScroll } from "../ui/ScreenHeader";
import { mins } from "./Today";
import { LivingLight } from "../ui/LivingLight";
import { useFennyCue } from "../ui/FennyOrb";
import { riseIn, spring, STAGGER_MS } from "../ui/motion";
import { Press } from "../ui/Press";

// Where up to seven stars sit, as fractions of the map's box, and how they join.
const SPOTS: [number, number][] = [
  [0.12, 0.2],
  [0.46, 0.07],
  [0.86, 0.24],
  [0.34, 0.5],
  [0.76, 0.62],
  [0.44, 0.92],
  [0.1, 0.74],
];
const LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [1, 3],
  [2, 4],
  [3, 4],
  [4, 5],
  [3, 6],
  [5, 6],
];

export default function TopicMap() {
  const { topic = "" } = useLocalSearchParams<{ topic?: string }>();
  useProfile();
  const rec = findTopic(topic);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ideas = (rec?.ideas ?? []).slice(0, SPOTS.length);
  const known = new Set(rec?.known ?? []);
  const fresh = new Set(rec?.fresh ?? []);
  const lit = ideas.filter((k) => known.has(k.id)).length;
  const all = ideas.length > 0 && lit === ideas.length;
  const W = width - 48;
  // The sky is only as tall as its lowest star, so a short topic leaves no empty gap above the list.
  const FULL = 280;
  const H = FULL * Math.max(0.3, ...ideas.map((_, i) => SPOTS[i][1])) + 26;
  const at = (i: number) => ({ x: SPOTS[i][0] * W, y: SPOTS[i][1] * FULL });
  const [cue, react] = useFennyCue();
  useEffect(() => {
    if (!fresh.size) return;
    const id = setTimeout(() => react(all ? "yay" : "aha"), 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gaps = (rec?.gaps ?? []).filter((g) => !g.clearedAt);
  const { scrollY, onScroll } = useHeaderScroll();
  const openGap = (g: SavedGap) => router.push({ pathname: "/session", params: { topic, prompt: TELL_ME, focus: g.title, focusId: g.id } });

  return (
    <View style={styles.root}>
      <Backdrop scene="topic" />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + HEADER_H + 8, paddingBottom: insets.bottom + 170, paddingHorizontal: 24 }}
      >
        <Animated.View entering={riseIn()} style={{ gap: 6, marginTop: 6 }}>
          <T size={30} weight="medium" style={{ lineHeight: 35 }}>
            {topic}
          </T>
          <T size={15} tone="soft">
            {ideas.length === 0
              ? "Explain it to Fenny to see its ideas."
              : all
                ? `You can explain all ${ideas.length} ideas.`
                : `${lit} of ${ideas.length} ideas you can explain`}
          </T>
        </Animated.View>

        {ideas.length > 0 && (
          <View style={{ width: W, height: H, marginTop: 26 }} accessibilityLabel={`${lit} of ${ideas.length} ideas lit`}>
            <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
              {LINKS.filter(([a, b]) => a < ideas.length && b < ideas.length).map(([a, b]) => {
                const on = known.has(ideas[a].id) && known.has(ideas[b].id);
                const p = at(a);
                const q = at(b);
                return (
                  <Line
                    key={`${a}-${b}`}
                    x1={p.x}
                    y1={p.y}
                    x2={q.x}
                    y2={q.y}
                    stroke={on ? "rgba(214,218,226,0.6)" : "rgba(214,218,226,0.18)"}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeDasharray={on ? undefined : "3 6"}
                  />
                );
              })}
            </Svg>
            {ideas.map((k, i) => (
              <Star key={k.id} x={at(i).x} y={at(i).y} n={i + 1} lit={known.has(k.id)} fresh={fresh.has(k.id)} delay={(fresh.has(k.id) ? 6 : i) * STAGGER_MS} all={all} />
            ))}
          </View>
        )}

        {ideas.length > 0 && (
          <Animated.View entering={riseIn(2 * STAGGER_MS)}>
            <Label style={styles.heading}>The ideas</Label>
            <View style={[styles.card, { paddingVertical: 6 }]}>
              {ideas.map((k, i) => (
                <View key={k.id} style={[styles.idea, i > 0 && styles.rule]}>
                  <View style={[styles.num, known.has(k.id) && styles.numLit, fresh.has(k.id) && styles.numFresh]}>
                    <T size={11.5} weight="medium" style={{ color: known.has(k.id) ? colour.ground : colour.muted, lineHeight: 15 }}>
                      {i + 1}
                    </T>
                  </View>
                  {/* Ideas still to explain show only their name, so the page never gives the answer away. */}
                  <View style={{ flex: 1, gap: 3 }}>
                    <T size={15.5} tone={known.has(k.id) ? "text" : "muted"} style={{ lineHeight: 21 }}>
                      {k.label ? cap(k.label) : known.has(k.id) ? k.idea : `Idea ${i + 1}`}
                      {fresh.has(k.id) ? <T size={13} tone="student">{"  "}New</T> : null}
                    </T>
                    {k.label && known.has(k.id) ? (
                      <T size={13.5} tone="soft" style={{ lineHeight: 19 }}>
                        {k.idea}
                      </T>
                    ) : !known.has(k.id) ? (
                      <T size={13} tone="dim">
                        Not explained yet
                      </T>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {gaps.length > 0 && (
          <Animated.View entering={riseIn(3 * STAGGER_MS)}>
            <Label style={styles.heading}>Explain again</Label>
            <View style={styles.card}>
              {gaps.map((g, i) => (
                <Press key={g.id} onPress={() => openGap(g)} accessibilityRole="button" accessibilityLabel={`Explain again: ${g.title}`} style={[styles.idea, i > 0 && styles.rule]}>
                  <View style={[styles.dot, { backgroundColor: g.kind === "skipped" ? colour.student : colour.gap }]} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <T size={15.5} style={{ lineHeight: 21 }}>
                      {g.title}
                    </T>
                    <T size={13} style={{ color: g.kind === "skipped" ? "#B4C4E4" : "#E5A794" }}>
                      {g.named ? "You named it" : g.kind === "skipped" ? "Skipped" : g.kind === "muddled" ? "Not quite" : "Gap"}
                    </T>
                  </View>
                  <Icon name="chevron" size={18} color={colour.muted} />
                </Press>
              ))}
            </View>
          </Animated.View>
        )}

        {rec && (
          <Animated.View entering={riseIn(4 * STAGGER_MS)}>
            <View style={[styles.card, styles.facts]}>
              <Fact value={String(rec.sessions)} label={rec.sessions === 1 ? "session" : "sessions"} />
              <View style={styles.vrule} />
              <Fact value={mins(rec.seconds)} label="explaining" />
              <View style={styles.vrule} />
              <Fact value={cap(ago(rec.at))} label="last time" />
            </View>
          </Animated.View>
        )}

        {ideas.length > 0 && (
          <Animated.View entering={riseIn(5 * STAGGER_MS)}>
            <Label style={styles.heading}>How this works</Label>
            <View style={[styles.card, { padding: 18, gap: 12 }]}>
              <How dot={<View style={[styles.legend, { backgroundColor: "#E6E9EE" }]} />} text="A star lights up when you explain that idea clearly to Fenny." />
              <How dot={<View style={[styles.legend, { backgroundColor: colour.student }]} />} text="Blue means you lit it in your last session." />
              <How dot={<View style={[styles.legend, styles.legendOff]} />} text="An empty star is an idea Fenny is still waiting to hear about." />
            </View>
          </Animated.View>
        )}
      </Animated.ScrollView>

      <ScreenHeader top={insets.top} title={topic} backLabel="Back to Topics" scrollY={scrollY} right={<LivingLight size={32} peek cue={cue} touchable />} />

      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 14) + 4 }]}>
        <LinearGradient pointerEvents="none" colors={["rgba(8,9,11,0)", colour.ground]} style={styles.bottomFade} />
        <PillButton
          label={all ? "Explain it again" : "Explain it to Fenny"}
          variant="solid"
          onPress={() => router.replace({ pathname: "/session", params: { topic } })}
        />
        {!all && (
          <PillButton
            label="Teach me first"
            accessibilityLabel="Teach me first: a short lesson before you explain"
            onPress={() => router.replace({ pathname: "/session", params: { topic, teach: "1" } })}
            style={{ marginTop: 8, height: 48 }}
          />
        )}
      </View>
    </View>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <T size={17} weight="medium" lines={1}>
        {value}
      </T>
      <T size={12.5} tone="muted">
        {label}
      </T>
    </View>
  );
}

function How({ dot, text }: { dot: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <View style={{ width: 14, alignItems: "center" }}>{dot}</View>
      <T size={14} tone="soft" style={{ flex: 1, lineHeight: 20 }}>
        {text}
      </T>
    </View>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Star({ x, y, n, lit, fresh, delay, all }: { x: number; y: number; n: number; lit: boolean; fresh: boolean; delay: number; all: boolean }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(reduce ? 1 : 0.4);
  const ring = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    s.value = withDelay(delay, withSpring(1, spring.bouncy));
    if (fresh) ring.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 0 })), 3));
  }, [reduce, delay, fresh, s, ring]);
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const halo = useAnimatedStyle(() => ({ opacity: (1 - ring.value) * 0.7, transform: [{ scale: 1 + ring.value * 1.8 }] }));
  const size = lit ? (all ? 16 : 14) : 11;
  const fill = fresh ? colour.student : lit ? "#E6E9EE" : colour.ground;
  return (
    <View style={[styles.star, { left: x - 22, top: y - 22 }]} pointerEvents="none" accessibilityLabel={`Idea ${n}${lit ? ", explained" : ""}`}>
      {fresh && <Animated.View style={[styles.ring, halo]} />}
      <Animated.View
        style={[
          { width: size, height: size, borderRadius: size / 2, backgroundColor: fill, borderWidth: 1.5, borderColor: lit ? fill : "rgba(214,218,226,0.35)" },
          dot,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colour.ground },
  heading: { marginTop: 28, marginLeft: 4 },
  card: { marginTop: 10, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.055)" },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.1)" },
  vrule: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.12)" },
  facts: { marginTop: 22, flexDirection: "row", alignItems: "center", paddingVertical: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 7, marginHorizontal: 7 },
  legend: { width: 11, height: 11, borderRadius: 6 },
  legendOff: { borderWidth: 1.5, borderColor: "rgba(214,218,226,0.35)" },
  bottomFade: { position: "absolute", left: -24, right: -24, top: -40, height: 40 },
  star: { position: "absolute", width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colour.student },
  idea: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 13, paddingHorizontal: 16 },
  num: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(214,218,226,0.3)", marginTop: 0 },
  numLit: { backgroundColor: "#E6E9EE", borderColor: "#E6E9EE" },
  numFresh: { backgroundColor: colour.student, borderColor: colour.student },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 6, backgroundColor: colour.ground },
});

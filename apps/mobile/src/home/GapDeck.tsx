// The gap cards from the intro ("Then the clever bit"), for real: the gaps
// from your sessions as a small stack. The front card is the next one to
// explain again; tap it to start. "Next" deals the next card to the front.
// The stack sits still, no 3D carousel, so it reads as one pile of cards.
import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOutLeft, useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { ago, type SavedGap } from "../data/profile";
import { colour } from "../theme";
import { Icon, T } from "../ui/kit";
import { spring } from "../ui/motion";
import { Press } from "../ui/Press";

const art = require("../../assets/images/intro-gap.webp");

export function GapDeck({ gaps, onOpen }: { gaps: { topic: string; gap: SavedGap }[]; onOpen: (topic: string, gap: SavedGap) => void }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  if (!gaps.length) return null;
  const at = i % gaps.length;
  const { topic, gap } = gaps[at];
  const kind = gap.named ? "You named it" : gap.kind === "skipped" ? "Skipped" : gap.kind === "muddled" ? "Not quite" : "Gap";
  const tint = gap.kind === "skipped" ? "#B4C4E4" : "#F0AE9B";
  const behind = Math.min(2, gaps.length - 1);
  const next = () => {
    Haptics.selectionAsync().catch(() => {});
    setI((n) => n + 1);
  };
  return (
    <View>
      <View style={styles.stack}>
        {behind >= 2 && <View style={[styles.card, styles.back2]} />}
        {behind >= 1 && <View style={[styles.card, styles.back1]} />}
        <Animated.View
          key={i}
          entering={reduce ? FadeIn : FadeInDown.springify().duration(spring.bouncy.duration).dampingRatio(0.72)}
          exiting={reduce ? undefined : FadeOutLeft.duration(220)}
          style={styles.cardWrap}
        >
          <Press onPress={() => onOpen(topic, gap)} accessibilityRole="button" accessibilityLabel={`Explain again: ${gap.title}`} style={[styles.card, styles.front]}>
            <Image source={art} resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity: 0.6 }]} accessibilityIgnoresInvertColors />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,11,13,0.42)" }]} />
            <View style={styles.tag}>
              <View style={[styles.dot, { backgroundColor: gap.kind === "skipped" ? colour.student : colour.gap }]} />
              <T size={12.5} style={{ color: tint }} lines={1}>
                {kind} · {topic}
              </T>
            </View>
            <View style={styles.body}>
              <T size={21} weight="semibold" lines={3} style={{ lineHeight: 26 }}>
                {gap.title}
              </T>
              <View style={styles.foot}>
                <T size={13} tone="soft">
                  Caught {ago(gap.at)}
                </T>
                <View style={styles.go}>
                  <T size={13.5} weight="medium" tone="dark">
                    Explain it again
                  </T>
                </View>
              </View>
            </View>
          </Press>
        </Animated.View>
      </View>
      {gaps.length > 1 && (
        <View style={styles.under}>
          <T size={13} tone="muted">
            {at + 1} of {gaps.length}
          </T>
          <Press onPress={next} accessibilityRole="button" accessibilityLabel="Next card" hitSlop={8} style={styles.next}>
            <T size={14} tone="soft">
              Next
            </T>
            <Icon name="arrow" size={16} color={colour.soft} />
          </Press>
        </View>
      )}
    </View>
  );
}

const H = 214;
const styles = StyleSheet.create({
  stack: { height: H + 18, marginTop: 14, paddingHorizontal: 6 },
  cardWrap: { position: "absolute", left: 6, right: 6, top: 0, height: H },
  card: { position: "absolute", left: 0, right: 0, top: 0, height: H, borderRadius: 26 },
  back2: { left: 22, right: 22, top: 18, backgroundColor: "#141519", transform: [{ rotate: "-3deg" }] },
  back1: { left: 12, right: 12, top: 9, backgroundColor: "#1A1C20", transform: [{ rotate: "2.5deg" }] },
  front: { overflow: "hidden", backgroundColor: "#1B1D21", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  tag: { position: "absolute", left: 14, top: 14, right: 14, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  body: { position: "absolute", left: 18, right: 18, bottom: 16, gap: 14 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  go: { height: 36, borderRadius: 18, paddingHorizontal: 14, justifyContent: "center", backgroundColor: "#E4E7EB" },
  under: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingHorizontal: 8 },
  next: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
});

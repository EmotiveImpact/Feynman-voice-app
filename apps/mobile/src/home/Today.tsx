// Today, from the canvas board "THE APP: start here". One way in, your last
// topic to pick up, and the gaps from your sessions to explain again. (The
// spaced review queue, build step 6, will decide which day each comes back.)
import { useState } from "react";
import { Press } from "../ui/Press";
import { StyleSheet, Text, View } from "react-native";
import Animated, { type SharedValue, useReducedMotion } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { ago, dayNumber, openGaps, softStreak, todaySentence, type Profile, type SavedGap } from "../data/profile";
import { colour, font } from "../theme";
import { Icon, Label, T } from "../ui/kit";
import { riseIn, STAGGER_MS } from "../ui/motion";
import { Soft } from "../ui/Soft";
import { IdeaDots } from "./IdeaDots";
import { Page } from "./Page";

export function Today({
  profile,
  top,
  bottom,
  scrollY,
  onNew,
  onTopic,
  onGap,
  onLook,
}: {
  profile: Profile;
  top: number;
  bottom: number;
  scrollY: SharedValue<number>;
  onNew: () => void;
  onTopic: (t: string) => void;
  onGap: (topic: string, gap: SavedGap) => void;
  onLook?: () => void;
}) {
  const last = profile.topics[0];
  const streak = softStreak(profile.days);
  const gaps = openGaps(profile);
  const [showAll, setShowAll] = useState(false);
  // "It caught N gaps": the gaps found on the day of the last session.
  const lastDay = profile.topics[0] ? dayNumber(profile.topics[0].at) : -1;
  const caught = profile.topics.flatMap((t) => t.gaps ?? []).filter((g) => dayNumber(g.at) === lastDay).length;
  const ideas = last?.ideas?.slice(0, 7) ?? [];
  return (
    <Page top={top} bottom={bottom} scrollY={scrollY}>
      <In d={1}>
        <Text style={styles.sentence} accessibilityRole="header">
          {todaySentence(profile, { caught, due: gaps.length }).map((part, i) =>
            part.hl ? (
              <Text key={i} style={[styles.hl, part.hl === "gap" && styles.hlGap]}>
                {part.text}
              </Text>
            ) : (
              part.text
            ),
          )}
        </Text>
        {streak > 1 && (
          <View style={styles.streak}>
            <Svg width={14} height={14} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
              <Path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 2 1 3 2 3 4" stroke={colour.muted} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
            <T size={13.5} tone="muted">
              {streak} days in a row
            </T>
          </View>
        )}
      </In>

      {/* The one way in: the only silver thing on the page. The camera sits beside it, quiet. */}
      <In d={2}>
        <View style={styles.startRow}>
          <Press onPress={onNew} accessibilityRole="button" accessibilityLabel="Pick a topic, or say one" style={{ flex: 1 }}>
            <View style={styles.start}>
              <T size={16} tone="soft" style={{ flex: 1 }} lines={1}>
                Pick a topic, or say one
              </T>
              <Soft lit glow={false} style={{ width: 50, height: 50 }}>
                <Icon name="mic" color={colour.onLight} />
              </Soft>
            </View>
          </Press>
          {onLook && (
            <Press onPress={onLook} accessibilityRole="button" accessibilityLabel="Teach me this thing: show Fenny something with the camera">
              <Soft style={{ width: 62, height: 62 }}>
                <Icon name="camera" size={22} color="#C9CDD4" />
              </Soft>
            </Press>
          )}
        </View>
      </In>

      {last && (
        <In d={3}>
          <Label style={styles.heading}>Pick up where you left off</Label>
          <Press onPress={() => onTopic(last.title)} accessibilityRole="button" accessibilityLabel={`Explain ${last.title} again`}>
            <View style={[styles.card, styles.resume]}>
              <View style={{ flex: 1, gap: 7 }}>
                <T size={18} weight="semibold" lines={2} style={{ lineHeight: 23 }}>
                  {last.title}
                </T>
                {ideas.length ? (
                  <IdeaDots total={ideas.length} lit={ideas.filter((k) => last.known?.includes(k.id)).length} />
                ) : (
                  <T size={13} tone="muted">
                    {last.sessions === 1 ? "1 session" : `${last.sessions} sessions`} · {mins(last.seconds)} explaining
                  </T>
                )}
              </View>
              <View style={styles.go}>
                <Icon name="arrow" size={19} color="#D6D9DE" />
              </View>
            </View>
          </Press>
        </In>
      )}

      <In d={4}>
        <Label style={styles.heading}>Explain again</Label>
        {gaps.length === 0 ? (
          <T size={15} tone="soft" style={{ marginTop: 10 }}>
            {profile.topics.length ? "Nothing to go over. Gaps from your sessions come back here." : "Nothing yet. Explain your first topic and this fills up."}
          </T>
        ) : (
          <View style={[styles.card, styles.list]}>
            {(showAll ? gaps : gaps.slice(0, 5)).map(({ topic, gap }, i) => (
              <Press
                key={gap.id}
                onPress={() => onGap(topic, gap)}
                accessibilityRole="button"
                accessibilityLabel={`Explain again: ${gap.title}`}
                style={[styles.gapRow, i > 0 && styles.divider]}
              >
                <View style={[styles.dot, gap.kind === "skipped" ? { backgroundColor: colour.student } : { backgroundColor: colour.gap }]} />
                <View style={{ flex: 1, gap: 3 }}>
                  <T size={15.5} lines={2} style={{ lineHeight: 21 }}>
                    {gap.title}
                  </T>
                  <T size={13} tone="muted" lines={1}>
                    <T size={13} style={{ color: gap.kind === "skipped" ? "#B4C4E4" : "#E5A794" }}>
                      {gap.named ? "You named it" : gap.kind === "skipped" ? "Skipped" : gap.kind === "muddled" ? "Not quite" : "Gap"}
                    </T>
                    {" · "}
                    {topic} · {ago(gap.at)}
                  </T>
                </View>
              </Press>
            ))}
            {gaps.length > 5 && (
              <Press onPress={() => setShowAll((v) => !v)} accessibilityRole="button" style={[styles.gapRow, styles.divider, { justifyContent: "center" }]}>
                <T size={14} tone="soft">
                  {showAll ? "Show fewer" : `Show all ${gaps.length}`}
                </T>
              </Press>
            )}
          </View>
        )}
      </In>
    </Page>
  );
}

/** A section arriving in turn: d = 1 comes first, each next one 80 ms later. */
export function In({ d, children }: { d: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return <Animated.View entering={reduce ? undefined : riseIn((d - 1) * STAGGER_MS + 40)}>{children}</Animated.View>;
}

export const mins = (s: number) => (s < 60 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`);

/** The soft surface every card on the home pages shares. */
export const CARD = { borderRadius: 24, backgroundColor: "rgba(255,255,255,0.055)" } as const;

const styles = StyleSheet.create({
  sentence: { marginTop: 30, fontFamily: font.regular, fontSize: 27, lineHeight: 36, letterSpacing: -27 * 0.018, color: "#D6D9DE" },
  // The numbers in the sentence: colour alone carries them. Silver-blue; gaps in coral.
  hl: { fontFamily: font.medium, color: "#BFCEEC" },
  hlGap: { color: "#F0AE9B" },
  streak: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 6 },
  startRow: { marginTop: 22, flexDirection: "row", alignItems: "center", gap: 10 },
  start: { height: 62, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 12, paddingLeft: 22, paddingRight: 6, backgroundColor: "rgba(255,255,255,0.07)" },
  heading: { marginTop: 30, marginLeft: 4 },
  card: { marginTop: 10, ...CARD },
  resume: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 18, paddingLeft: 18, paddingRight: 14 },
  go: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  list: { overflow: "hidden" },
  gapRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 15, paddingHorizontal: 18 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.1)" },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
});

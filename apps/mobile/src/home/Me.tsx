// Me: about you. What you've done, your minutes, then a way into Settings.
// It shows only what the phone really knows. The streak is soft on purpose:
// it forgives a missed day a week (see docs/behavioural-design.md).
import { Press } from "../ui/Press";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import type { SharedValue } from "react-native-reanimated";
import { minutesLeft, PROTOTYPE_MINUTES, softStreak, type Profile } from "../data/profile";
import { Icon, Label, T } from "../ui/kit";
import { Page } from "./Page";
import { CARD, In, mins } from "./Today";

export function Me({ profile, top, bottom, scrollY, onReplayIntro }: { profile: Profile; top: number; bottom: number; scrollY: SharedValue<number>; onReplayIntro: () => void }) {
  const left = minutesLeft(profile);
  const sessions = profile.topics.reduce((n, t) => n + t.sessions, 0);
  const questions = profile.topics.reduce((n, t) => n + t.questions, 0);
  const streak = softStreak(profile.days);
  const topics = profile.topics.length;
  const share = Math.max(0, Math.min(1, left / PROTOTYPE_MINUTES));
  const ideas = profile.topics.reduce((n, t) => n + (t.known?.length ?? 0), 0);
  const closed = profile.topics.reduce((n, t) => n + (t.gaps ?? []).filter((g) => g.clearedAt).length, 0);
  return (
    <Page top={top} bottom={bottom} scrollY={scrollY}>
      <In d={1}>
        <T size={30} weight="medium" style={{ marginTop: 30, marginLeft: 2 }}>
          {profile.name || "You"}
        </T>
        <T size={15} tone="muted" style={{ marginTop: 4, marginLeft: 2 }}>
          {topics === 0 ? "Nothing explained yet." : `${topics} ${topics === 1 ? "topic" : "topics"} explained`}
          {streak > 1 ? ` · ${streak} days in a row` : ""}
        </T>
      </In>

      <In d={2}>
        <View style={[styles.card, styles.stats]}>
          <Stat value={String(sessions)} label="sessions" />
          <View style={styles.rule} />
          <Stat value={String(ideas)} label="ideas explained" />
          <View style={styles.rule} />
          <Stat value={String(closed)} label="gaps closed" />
        </View>
        <T size={13} tone="muted" style={{ marginTop: 10, marginLeft: 4 }}>
          {mins(profile.secondsUsed)} explaining · {questions} questions from Fenny
        </T>
      </In>

      <In d={3}>
        <Label style={styles.heading}>Minutes</Label>
        <View style={[styles.card, { padding: 18 }]}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
            <T size={30} weight="medium">
              {left}
            </T>
            <T size={15} tone="soft">
              min left of {PROTOTYPE_MINUTES}
            </T>
          </View>
          <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: PROTOTYPE_MINUTES, now: left }}>
            <View style={[styles.fill, { width: `${share * 100}%` }]} />
          </View>
          <T size={13} tone="muted" style={{ marginTop: 12 }}>
            Only your speaking time counts. Fenny's questions are free.
          </T>
        </View>
      </In>

      <In d={4}>
        <View style={[styles.card, { marginTop: 22 }]}>
          <Row icon="settings" label="Settings" note="Voice, what a call shows, Teach me" onPress={() => router.push("/settings")} />
          <Row icon="arrow" label="Play the intro again" onPress={onReplayIntro} rule />
        </View>
      </In>
    </Page>
  );
}

function Row({ icon, label, note, onPress, rule }: { icon: "settings" | "arrow"; label: string; note?: string; onPress: () => void; rule?: boolean }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.row, rule && styles.rowRule]}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={18} color="#C9CDD4" />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <T size={15.5}>{label}</T>
        {note ? (
          <T size={13} tone="muted">
            {note}
          </T>
        ) : null}
      </View>
      <Icon name="chevron" size={18} color="#888D96" />
    </Press>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <T size={22} weight="medium" style={{ lineHeight: 28 }}>
        {value}
      </T>
      <T size={13} tone="muted" style={{ textAlign: "center" }}>
        {label}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 10, ...CARD },
  heading: { marginTop: 30, marginLeft: 4 },
  stats: { marginTop: 22, flexDirection: "row", alignItems: "center", paddingVertical: 18 },
  rule: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: "rgba(255,255,255,0.12)" },
  track: { marginTop: 14, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.09)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3, backgroundColor: "#B4C4E4" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 16 },
  rowRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.1)" },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
});

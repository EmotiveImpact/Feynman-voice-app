// Me: what you've done first, minutes after, then how Fenny behaves.
// It shows only what the phone really knows. The streak is soft on purpose:
// it forgives a missed day a week (see docs/behavioural-design.md).
import type { ReactNode } from "react";
import { Press } from "../ui/Press";
import { StyleSheet, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { minutesLeft, PROTOTYPE_MINUTES, setExplainLevel, setFastReplies, type ExplainPref, setSessionView, setVoice, softStreak, type Profile, type VoicePref } from "../data/profile";
import { warmPhononOnLaunch } from "../live/phononWarm";
import { VIEWS } from "../live/ViewMenu";
import { Icon, Label, T } from "../ui/kit";
import { Page } from "./Page";
import { CARD, In, mins } from "./Today";

const VOICES: { id: VoicePref; label: string; note: string }[] = [
  { id: "sonic", label: "Live", note: "Fenny's best voice. Needs a connection." },
  { id: "phonon", label: "On this phone", note: "Downloads once (about 150 MB), then works offline." },
];

const REPLIES: { id: "steady" | "fast"; label: string; note: string }[] = [
  { id: "steady", label: "Steady", note: "Fenny waits until you've clearly finished." },
  { id: "fast", label: "Faster", note: "A trial. Fenny waits less, and you can talk over her with headphones on." },
];

const EXPLAIN: { id: ExplainPref; label: string; note: string }[] = [
  { id: "smart", label: "Smart", note: "Starts plain and adapts to you." },
  { id: "simple", label: "Simple", note: "Like you're five." },
  { id: "standard", label: "Standard", note: "Like you're twelve." },
  { id: "deep", label: "In depth", note: "University level." },
];

const VIEW_NOTES: Record<string, string> = {
  light: "Just Fenny's light and her question.",
  subtitles: "Her question in large words, and what you last said.",
  chat: "The whole conversation as you go.",
};

export function Me({ profile, top, bottom, scrollY, onReplayIntro }: { profile: Profile; top: number; bottom: number; scrollY: SharedValue<number>; onReplayIntro: () => void }) {
  const left = minutesLeft(profile);
  const sessions = profile.topics.reduce((n, t) => n + t.sessions, 0);
  const questions = profile.topics.reduce((n, t) => n + t.questions, 0);
  const streak = softStreak(profile.days);
  const topics = profile.topics.length;
  const share = Math.max(0, Math.min(1, left / PROTOTYPE_MINUTES));
  const view = profile.sessionView ?? "light";
  const voice = profile.voice ?? "sonic";
  const replies = profile.fastReplies ? "fast" : "steady";
  const explain = profile.explainLevel ?? "smart";
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
          <Stat value={String(questions)} label="questions" />
          <View style={styles.rule} />
          <Stat value={mins(profile.secondsUsed)} label="explaining" />
        </View>
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
        <Label style={styles.heading}>Fenny</Label>
        <View style={styles.card}>
          <Setting title="On a call, show" note={VIEW_NOTES[view]}>
            <Segments label="Session view" options={VIEWS.map((v) => ({ id: v.id, label: v.id === "light" ? "Light" : v.id === "subtitles" ? "Subtitles" : "Chat" }))} value={view} onChange={setSessionView} />
          </Setting>
          <Setting title="Voice" note={VOICES.find((v) => v.id === voice)?.note} rule>
            <Segments
              label="Fenny's voice"
              options={VOICES}
              value={voice}
              onChange={(id) => {
                setVoice(id);
                warmPhononOnLaunch(id);
              }}
            />
          </Setting>
          <Setting title="Replies" note={REPLIES.find((r) => r.id === replies)?.note} rule>
            <Segments label="Replies" options={REPLIES} value={replies} onChange={(id) => setFastReplies(id === "fast")} />
          </Setting>
          <Setting title="Teach me explains" note={EXPLAIN.find((e) => e.id === explain)?.note} rule>
            <Segments label="Explain things" options={EXPLAIN} value={explain} onChange={setExplainLevel} />
          </Setting>
        </View>
      </In>

      <In d={5}>
        <View style={[styles.card, { marginTop: 14 }]}>
          <Press onPress={onReplayIntro} style={styles.rowBtn} accessibilityRole="button">
            <T size={15.5} style={{ flex: 1 }}>
              Play the intro again
            </T>
            <Icon name="chevron" size={18} color="#888D96" />
          </Press>
        </View>
      </In>
    </Page>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <T size={22} weight="medium" style={{ lineHeight: 28 }}>
        {value}
      </T>
      <T size={13} tone="muted">
        {label}
      </T>
    </View>
  );
}

/** One setting: its name, the choice, and one line on what the choice means. */
function Setting({ title, note, rule, children }: { title: string; note?: string; rule?: boolean; children: ReactNode }) {
  return (
    <View style={[styles.setting, rule && styles.settingRule]}>
      <T size={15.5}>{title}</T>
      {children}
      {note ? (
        <T size={13} tone="muted">
          {note}
        </T>
      ) : null}
    </View>
  );
}

/** A row of choices in one soft track, the chosen one lifted. */
function Segments<Id extends string>({ label, options, value, onChange }: { label: string; options: readonly { id: Id; label: string }[]; value: Id; onChange: (id: Id) => void }) {
  return (
    <View style={styles.segments} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Press key={o.id} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label} onPress={() => onChange(o.id)} style={[styles.segment, on && styles.segmentOn]}>
            <T size={13.5} weight={on ? "medium" : "regular"} tone={on ? "text" : "muted"} lines={1}>
              {o.label}
            </T>
          </Press>
        );
      })}
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
  setting: { paddingVertical: 16, paddingHorizontal: 18, gap: 10 },
  settingRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.1)" },
  segments: { flexDirection: "row", gap: 3, padding: 3, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.28)" },
  segment: { flex: 1, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  segmentOn: { backgroundColor: "rgba(255,255,255,0.13)" },
  rowBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 17, paddingHorizontal: 18 },
});

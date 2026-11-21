// Settings: how Fenny behaves. Reached from Me, so Me stays about you.
// The session view lives here and only here, never on the call screen.
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setDrawStyle, setExplainLevel, setFastReplies, setSessionView, setVoice, useProfile, type DrawStylePref, type ExplainPref, type VoicePref } from "../data/profile";
import { warmPhononOnLaunch } from "../live/phononWarm";
import { VIEWS } from "../live/ViewMenu";
import { colour } from "../theme";
import { Backdrop, Label, T } from "../ui/kit";
import { Press } from "../ui/Press";
import { HEADER_H, ScreenHeader, useHeaderScroll } from "../ui/ScreenHeader";
import { CARD, In } from "./Today";

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

const DRAWINGS: { id: DrawStylePref; label: string; note: string }[] = [
  { id: "alive", label: "Alive", note: "Sketched by hand and never quite still." },
  { id: "hand", label: "Hand-drawn", note: "Sketched by hand and still." },
  { id: "clean", label: "Clean", note: "Smooth, even lines." },
];

const VIEW_NOTES: Record<string, string> = {
  light: "Just Fenny's light and her question.",
  subtitles: "Her question in large words, and what you last said.",
  chat: "The whole conversation as you go.",
};

export default function Settings() {
  const profile = useProfile();
  const insets = useSafeAreaInsets();
  const { scrollY, onScroll } = useHeaderScroll();
  const view = profile.sessionView ?? "light";
  const voice = profile.voice ?? "sonic";
  const replies = profile.fastReplies ? "fast" : "steady";
  const explain = profile.explainLevel ?? "smart";
  const draw = profile.drawStyle ?? "alive";
  return (
    <View style={{ flex: 1, backgroundColor: colour.ground }}>
      <Backdrop scene="me" />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + HEADER_H + 8, paddingBottom: insets.bottom + 40, paddingHorizontal: 20 }}>
        <In d={1}>
          <T size={30} weight="medium" style={{ marginTop: 6, marginLeft: 2 }}>
            Settings
          </T>
        </In>
        <In d={2}>
          <Label style={styles.heading}>On a call</Label>
          <View style={styles.card}>
            <Setting title="Show" note={VIEW_NOTES[view]}>
              <Segments label="Session view" options={VIEWS.map((v) => ({ id: v.id, label: v.id === "light" ? "Light" : v.id === "subtitles" ? "Subtitles" : "Chat" }))} value={view} onChange={setSessionView} />
            </Setting>
            <Setting title="Fenny's voice" note={VOICES.find((v) => v.id === voice)?.note} rule>
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
          </View>
        </In>
        <In d={3}>
          <Label style={styles.heading}>Teach me</Label>
          <View style={styles.card}>
            <Setting title="Explains things" note={EXPLAIN.find((e) => e.id === explain)?.note}>
              <Segments label="Explain things" options={EXPLAIN} value={explain} onChange={setExplainLevel} />
            </Setting>
            <Setting title="Drawings" note={DRAWINGS.find((d) => d.id === draw)?.note} rule>
              <Segments label="Drawings" options={DRAWINGS} value={draw} onChange={setDrawStyle} />
            </Setting>
          </View>
        </In>
      </Animated.ScrollView>
      <ScreenHeader top={insets.top} title="Settings" backLabel="Back to Me" scrollY={scrollY} />
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
  heading: { marginTop: 28, marginLeft: 4 },
  setting: { paddingVertical: 16, paddingHorizontal: 18, gap: 10 },
  settingRule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.1)" },
  segments: { flexDirection: "row", gap: 3, padding: 3, borderRadius: 15, backgroundColor: "rgba(0,0,0,0.28)" },
  segment: { flex: 1, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  segmentOn: { backgroundColor: "rgba(255,255,255,0.13)" },
});

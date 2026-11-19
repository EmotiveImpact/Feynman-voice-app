// Me, from the canvas board: what you've done first, minutes after.
// Ideas mastered and gaps closed need gap analysis (build step 4), so this
// shows only what the phone really knows. The streak is soft on purpose: it
// forgives a missed day a week (see docs/behavioural-design.md).
import { Press } from "../ui/Press";
import { ScrollView, StyleSheet, View } from "react-native";
import { minutesLeft, PROTOTYPE_MINUTES, setDrawStyle, setExplainLevel, setFastReplies, type DrawStylePref, type ExplainPref, setSessionView, setVoice, softStreak, type Profile, type VoicePref } from "../data/profile";
import { warmPhononOnLaunch } from "../live/phononWarm";
import { ViewIcon, VIEWS } from "../live/ViewMenu";
import { colour } from "../theme";
import { MinutesRing } from "../ui/Dots";
import { Glass, Label, T } from "../ui/kit";
import { homeStyles } from "./styles";
import { In, mins } from "./Today";

const VOICES: { id: VoicePref; label: string; note: string }[] = [
  { id: "sonic", label: "Live", note: "Cartesia Sonic" },
  { id: "phonon", label: "On this phone", note: "Phonon" },
];

const DRAWINGS: { id: DrawStylePref; label: string; note: string }[] = [
  { id: "alive", label: "Alive", note: "Hand-drawn, gently moving" },
  { id: "hand", label: "Hand-drawn", note: "Sketched and still" },
  { id: "clean", label: "Clean", note: "Smooth lines" },
];

const EXPLAIN: { id: ExplainPref; label: string; note: string }[] = [
  { id: "smart", label: "Smart", note: "Adapts to you" },
  { id: "simple", label: "Simple", note: "Like you're five" },
  { id: "standard", label: "Standard", note: "Like you're twelve" },
  { id: "deep", label: "In depth", note: "University level" },
];

export function Me({ profile, top, bottom, onReplayIntro }: { profile: Profile; top: number; bottom: number; onReplayIntro: () => void }) {
  const left = minutesLeft(profile);
  const sessions = profile.topics.reduce((n, t) => n + t.sessions, 0);
  const questions = profile.topics.reduce((n, t) => n + t.questions, 0);
  const streak = softStreak(profile.days);
  return (
    <ScrollView contentContainerStyle={[homeStyles.scroll, { paddingTop: top + 70, paddingBottom: bottom + 130 }]} showsVerticalScrollIndicator={false}>
      <In d={1}>
        <Label style={{ marginTop: 40 }}>What you've done</Label>
        <T size={40} weight="medium" style={{ marginTop: 10, lineHeight: 42 }}>
          <T size={40} weight="mono">
            {profile.topics.length}
          </T>{" "}
          {profile.topics.length === 1 ? "topic" : "topics"}
          {"\n"}explained.
        </T>
      </In>
      <In d={2}>
        <View style={styles.stats}>
          <Stat value={String(sessions)} label="sessions" />
          <Stat value={String(questions)} label="questions answered" />
          <Stat value={mins(profile.secondsUsed)} label="explaining" />
        </View>
        {streak > 1 && (
          <T size={13} tone="soft" style={{ marginTop: 10 }}>
            {streak} days explaining in a row. Missing one day a week is fine.
          </T>
        )}
      </In>

      <In d={3}>
        <Label style={{ marginTop: 28 }}>Minutes</Label>
        <Glass style={styles.plan}>
          <MinutesRing left={left} total={PROTOTYPE_MINUTES} size={140} />
          <View style={{ flex: 1, gap: 4 }}>
            <T size={20} weight="semibold">
              <T size={20} weight="mono">
                {left}
              </T>{" "}
              min left
            </T>
            <T size={13} tone="soft">
              Of {PROTOTYPE_MINUTES} in this prototype. Plans come later.
            </T>
            <T size={12} tone="muted" style={{ marginTop: 4 }}>
              Only your speaking time counts. The student's questions are free.
            </T>
          </View>
        </Glass>
      </In>

      <In d={4}>
        <Label style={{ marginTop: 28 }}>Settings</Label>
        <Glass style={styles.settings}>
          <T size={15}>Session view</T>
          <T size={12.5} tone="muted" style={{ marginTop: 2 }}>
            How Fenny shows up while you explain.
          </T>
          <View style={styles.views} accessibilityRole="radiogroup" accessibilityLabel="Session view">
            {VIEWS.map((v) => {
              const on = (profile.sessionView ?? "light") === v.id;
              return (
                <Press
                  key={v.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={v.label}
                  onPress={() => setSessionView(v.id)}
                  style={[styles.view, on && styles.viewOn]}
                >
                  <ViewIcon id={v.id} size={20} color={on ? colour.text : colour.muted} />
                  <T size={13} tone={on ? "text" : "muted"}>
                    {v.label}
                  </T>
                </Press>
              );
            })}
          </View>

          <T size={15} style={{ marginTop: 22 }}>
            Fenny's voice
          </T>
          <T size={12.5} tone="muted" style={{ marginTop: 2 }}>
            Live streams from the cloud. On this phone downloads once (about 150 MB) and runs offline.
          </T>
          <View style={styles.views} accessibilityRole="radiogroup" accessibilityLabel="Fenny's voice">
            {VOICES.map((v) => {
              const on = (profile.voice ?? "sonic") === v.id;
              return (
                <Press
                  key={v.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${v.label}, ${v.note}`}
                  onPress={() => {
                    setVoice(v.id);
                    warmPhononOnLaunch(v.id);
                  }}
                  style={[styles.view, styles.voice, on && styles.viewOn]}
                >
                  <T size={13.5} tone={on ? "text" : "muted"}>
                    {v.label}
                  </T>
                  <T size={11.5} tone="muted">
                    {v.note}
                  </T>
                </Press>
              );
            })}
          </View>

          <T size={15} style={{ marginTop: 22 }}>
            Replies
          </T>
          <T size={12.5} tone="muted" style={{ marginTop: 2 }}>
            Faster is a trial: Fenny waits less after you stop, you can talk over Fenny with headphones on, and each reply shows how long it took.
          </T>
          <View style={styles.views} accessibilityRole="radiogroup" accessibilityLabel="Replies">
            {([false, true] as const).map((on) => {
              const chosen = !!profile.fastReplies === on;
              const label = on ? "Faster" : "As now";
              return (
                <Press
                  key={label}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: chosen }}
                  accessibilityLabel={label}
                  onPress={() => setFastReplies(on)}
                  style={[styles.view, styles.voice, chosen && styles.viewOn]}
                >
                  <T size={13.5} tone={chosen ? "text" : "muted"}>
                    {label}
                  </T>
                  <T size={11.5} tone="muted">
                    {on ? "Trial" : "Steady"}
                  </T>
                </Press>
              );
            })}
          </View>

          <T size={15} style={{ marginTop: 22 }}>
            Explain things
          </T>
          <T size={12.5} tone="muted" style={{ marginTop: 2 }}>
            How simply Teach me explains. Smart starts plain, offers Simpler if you're still lost, and Go deeper once you've got it.
          </T>
          <View style={[styles.views, { flexWrap: "wrap" }]} accessibilityRole="radiogroup" accessibilityLabel="Explain things">
            {EXPLAIN.map((o) => {
              const chosen = (profile.explainLevel ?? "smart") === o.id;
              return (
                <Press
                  key={o.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: chosen }}
                  accessibilityLabel={o.label}
                  onPress={() => setExplainLevel(o.id)}
                  style={[styles.view, styles.voice, { minWidth: "45%" }, chosen && styles.viewOn]}
                >
                  <T size={13.5} tone={chosen ? "text" : "muted"}>
                    {o.label}
                  </T>
                  <T size={11.5} tone="muted">
                    {o.note}
                  </T>
                </Press>
              );
            })}
          </View>

          <T size={15} style={{ marginTop: 22 }}>
            Drawings
          </T>
          <T size={12.5} tone="muted" style={{ marginTop: 2 }}>
            How the pictures in Teach me are drawn. Alive looks sketched by hand and never quite sits still.
          </T>
          <View style={[styles.views, { flexWrap: "wrap" }]} accessibilityRole="radiogroup" accessibilityLabel="Drawings">
            {DRAWINGS.map((o) => {
              const chosen = (profile.drawStyle ?? "alive") === o.id;
              return (
                <Press
                  key={o.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: chosen }}
                  accessibilityLabel={o.label}
                  onPress={() => setDrawStyle(o.id)}
                  style={[styles.view, styles.voice, { minWidth: "30%" }, chosen && styles.viewOn]}
                >
                  <T size={13.5} tone={chosen ? "text" : "muted"}>
                    {o.label}
                  </T>
                  <T size={11.5} tone="muted">
                    {o.note}
                  </T>
                </Press>
              );
            })}
          </View>
        </Glass>
      </In>

      <In d={5}>
        <Label style={{ marginTop: 28 }}>{profile.name || "You"}</Label>
        <Glass style={{ marginTop: 10, borderRadius: 24 }}>
          <Press onPress={onReplayIntro} style={styles.rowBtn} accessibilityRole="button">
            <T size={15}>Play the intro again</T>
          </Press>
        </Glass>
      </In>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Glass style={{ flex: 1, borderRadius: 20, padding: 14, gap: 2 }}>
      <T size={22} weight="mono" style={{ lineHeight: 26 }}>
        {value}
      </T>
      <T size={12} tone="soft">
        {label}
      </T>
    </Glass>
  );
}

const styles = StyleSheet.create({
  stats: { marginTop: 18, flexDirection: "row", gap: 8 },
  plan: { marginTop: 10, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 10, padding: 8, paddingRight: 16 },
  rowBtn: { paddingVertical: 16, paddingHorizontal: 18 },
  settings: { marginTop: 10, borderRadius: 24, padding: 16 },
  views: { flexDirection: "row", gap: 6, marginTop: 14 },
  view: { flex: 1, height: 72, borderRadius: 18, alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.04)" },
  voice: { height: 64, gap: 2 },
  viewOn: { backgroundColor: "rgba(255,255,255,0.11)" },
});

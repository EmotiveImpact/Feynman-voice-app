// Live session. One voice loop, three ways to see it:
//   light     (S1): the student is the living light in the middle
//   subtitles (S2): the question fills the screen, your voice glows along the bottom
//   chat      (S3): the conversation as bubbles
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setFinishedCall } from "../data/lastCall";
import { findTopic, recordSession, useProfile } from "../data/profile";
import { colour } from "../theme";
import { DotWave } from "../ui/Dots";
import { Backdrop, Icon, Label, PillButton, T } from "../ui/kit";
import { HoldButton } from "../ui/HoldButton";
import { LivingLight } from "../ui/LivingLight";
import { moodFor } from "../ui/mood";
import { useFennyCue } from "../ui/FennyOrb";
import { reactionFor } from "../ui/reactions";
import { GotChip, IdeaBar } from "../ui/IdeaProgress";
import * as Haptics from "expo-haptics";
import { RecordDisc } from "../ui/RecordDisc";
import { ScreenIn } from "../ui/ScreenIn";
import { VoiceGlow } from "../ui/VoiceGlow";
import type { SessionView } from "../live/ViewMenu";
import type { LiveEars, LiveVoice } from "../api";
import { useLiveCall } from "../live/useLiveCall";
import { getNotes } from "../data/notes";
import { LessonGuard } from "../teach/LessonGuard";
import { TeachMode } from "../teach/TeachMode";
import { Press } from "../ui/Press";
import Animated from "react-native-reanimated";
import { riseIn } from "../ui/motion";

type View3 = SessionView;

// Fenny's first words, picked fresh each call so it never opens the same way twice running.
const OPENINGS = [
  "Explain it as if I know nothing. I'll ask when I get lost.",
  "Go on then, teach me. I know nothing about this, so start wherever you like.",
  "I'm all ears. Explain it like I've never heard of it.",
  "Right, I'm ready. Talk me through it from the start.",
  "Okay, I know nothing about this. Where does it begin?",
  "Teach me this one. I'll stop you when I get lost.",
];

// What the button does now (first line) and the next thing to know (second).
const HINTS = {
  loading: ["Getting ready", "Hold the button to end the session"],
  ready: ["Tap to start explaining", "Hold the button to end the session"],
  listening: ["Listening", "Tap when you pause for a question"],
  thinking: ["Thinking of a question", "Keep talking if you weren't finished"],
  speaking: ["Your student is asking", "Tap to answer. Hold to end the session"],
  error: ["Something went wrong", "Hold the button to end the session"],
} as const;

function clock(seconds: number) {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function Session() {
  // A review card opens the session on its own topic and question.
  // A gap card opens it on that gap (focus), with "Go on, tell me in your own words."
  // "Teach me first" (teach=1) opens the lesson straight away, before any explaining.
  const params = useLocalSearchParams<{ topic?: string; prompt?: string; goal?: string; focus?: string; focusId?: string; teach?: string }>();
  const topic = params.topic?.trim() || "Anything you like";
  // Their goal for the topic, in their words, steers Fenny's questions.
  const [goal] = useState(() => params.goal?.trim() || findTopic(topic)?.goal || "");
  const focus = params.focus?.trim() || "";
  // The focus travels separately, so the topic's key ideas stay the same.
  const brainTopic = goal ? `${topic}. What they want to be able to explain: ${goal}` : topic;
  const profile = useProfile();
  const [opening] = useState(() => params.prompt ?? OPENINGS[Math.floor(Math.random() * OPENINGS.length)]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // The view is chosen in Me, under Settings. The session itself has no switch.
  const [view] = useState<View3>(() => profile.sessionView ?? "light");
  // Chosen in Settings (Me): Cartesia Sonic, or Phonon on the phone for demos.
  const [voice] = useState<LiveVoice>(() => profile.voice ?? "sonic");
  const ears: LiveEars = "auto";
  const [fast] = useState(() => !!profile.fastReplies);
  // Pages they scanned for this topic: Fenny uses them to spot what they leave out.
  const [notes] = useState(() => getNotes(topic));
  const loop = useLiveCall(brainTopic, { voice, ears, fast, notes, focus: focus || undefined });
  // Faster-replies trial: how long the last reply took, so we can compare.
  const lastStats = fast ? loop.stats[loop.stats.length - 1] : undefined;

  const spoken = loop.heardSeconds + (loop.phase === "listening" ? loop.liveSpeaking : 0);
  const asked = [...loop.turns].reverse().find((t) => t.speaker === "student")?.text ?? opening;
  const question = loop.liveQuestion ?? asked;
  const lastYou = [...loop.turns].reverse().find((t) => t.speaker === "learner")?.text;

  const studentEnergy = loop.phase === "speaking" ? 1 : loop.phase === "thinking" ? 0.5 : 0;
  // Fenny's eyes: on you while you talk, up while it thinks, and the face for
  // what it is saying while it speaks.
  const mood = moodFor(loop.phase, loop.move);
  // Nodding along while they talk.
  const nod = loop.phase === "listening" && loop.isTalking ? 1 : 0;
  const voiceLevel = loop.phase === "listening" ? (loop.isTalking ? 1 : 0.25) : 0;
  // Fenny's reactions: hello as the call starts, aha when you finish a turn,
  // hmm when it's lost, yay when it gets it. Talking while it speaks.
  const talk = loop.phase === "speaking" ? 1 : 0;
  const [cue, react] = useFennyCue();
  const was = useRef({ phase: loop.phase as string, move: loop.move });
  useEffect(() => {
    const next = { phase: loop.phase as string, move: loop.move };
    const r = reactionFor(was.current, next);
    was.current = next;
    if (r) react(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop.phase, loop.move]);
  // The got it moment: each key idea they nail gets a hop, a buzz and a chip.
  useEffect(() => {
    if (!loop.got) return;
    react("yay");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop.got?.n]);

  // Gently animate the dot wave while you talk.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (loop.phase !== "listening") return;
    const id = setInterval(() => setTick((t) => t + 0.6), 120);
    return () => clearInterval(id);
  }, [loop.phase]);

  // The ring starts the call, sends the turn early, or cuts the student off.
  // Holding it ends the session.
  const canTap = loop.phase !== "loading";
  const onRing =
    loop.phase === "listening"
      ? loop.finish
      : loop.phase === "thinking" || loop.phase === "speaking"
        ? loop.interrupt
        : // First start: Fenny says its opening question out loud.
          () => loop.start(loop.turns.length ? undefined : opening).catch(() => {});
  const ringIcon = loop.phase === "listening" ? "check" : loop.phase === "thinking" || loop.phase === "speaking" ? "pause" : "mic";
  const ringLabel =
    loop.phase === "listening" ? "Done, ask me" : loop.phase === "thinking" || loop.phase === "speaking" ? "Cut in" : "Start the call";
  // Stop the microphone, any pending turn and any reply before leaving.
  // Save the topic and the speaking time, then on to the results (gap
  // analysis), or back to Today if nothing was said.
  // Saved once, whether you tap End, close, or go back with the system.
  const saved = useRef(false);
  const latest = useRef({ spoken, questions: 0, ideas: [] as { id: string; idea: string; label?: string }[], covered: [] as string[] });
  latest.current = { spoken, questions: loop.turns.filter((t) => t.speaker === "student").length, ideas: loop.ideas, covered: loop.covered };
  const save = useCallback(() => {
    if (saved.current) return;
    saved.current = true;
    const l = latest.current;
    recordSession(topic, l.spoken, l.questions, goal, l.ideas.length ? { ideas: l.ideas, covered: l.covered } : undefined);
  }, [topic, goal]);
  useEffect(() => save, [save]);
  const end = () => {
    loop.cancel();
    save();
    if (loop.turns.some((t) => t.speaker === "learner" && t.text.trim())) {
      setFinishedCall({
        topic,
        goal,
        focus: focus || undefined,
        focusId: params.focusId,
        turns: loop.turns,
        seconds: latest.current.spoken,
        shakiest: loop.shakiest ?? undefined,
        missedIdeas: loop.ideas.filter((i) => !loop.covered.includes(i.id)).map((i) => i.idea),
      });
      router.replace("/results");
    } else router.back();
  };
  // Teach me: the call steps aside for a short lesson on the stuck idea.
  // Opened with "Teach me first": the lesson is up before anything else.
  const [teaching, setTeaching] = useState<{ idea: string; said?: string } | null>(() => (params.teach === "1" ? { idea: firstIdea(topic, focus) } : null));
  const openTeach = () => {
    if (!loop.teach) return;
    loop.cancel();
    setTeaching({ idea: loop.teach.idea, said: lastYou });
  };
  // Teach me first: a lesson on the whole topic (or the gap they came for)
  // before they explain anything, with no need to tell Fenny they're new to it.
  const callStarted = loop.turns.length > 0;
  const teachFirst = () => {
    loop.cancel();
    setTeaching({ idea: firstIdea(topic, focus) });
  };
  const offerTeachFirst = !callStarted && !teaching && (loop.phase === "ready" || loop.phase === "loading");
  const closeTeach = () => {
    setTeaching(null);
    loop.dismissTeach();
    // Left a lesson they opened before the call: back to the start, mic still off.
    if (callStarted) loop.start().catch(() => {});
  };
  // They said yes out loud: open it once Fenny has finished speaking.
  useEffect(() => {
    if (loop.teach?.open && !teaching && loop.phase === "listening") openTeach();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop.teach, loop.phase]);
  const offerTeach = !!loop.teach && !loop.teach.open && !teaching && (loop.phase === "listening" || loop.phase === "speaking");

  // Fenny said goodbye: save and leave, as if they tapped End.
  useEffect(() => {
    if (loop.finished) end();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop.finished]);

  return (
    <ScreenIn style={styles.root}>
      <Backdrop scene="session" />
      {view === "light" && (
        <>
          <VoiceGlow level={voiceLevel} height={230} dim />
          {/* Calm and empty, like a voice mode: one small living light and
              one line in the middle of the screen, nothing else lit. */}
          <View style={[StyleSheet.absoluteFill, styles.centre, { justifyContent: "center", paddingBottom: 140 }]} pointerEvents="box-none">
            <LivingLight size={120} energy={studentEnergy} mood={mood} nod={nod} talk={talk} cue={cue} touchable />
            <T size={22} weight="medium" style={{ textAlign: "center", marginTop: 26, maxWidth: 320, lineHeight: 30 }}>
              {question}
            </T>
          </View>
        </>
      )}

      {view === "subtitles" && (
        <>
          <VoiceGlow level={voiceLevel} height={260} />
          <View style={{ paddingTop: insets.top + 130, paddingHorizontal: 26 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <LivingLight size={30} energy={studentEnergy} mood={mood} nod={nod} talk={talk} cue={cue} />
              <Label tone="student">Student</Label>
            </View>
            <T size={36} weight="medium" style={{ marginTop: 14, lineHeight: 40 }}>
              {question}
            </T>
            {lastYou ? (
              <T size={16} tone="dim" style={{ marginTop: 28 }} lines={3}>
                You: {lastYou}
              </T>
            ) : null}
          </View>
        </>
      )}

      {view === "chat" && (
        <>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingTop: insets.top + 130, paddingBottom: 200, paddingHorizontal: 20, gap: 14, flexGrow: 1, justifyContent: "flex-end" }}
          >
            {(loop.turns.length ? loop.turns : [{ speaker: "student" as const, text: opening }]).map((t, i) =>
              t.speaker === "student" ? (
                <View key={i} style={styles.studentRow}>
                  <LivingLight
                    size={34}
                    energy={i === loop.turns.length - 1 ? studentEnergy : 0}
                    // Only the latest question has a face; older ones rest.
                    mood={i === loop.turns.length - 1 || !loop.turns.length ? mood : "rest"}
                    nod={i === loop.turns.length - 1 ? nod : 0}
                    talk={i === loop.turns.length - 1 ? talk : 0}
                    cue={i === loop.turns.length - 1 ? cue : null}
                  />
                  <View style={styles.studentBubble}>
                    <T size={16.5}>{t.text}</T>
                  </View>
                </View>
              ) : (
                <View key={i} style={styles.youBubble}>
                  <T size={16.5} tone="soft">
                    {t.text}
                  </T>
                </View>
              ),
            )}
          </ScrollView>
        </>
      )}

      {/* Top: subject and time centred. No buttons: the view is set in Me. */}
      <View style={[styles.top, { top: insets.top + 8 }]}>
        <View style={styles.topRow}>
          <View style={styles.side} />
          <View style={styles.title}>
            <T size={11} weight="mono" tone="muted" style={{ letterSpacing: 1.5 }}>
              TEACHING · {clock(spoken)}
            </T>
            <T size={15} weight="semibold" lines={1} style={{ textAlign: "center" }}>
              {topic}
            </T>
          </View>
          <View style={styles.side} />
        </View>
        {/* The topic's key ideas, filling as they explain each one. */}
        <IdeaBar total={loop.ideas.length} done={loop.covered.length} />
        <GotChip got={loop.got} />
      </View>

      {/* Teach me, when Fenny can tell this bit is new to them. */}
      {offerTeach && (
        <Animated.View entering={riseIn()} style={[styles.offer, { bottom: Math.max(insets.bottom, 12) + 150 }]}>
          <PillButton label="Teach me" variant="solid" onPress={openTeach} style={{ alignSelf: "stretch" }} />
          <Press accessibilityRole="button" accessibilityLabel="Not now, keep going" onPress={loop.dismissTeach} hitSlop={8} style={{ paddingVertical: 8 }}>
            <T size={14} tone="soft">
              Not now, keep going
            </T>
          </Press>
        </Animated.View>
      )}

      {/* Before the call starts: skip straight to a lesson if the topic is new to them. */}
      {offerTeachFirst && (
        <Animated.View entering={riseIn()} style={[styles.offer, { bottom: Math.max(insets.bottom, 12) + 150 }]}>
          <PillButton label="New to this? Teach me first" accessibilityLabel="Teach me first: a short lesson before you explain" onPress={teachFirst} style={{ alignSelf: "stretch" }} />
        </Animated.View>
      )}

      {/* One button at the bottom, with no panel: what it does sits just above it. */}
      <View pointerEvents="box-none" style={[styles.controls, { bottom: Math.max(insets.bottom, 12) + 8 }]}>
        {lastStats ? (
          <T size={11.5} tone="muted" lines={1} style={{ textAlign: "center", marginBottom: 6 }}>
            {`Last reply ${secs(lastStats.quietSeconds * 1000 + lastStats.firstWordMs)}: wait ${secs(lastStats.quietSeconds * 1000)}, hearing ${secs(lastStats.transcribeMs)}, thinking ${secs(lastStats.brainMs)}`}
          </T>
        ) : null}
        {/* One quiet line: what is happening, or the dots while you talk. */}
        <View style={styles.hintLine}>
          {loop.phase === "listening" ? (
            <DotWave width={Math.min(200, width - 80)} height={20} level={loop.isTalking ? 1 : 0.3} tick={tick} />
          ) : (
            <T size={13.5} tone="soft" lines={1} style={{ textAlign: "center" }}>
              {loop.phase === "error" && loop.error ? loop.error : loop.notice ?? HINTS[loop.phase][0]}
            </T>
          )}
        </View>
        <HoldButton size={76} label={ringLabel} onTap={canTap ? onRing : undefined} onHold={end}>
          {(hold) => (
            <View style={{ opacity: canTap ? 1 : 0.4 }}>
              <RecordDisc size={76} listening={loop.phase === "listening"} hold={hold}>
                <Icon name={ringIcon} size={26} color={colour.onLight} />
              </RecordDisc>
            </View>
          )}
        </HoldButton>
      </View>

      {teaching && (
        <LessonGuard onClose={closeTeach}>
          <TeachMode
            topic={topic}
            notes={notes}
            idea={teaching.idea}
            said={teaching.said}
            speak={loop.speak}
            hush={loop.hush}
            level={profile.explainLevel ?? "smart"}
            onClose={closeTeach}
            onDone={(q) => {
              setTeaching(null);
              loop.resumeAfterLesson(q);
            }}
          />
        </LessonGuard>
      )}
    </ScreenIn>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colour.ground },
  centre: { alignItems: "center", paddingHorizontal: 24 },
  top: { position: "absolute", left: 16, right: 16, gap: 14 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  side: { width: 52 },
  title: { flex: 1, minWidth: 0, alignItems: "center", gap: 4 },
  controls: { position: "absolute", left: 24, right: 24, alignItems: "center", gap: 4 },
  offer: { position: "absolute", left: 40, right: 40, alignItems: "center", gap: 6 },
  hintLine: { height: 26, justifyContent: "center", marginBottom: 14 },
  studentRow: { alignSelf: "flex-start", flexDirection: "row", alignItems: "flex-end", gap: 10, maxWidth: 320 },
  studentBubble: {
    flexShrink: 1,
    padding: 15,
    borderRadius: 22,
    borderBottomLeftRadius: 6,
    backgroundColor: "rgba(169,190,230,0.12)",
    borderWidth: 1,
    borderColor: "rgba(169,190,230,0.22)",
  },
  youBubble: {
    alignSelf: "flex-end",
    maxWidth: 300,
    padding: 15,
    borderRadius: 22,
    borderBottomRightRadius: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: colour.hairline,
  },
});

/** 1234 ms as "1.2 s". */
function secs(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

/** What a "Teach me first" lesson covers: the gap they came for, or the basics of the topic. */
function firstIdea(topic: string, focus: string): string {
  return focus || `The basics of ${topic}`;
}

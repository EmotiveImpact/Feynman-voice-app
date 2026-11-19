// After the call, from the canvas board "THE APP: start here" (analysing,
// feedback summary, gap cards, done), with the rules in
// docs/behavioural-design.md:
//   1. On calls of about 3 minutes or more, Fenny asks "Which bit felt
//      shakiest to you?" first. Their answer is the first gap card, in their words.
//   2. "Show me" gives a short explanation from their notes and always hands
//      back with "Now tell Fenny in your own words". It never closes the card.
//   3. Results lead with what they explained well, quoting them, then the gaps.
//   4. "Then and now": a line from their first attempt beside this one.
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, FadeOutLeft, SlideInRight } from "react-native-reanimated";
import { analyseCall, showMe, type Analysis, type Gap } from "../api";
import { clearFinishedCall, getFinishedCall, SHAKIEST_MIN_SECONDS, TELL_ME, TELL_ME_BUTTON, type FinishedCall } from "../data/lastCall";
import { getNotes } from "../data/notes";
import { findTopic, minutesLeft, saveAnalysis, useProfile, type SavedGap } from "../data/profile";
import { colour, font } from "../theme";
import { Backdrop, Glass, Label, PillButton, T } from "../ui/kit";
import { LivingLight } from "../ui/LivingLight";
import { spring } from "../ui/motion";

const gapArt = require("../../assets/images/card-gap.webp");
const skippedArt = require("../../assets/images/card-review.webp");

type Phase = "shakiest" | "analysing" | "summary" | "gaps" | "done" | "error";

export default function Results() {
  const [call] = useState(getFinishedCall);
  if (!call) return <Redirect href="/" />;
  return <ResultsFor call={call} />;
}

function ResultsFor({ call }: { call: FinishedCall }) {
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  // Fenny asks "which bit felt shakiest?" in the call now; the typed screen is
  // only for calls that ended before it got there.
  const [phase, setPhase] = useState<Phase>(!call.shakiest && call.seconds >= SHAKIEST_MIN_SECONDS ? "shakiest" : "analysing");
  const [shakiest, setShakiest] = useState(call.shakiest ?? "");
  const [result, setResult] = useState<Analysis | null>(null);
  const [cards, setCards] = useState<SavedGap[]>([]);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const started = useRef(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const notes = getNotes(call.topic);
  const learnerText = call.turns
    .filter((t) => t.speaker === "learner")
    .map((t) => t.text)
    .join(" ");

  const analyse = useCallback(async () => {
    setPhase("analysing");
    setError("");
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    const before = findTopic(call.topic);
    // "Then and now" compares with the first time, so only once there was one.
    const firstAttempt = before && before.sessions > 1 ? before.firstAttempt : undefined;
    try {
      const a = await analyseCall(
        { topic: call.topic, goal: call.goal, notes, turns: call.turns, shakiest: shakiest.trim() || undefined, firstAttempt, focus: call.focus, missedIdeas: call.missedIdeas },
        ctl.signal,
      );
      if (ctl.signal.aborted) return;
      const saved = saveAnalysis(call.topic, a, { focusId: call.focusId, attempt: learnerText });
      clearFinishedCall();
      setResult(a);
      setCards(saved.length ? saved : a.gaps.map((g, i) => ({ ...g, id: String(i), at: Date.now() })));
      setPhase("summary");
    } catch (e) {
      if (ctl.signal.aborted) return;
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [call, shakiest, learnerText]);

  useEffect(() => {
    if (phase === "analysing" && !started.current) {
      started.current = true;
      analyse();
    }
  }, [phase, analyse]);

  const home = () => router.replace("/");
  const explainAgain = (g: Gap & { id: string }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.replace({ pathname: "/session", params: { topic: call.topic, prompt: TELL_ME, focus: g.title, focusId: g.id } });
  };

  return (
    <View style={styles.root}>
      <Backdrop scene="session" />
      <LinearGradient
        colors={["rgba(10,11,13,0.15)", "rgba(10,11,13,0.35)", "rgba(10,11,13,0.92)", colour.ground]}
        locations={[0, 0.4, 0.78, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {phase === "shakiest" && (
        <Shakiest
          top={insets.top}
          bottom={insets.bottom}
          value={shakiest}
          onChange={setShakiest}
          onDone={() => {
            started.current = false;
            setPhase("analysing");
          }}
        />
      )}

      {phase === "analysing" && (
        <Animated.View entering={FadeIn.duration(400)} style={[styles.centre, { paddingHorizontal: 28 }]}>
          <LivingLight size={120} energy={1} />
          <T size={30} weight="medium" style={{ marginTop: 34, textAlign: "center" }}>
            {notes ? "Checking what you said against your notes" : "Going back over what you said"}
          </T>
          <View style={{ marginTop: 28, gap: 12, alignSelf: "center" }}>
            <T size={15} tone="soft">
              ✓ {duration(call.seconds)} of explaining
            </T>
            {shakiest.trim() ? (
              <T size={15} tone="soft">
                ✓ You named the shakiest bit
              </T>
            ) : null}
            <T size={15} tone="muted">
              Finding the gaps…
            </T>
          </View>
        </Animated.View>
      )}

      {phase === "error" && (
        <Animated.View entering={FadeIn} style={[styles.centre, { paddingHorizontal: 28 }]}>
          <T size={28} weight="medium" style={{ textAlign: "center" }}>
            I couldn't check this one.
          </T>
          <T size={15} tone="soft" style={{ marginTop: 12, textAlign: "center" }}>
            Your time is saved. {error}
          </T>
          <PillButton label="Try again" variant="solid" onPress={analyse} style={{ marginTop: 32, alignSelf: "stretch" }} />
          <PillButton
            label="Back to today"
            onPress={() => {
              clearFinishedCall();
              home();
            }} style={{ marginTop: 10, alignSelf: "stretch", backgroundColor: "transparent", borderWidth: 0 }} />
        </Animated.View>
      )}

      {phase === "summary" && result && (
        <Summary
          top={insets.top}
          bottom={insets.bottom}
          topic={call.topic}
          result={result}
          gaps={cards}
          focus={call.focus}
          onGaps={() => {
            setIndex(0);
            setPhase(cards.length ? "gaps" : "done");
          }}
          onLater={() => setPhase("done")}
        />
      )}

      {phase === "gaps" && cards[index] && (
        <View style={[styles.page, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.rowBetween}>
            <Label>
              {cards[index].named ? "Your shaky bit" : `Gap ${index + 1} of ${cards.length}`}
            </Label>
            <Pressable onPress={() => setPhase("done")} accessibilityRole="button" hitSlop={12}>
              <T size={14} tone="soft">
                Done for now
              </T>
            </Pressable>
          </View>
          <GapCard
            key={cards[index].id}
            gap={cards[index]}
            topic={call.topic}
            notes={notes}
            turns={call.turns}
            onExplain={() => explainAgain(cards[index])}
            onNext={() => (index + 1 < cards.length ? setIndex(index + 1) : setPhase("done"))}
            last={index + 1 >= cards.length}
          />
        </View>
      )}

      {phase === "done" && (
        <Animated.View entering={FadeIn.duration(400)} style={[styles.centre, { paddingHorizontal: 28, paddingBottom: insets.bottom + 34 }]}>
          <LivingLight size={140} />
          <T size={32} weight="medium" style={{ marginTop: 30, textAlign: "center" }}>
            {cards.length
              ? `Nice work. ${cards.length === 1 ? "Your gap is" : `Your ${cards.length} gaps are`} waiting on Today.`
              : "Nice work. Nothing to go over this time."}
          </T>
          <T size={15} tone="soft" style={{ marginTop: 14, textAlign: "center" }}>
            That session used {duration(call.seconds)}. You have {minutesLeft(profile)} min left.
          </T>
          <PillButton label="Back to today" variant="solid" onPress={home} style={{ marginTop: 40, alignSelf: "stretch" }} />
        </Animated.View>
      )}
    </View>
  );
}

// 1. "Which bit felt shakiest to you?" -----------------------------------------

function Shakiest({ top, bottom, value, onChange, onDone }: { top: number; bottom: number; value: string; onChange: (v: string) => void; onDone: () => void }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={[styles.page, { paddingTop: top + 90, paddingBottom: Math.max(bottom, 16) }]}>
        <Rise d={0}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <LivingLight size={34} energy={0.6} />
            <Label tone="student">Fenny</Label>
          </View>
        </Rise>
        <Rise d={1}>
          <T size={36} weight="medium" style={{ marginTop: 18 }}>
            Thanks for teaching me. Which bit felt shakiest to you?
          </T>
          <T size={15} tone="soft" style={{ marginTop: 12 }}>
            Say it in a few words. It goes first on your list.
          </T>
        </Rise>
        <Rise d={2}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="The bit about…"
            placeholderTextColor={colour.textDim}
            returnKeyType="done"
            onSubmitEditing={onDone}
            multiline
            blurOnSubmit
            autoFocus
            maxLength={200}
            style={styles.input}
            accessibilityLabel="Which bit felt shakiest to you?"
          />
        </Rise>
        <View style={{ flex: 1 }} />
        <PillButton label={value.trim() ? "That's the bit" : "Not sure, you find them"} variant={value.trim() ? "solid" : "glass"} onPress={onDone} />
      </View>
    </KeyboardAvoidingView>
  );
}

// 2. Summary: what came across clearly first, then the gaps ---------------------

function Summary({
  top,
  bottom,
  topic,
  result,
  gaps,
  focus,
  onGaps,
  onLater,
}: {
  top: number;
  bottom: number;
  topic: string;
  result: Analysis;
  gaps: Gap[];
  focus?: string;
  onGaps: () => void;
  onLater: () => void;
}) {
  const good = result.strengths.length;
  const n = gaps.length;
  const strip = [
    ...result.strengths.map(() => "#C3D0EA"),
    ...gaps.map((g) => (g.kind === "skipped" ? "rgba(169,190,230,0.3)" : colour.gap)),
  ];
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: top + 44, paddingBottom: 190 }]} showsVerticalScrollIndicator={false}>
        <Rise d={0}>
          <Label>Session done · {topic}</Label>
          <T size={36} weight="medium" style={{ marginTop: 16, lineHeight: 38 }}>
            <T size={36} weight="medium" tone="dim">
              {good === 0 ? "Thanks for explaining." : good === 1 ? "One thing came across clearly." : `${words(good)} things came across clearly.`}
            </T>
            {"\n"}
            {n === 0 ? "Nothing needs another go." : n === 1 ? "One needs another go." : `${words(n)} need another go.`}
          </T>
        </Rise>

        {strip.length > 0 && (
          <Rise d={1}>
            <View style={styles.strip} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {strip.map((c, i) => (
                <View key={i} style={[styles.bar, { backgroundColor: c }]} />
              ))}
            </View>
          </Rise>
        )}

        {focus && result.focusExplained && (
          <Rise d={2}>
            <Glass style={styles.panel}>
              <Label tone="student">Gap closed</Label>
              <T size={16} style={{ marginTop: 6 }}>
                You've got it now: {focus}
              </T>
            </Glass>
          </Rise>
        )}

        {good > 0 && (
          <Rise d={2}>
            <Label style={{ marginTop: 26 }}>What came across clearly</Label>
            {result.strengths.map((s, i) => (
              <View key={i} style={styles.line}>
                <View style={[styles.dot, { backgroundColor: colour.clear }]} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T size={15.5}>{s.title}</T>
                  <T size={14} tone="soft">
                    You said: "{s.quote}"
                  </T>
                </View>
              </View>
            ))}
          </Rise>
        )}

        {result.thenAndNow && (
          <Rise d={3}>
            <Glass style={styles.panel}>
              <Label>Then and now</Label>
              <T size={14} tone="muted" style={{ marginTop: 10 }}>
                First time: "{result.thenAndNow.then}"
              </T>
              <T size={15.5} style={{ marginTop: 8 }}>
                Today: "{result.thenAndNow.now}"
              </T>
            </Glass>
          </Rise>
        )}

        {n > 0 && (
          <Rise d={4}>
            <Label style={{ marginTop: 26 }}>Another go</Label>
            {gaps.map((g, i) => (
              <View key={i} style={styles.line}>
                <View style={[styles.dot, { backgroundColor: g.kind === "skipped" ? colour.student : colour.gap }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={15.5} style={{ lineHeight: 21 }}>
                    {g.title}
                  </T>
                  <T size={13} style={{ color: g.kind === "skipped" ? "#B4C4E4" : "#E5A794" }}>
                    {g.named ? "You named it" : KIND[g.kind]}
                  </T>
                </View>
              </View>
            ))}
          </Rise>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(bottom, 16) }]}>
        {/* Content fades out before it reaches the buttons. */}
        <LinearGradient pointerEvents="none" colors={["rgba(8,9,11,0)", colour.ground]} style={styles.fade} />
        <PillButton label={n === 0 ? "Finish" : n === 1 ? "Go through the gap" : `Go through the ${n} gaps`} variant="solid" onPress={onGaps} style={{ height: 58 }} />
        {n > 0 && <PillButton label="Save them for later" onPress={onLater} style={{ marginTop: 4, backgroundColor: "transparent", borderWidth: 0 }} />}
      </View>
    </View>
  );
}

const KIND: Record<Gap["kind"], string> = { gap: "Gap", muddled: "Not quite", skipped: "Skipped" };

// 3. One gap card, with "Show me" ------------------------------------------------

function GapCard({
  gap,
  topic,
  notes,
  turns,
  onExplain,
  onNext,
  last,
}: {
  gap: Gap;
  topic: string;
  notes?: string;
  turns: FinishedCall["turns"];
  onExplain: () => void;
  onNext: () => void;
  last: boolean;
}) {
  const [shown, setShown] = useState<{ explanation: string; fromNotes: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const tone = gap.kind === "skipped" ? colour.student : "#F5B09A";

  const reveal = async () => {
    setLoading(true);
    setErr("");
    try {
      setShown(await showMe({ topic, gap: { title: gap.title, detail: gap.detail }, notes, turns }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Animated.View entering={SlideInRight.springify().duration(spring.bouncy.duration).dampingRatio(spring.bouncy.dampingRatio)} exiting={FadeOutLeft} style={styles.card}>
      <Image source={gap.kind === "skipped" ? skippedArt : gapArt} contentFit="cover" style={[StyleSheet.absoluteFill, { opacity: 0.75 }]} accessibilityElementsHidden />
      <LinearGradient colors={["rgba(10,11,13,0)", "rgba(10,11,13,0.85)", "rgba(10,11,13,0.95)"]} locations={[0.2, 0.62, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.cardInner}>
        <View style={styles.rowBetween}>
          <View style={styles.chip}>
            <T size={13} style={{ color: tone }}>
              {gap.named ? "You named it" : KIND[gap.kind]}
            </T>
          </View>
          {gap.source && !gap.named ? (
            <View style={styles.chip}>
              <T size={13} lines={1}>
                {gap.source}
              </T>
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }} />
        <ScrollView style={{ flexGrow: 0, maxHeight: 330 }} showsVerticalScrollIndicator={false}>
          <T size={26} weight="semibold" style={{ lineHeight: 30 }}>
            {gap.title}
          </T>
          {gap.detail ? (
            <T size={14.5} tone="soft" style={{ marginTop: 12 }}>
              {gap.detail}
            </T>
          ) : null}
          {/* A wrong idea is set right here, since Fenny never explains. */}
          {gap.correction ? (
            <View style={styles.shown}>
              <Label tone="student">The right version</Label>
              <T size={15.5} style={{ marginTop: 8 }}>
                {gap.correction}
              </T>
            </View>
          ) : null}
          {shown && (
            <Animated.View entering={FadeInDown.springify().duration(spring.smooth.duration).dampingRatio(spring.smooth.dampingRatio)} style={styles.shown}>
              <Label tone={shown.fromNotes ? "student" : "muted"}>{shown.fromNotes ? "From your notes" : "A quick explanation"}</Label>
              <T size={15.5} style={{ marginTop: 8 }}>
                {shown.explanation}
              </T>
              {!shown.fromNotes && (
                <T size={12.5} tone="muted" style={{ marginTop: 8 }}>
                  {notes ? "Your notes don't cover this, so check it against your course." : "You haven't added notes for this topic, so check it against your course."}
                </T>
              )}
            </Animated.View>
          )}
          {err ? (
            <T size={13} tone="gap" style={{ marginTop: 10 }}>
              {err}
            </T>
          ) : null}
        </ScrollView>
        {/* Show me never closes the card: it hands the pen straight back. */}
        <PillButton label={shown ? TELL_ME_BUTTON : "Explain it again now"} variant="solid" onPress={onExplain} style={{ marginTop: 20 }} />
        {!shown && (
          <Pressable onPress={reveal} disabled={loading} accessibilityRole="button" style={styles.showMe} hitSlop={6}>
            {loading ? <ActivityIndicator color={colour.soft} /> : <T size={14} tone="soft">Show me</T>}
          </Pressable>
        )}
        <PillButton label={last ? "Add to review, finish" : "Add to review, next"} onPress={onNext} style={{ marginTop: shown ? 10 : 0, height: 48 }} />
      </View>
    </Animated.View>
  );
}

// Bits ---------------------------------------------------------------------------

function Rise({ d, children }: { d: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(60 + d * 80).springify().duration(spring.smooth.duration).dampingRatio(spring.smooth.dampingRatio)}>
      {children}
    </Animated.View>
  );
}

function duration(seconds: number) {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
}

const WORDS = ["None", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"];
const words = (n: number) => WORDS[n] ?? String(n);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colour.ground },
  centre: { flex: 1, alignItems: "center", justifyContent: "center" },
  page: { flex: 1, paddingHorizontal: 20 },
  scroll: { paddingHorizontal: 24 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  strip: { marginTop: 26, flexDirection: "row", gap: 5 },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 15, borderTopWidth: 1, borderTopColor: colour.hairlineSoft },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  panel: { marginTop: 22, borderRadius: 24, padding: 16 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingTop: 8, backgroundColor: colour.ground },
  fade: { position: "absolute", left: 0, right: 0, top: -44, height: 44 },
  input: {
    marginTop: 24,
    minHeight: 64,
    maxHeight: 140,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    fontSize: 18,
    color: colour.text,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: colour.hairline,
    fontFamily: font.regular,
  },
  card: { flex: 1, marginTop: 20, borderRadius: 32, overflow: "hidden", backgroundColor: "#120A09", borderWidth: 1, borderColor: colour.hairline },
  cardInner: { flex: 1, padding: 22 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(20,21,24,0.85)", borderWidth: 1, borderColor: colour.hairline, maxWidth: 200 },
  shown: { marginTop: 16, padding: 14, borderRadius: 20, backgroundColor: "rgba(169,190,230,0.10)", borderWidth: 1, borderColor: "rgba(169,190,230,0.22)" },
  showMe: { height: 48, alignItems: "center", justifyContent: "center" },
});

// Teach me: when the learner clearly doesn't know a bit yet, the call steps
// aside for a two minute lesson on just that idea. A few bites, each with a
// picture and a quick puzzle, built from their notes on the server. Then
// back to Fenny to explain it in their own words. Each bite's picture is a
// live drawing from the scene kit (scene/), and one bite may add a slider so
// the learner can play with the idea before the puzzle. Fenny never teaches: this
// screen is the notes talking, and Fenny only listens again afterwards.
//
// When a lesson has drawings it plays as a short narrated film first: the
// bites one after another, each sentence building the next part of the
// drawing so it lands on the word that names it. One bite stops before its
// last sentence to ask what will happen, so the student commits to a guess
// before seeing it. Then the slider, the puzzles and the explain back, as
// before. Lessons without drawings keep the cards.
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from "react-native";
import Animated, { cancelAnimation, Easing, FadeIn, FadeOut, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { buildAfter, estimateMs, filmLines, rampFor, type FilmLine } from "@feynman/audio";
import { fetchLesson, type Lesson, type LessonBite, type LessonLevel } from "../api";
import type { ExplainPref } from "../data/profile";

/** What Fenny asks when they're back: worded a little differently each time. */
const WELCOME = ["Welcome back!", "Right, you're back.", "Okay, over to you.", "Nice one.", "Ready when you are."];
import type { SpeakOptions } from "../live/useLiveCall";
import { colour } from "../theme";
import { Backdrop, Label, PillButton, Stat, T } from "../ui/kit";
import { LivingLight } from "../ui/LivingLight";
import { useFennyCue } from "../ui/FennyOrb";
import { Press } from "../ui/Press";
import { riseIn, STAGGER_MS } from "../ui/motion";
import { Picture } from "./Picture";
import { Puzzle } from "./Puzzle";
import { SceneView } from "./scene/SceneView";
import { canDraw } from "./scene/types";
import { Slider } from "./Slider";

type Step = { kind: "watch" } | { kind: "read"; i: number } | { kind: "play"; i: number } | { kind: "try"; i: number } | { kind: "finish" };
type Guess = NonNullable<LessonBite["guess"]>;

const stepKey = (s: Step) => ("i" in s ? `${s.kind}${s.i}` : s.kind);

/** A lesson with any drawing plays as a film; one with none keeps the cards. */
const isFilm = (lesson: Lesson) => lesson.bites.some((b) => b.scene);

/**
 * Every step of a lesson in order. Film: the narrated film, then any slider,
 * then a puzzle for each bite. Cards: read, maybe play, then the puzzle, for each bite.
 */
function stepsOf(lesson: Lesson): Step[] {
  if (isFilm(lesson)) {
    return [{ kind: "watch" }, ...lesson.bites.flatMap((b, i): Step[] => (b.play && b.scene ? [{ kind: "play", i }] : [])), ...lesson.bites.map((_, i): Step => ({ kind: "try", i }))];
  }
  return lesson.bites.flatMap((b, i): Step[] => [{ kind: "read", i }, ...(b.play && b.scene ? [{ kind: "play" as const, i }] : []), { kind: "try", i }]);
}

export function TeachMode({
  topic,
  idea,
  said,
  notes,
  onClose,
  onDone,
  speak,
  hush,
  level = "smart",
}: {
  topic: string;
  idea: string;
  said?: string;
  notes?: string;
  /** Leave without finishing: back to the call as it was. */
  onClose: () => void;
  /** Finished: Fenny's question about what they just learnt. */
  onDone: (question: string) => void;
  /** Read a line aloud in Fenny's chosen voice (Cartesia or Phonon). onStart times the film's drawing. */
  speak?: (text: string, opts?: SpeakOptions) => Promise<void>;
  /** Stop reading aloud. */
  hush?: () => void;
  /** How simply to explain, from Settings in Me. Smart starts plain and offers Simpler or Go deeper. */
  level?: ExplainPref;
}) {
  const [lvl, setLvl] = useState<LessonLevel>(level === "smart" ? "standard" : level);
  const insets = useSafeAreaInsets();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: "read", i: 0 });
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [right, setRight] = useState(0);
  // Fenny reacts to each puzzle answer, and cheers at the end.
  const [cue, react] = useFennyCue();
  // The finish screen's Fenny mounts after the last puzzle's cue, so cheer afresh.
  useEffect(() => {
    if (step.kind !== "finish") return;
    const id = setTimeout(() => react("yay"), 450);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);
  const [attempt, setAttempt] = useState(0);
  const scroll = useRef<ScrollViewInstance>(null);
  const slider = useSharedValue(0);
  const [band, setBand] = useState(0);
  const [played, setPlayed] = useState(false);
  const reduce = useReducedMotion();

  // The film: which bite is on screen, what Fenny is saying, and the guess.
  const [filmBite, setFilmBite] = useState(0);
  const [sub, setSub] = useState("");
  const [asking, setAsking] = useState<Guess | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [biteDone, setBiteDone] = useState(false);
  const [filmOver, setFilmOver] = useState(false);
  const [filmRun, setFilmRun] = useState(0);
  // Two sets, used by alternate bites, so the last picture can fade out at
  // its own build while the next one draws.
  const buildA = useSharedValue(0);
  const buildB = useSharedValue(0);
  const movingA = useSharedValue(0);
  const movingB = useSharedValue(0);
  const pick = useRef<((option: string) => void) | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    setError(null);
    setLesson(null);
    setRight(0);
    setAnswered(null);
    fetchLesson({ topic, idea, said, notes, level: lvl }, abort.signal)
      .then((raw) => {
        // A newer server may send drawings this build cannot draw yet: those
        // bites use the simple diagram instead.
        const l = { ...raw, bites: raw.bites.map((b) => (canDraw(b.scene) ? b : { ...b, scene: null, play: null })) };
        setLesson(l);
        setStep(stepsOf(l)[0] ?? { kind: "finish" });
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(String(e instanceof Error ? e.message : e));
      });
    return () => abort.abort();
  }, [topic, idea, said, notes, attempt, lvl]);

  // Fenny reads each bite aloud as it appears, in the voice chosen in Me.
  useEffect(() => {
    if (!lesson || !speak) return;
    // The finish is said once back in the call, as Fenny's question.
    if (step.kind === "read") {
      const b = lesson.bites[step.i];
      speak(`${b.title}. ${b.text}`);
    } else if (step.kind === "play") {
      const p = lesson.bites[step.i].play;
      if (p) speak(p.prompt);
    }
    return () => hush?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, step]);

  // The film. Each line is spoken in Fenny's voice; when its sound starts,
  // the drawing builds its next part so it arrives just before the cue word.
  // Nothing in the drawing moves until the last line of a bite, the one that
  // names the change. Without a voice it runs on subtitles at speaking pace.
  useEffect(() => {
    if (!lesson || step.kind !== "watch") return;
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(() => alive && fn(), ms));
    const sleep = (ms: number) => new Promise<void>((resolve) => timers.push(setTimeout(resolve, ms)));
    const ease = Easing.bezier(0.65, 0, 0.35, 1);

    let build = buildA;
    let moving = movingA;

    /** Says one line. If target is set, the drawing reaches it as the cue word is said. */
    const sayLine = async (line: FilmLine, target: number | null, last: boolean) => {
      // This bite's drawing, even if a timer fires after the next bite starts.
      const bv = build;
      const mv = moving;
      setSub(line.say);
      let started = false;
      const begin = (durationMs: number, elapsedMs: number) => {
        if (started || !alive) return;
        started = true;
        if (target === null) return;
        const r = rampFor(line, durationMs, elapsedMs);
        later(r.delayMs, () => {
          bv.value = reduce ? target : withTiming(target, { duration: r.rampMs, easing: ease });
        });
        if (last) later(r.delayMs + r.rampMs, () => (mv.value = 1));
      };
      if (speak) await speak(line.say, { onStart: ({ durationMs, elapsedMs }) => begin(durationMs, elapsedMs) });
      if (!alive || started) return;
      // No sound came out (or no voice at all): keep going on the subtitles.
      const est = estimateMs(line.say);
      begin(est, 0);
      await sleep(est);
    };

    (async () => {
      setFilmOver(false);
      for (let i = 0; i < lesson.bites.length; i++) {
        const b = lesson.bites[i];
        const lines = filmLines(b.film, b.text);
        build = i % 2 === 0 ? buildA : buildB;
        moving = i % 2 === 0 ? movingA : movingB;
        cancelAnimation(build);
        build.value = 0;
        moving.value = 0;
        setFilmBite(i);
        setBiteDone(false);
        setSub("");
        setAsking(null);
        setPicked(null);
        setRevealed(false);
        await sleep(i === 0 ? 500 : 700);
        if (!alive) return;
        for (let k = 0; k < lines.length; k++) {
          const last = k === lines.length - 1;
          if (last && b.guess && b.scene) {
            // Guess first, then see it.
            setAsking(b.guess);
            await sayLine({ say: b.guess.ask, cue: "" }, null, false);
            if (!alive) return;
            await new Promise<void>((resolve) => {
              pick.current = (option) => {
                pick.current = null;
                setPicked(option);
                resolve();
              };
            });
            if (!alive) return;
          }
          await sayLine(lines[k], buildAfter(k, lines.length), last);
          if (!alive) return;
          await sleep(250);
          if (!alive) return;
        }
        build.value = withTiming(1, { duration: reduce ? 0 : 300 });
        moving.value = 1;
        if (b.guess && b.scene) setRevealed(true);
        setBiteDone(true);
        await sleep(1600);
        if (!alive) return;
      }
      setFilmOver(true);
    })();

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      pick.current = null;
      hush?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, step.kind, filmRun]);

  const go = (s: Step) => {
    setAnswered(null);
    slider.value = 0;
    setBand(0);
    setPlayed(false);
    setStep(s);
    scroll.current?.scrollTo({ y: 0, animated: false });
    Haptics.selectionAsync().catch(() => {});
  };
  const next = () => {
    if (!lesson || step.kind === "finish") return;
    const all = stepsOf(lesson);
    const at = all.findIndex((x) => stepKey(x) === stepKey(step));
    go(all[at + 1] ?? { kind: "finish" });
  };

  // The progress bar: in a film, each bite of the film is a segment of its own.
  const all = lesson ? stepsOf(lesson) : [];
  const filmSegments = lesson && isFilm(lesson) ? lesson.bites.length - 1 : 0;
  const total = lesson ? all.length + filmSegments : 4;
  const at = all.findIndex((x) => stepKey(x) === stepKey(step));
  const done = !lesson ? 0 : step.kind === "finish" ? total : step.kind === "watch" ? filmBite : at + filmSegments;
  const filmNow = lesson?.bites[filmBite];

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colour.ground }]} />
      <Backdrop scene="intro" />

      <ScrollView
        ref={scroll}
        // No pull down or stretch past the ends: it read as "pull to reset".
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        contentContainerStyle={{ paddingTop: insets.top + 84, paddingHorizontal: 24, paddingBottom: 200, flexGrow: 1 }}>
        {!lesson && !error && (
          <View style={styles.centre}>
            <LivingLight size={90} energy={0.5} mood="think" touchable />
            <T size={18} weight="medium" style={{ textAlign: "center", marginTop: 26 }}>
              {lvl === "simple" && level !== "simple" ? "Making it simpler" : lvl === "deep" && level !== "deep" ? "Going deeper" : "Making a short lesson"}
            </T>
            <T size={15} tone="soft" style={{ textAlign: "center", marginTop: 8, maxWidth: 300 }}>
              {idea}
            </T>
          </View>
        )}

        {error && (
          <View style={styles.centre}>
            <T size={18} weight="medium" style={{ textAlign: "center" }}>
              The lesson didn't load
            </T>
            <T size={14.5} tone="soft" style={{ textAlign: "center", marginTop: 8, maxWidth: 300 }}>
              {error}
            </T>
            <PillButton label="Try again" variant="solid" style={{ marginTop: 26, alignSelf: "stretch" }} onPress={() => setAttempt((n) => n + 1)} />
            <PillButton label="Back to the call" style={{ marginTop: 10, alignSelf: "stretch" }} onPress={onClose} />
          </View>
        )}

        {lesson && step.kind === "watch" && filmNow && (
          <Animated.View key={`watch${filmRun}`} entering={riseIn()} style={{ gap: 20 }}>
            <Label tone="student">
              {filmNow.fromNotes ? "From your notes · " : ""}Idea {filmBite + 1} of {lesson.bites.length}
            </Label>
            <Animated.View key={`title${filmBite}`} entering={FadeIn.duration(400)}>
              <T size={30} weight="medium" style={{ lineHeight: 35 }}>
                {filmNow.title}
              </T>
            </Animated.View>
            {/* Morph between ideas: the picture changes in place. The last one
                fades out where it stands while the next one draws. */}
            <Animated.View key={`scene${filmBite}`} entering={FadeIn.duration(600)} exiting={reduce ? undefined : FadeOut.duration(600)}>
              {filmNow.scene ? (
                <SceneView
                  scene={filmNow.scene}
                  build={filmBite % 2 === 0 ? buildA : buildB}
                  moving={filmBite % 2 === 0 ? movingA : movingB}
                  label={filmNow.caption || filmNow.title}
                  caption={biteDone ? filmNow.caption : undefined}
                />
              ) : (
                <Picture kind={filmNow.picture.kind} labels={filmNow.picture.labels} />
              )}
            </Animated.View>
            <T size={17} tone={asking && !picked ? "text" : "soft"} style={{ lineHeight: 26, minHeight: 52 }}>
              {sub}
            </T>
            {asking && (
              <View style={{ gap: 10 }}>
                <View style={styles.choices}>
                  {asking.options.map((option) => (
                    <PillButton
                      key={option}
                      label={option}
                      variant={picked === option ? "solid" : "glass"}
                      style={{ flex: 1, opacity: picked && picked !== option ? 0.5 : 1 }}
                      onPress={
                        picked
                          ? undefined
                          : () => {
                              Haptics.selectionAsync().catch(() => {});
                              pick.current?.(option);
                            }
                      }
                    />
                  ))}
                </View>
                {revealed && (
                  <T size={14.5} style={{ color: picked === asking.answer ? colour.student : colour.gap }}>
                    {picked === asking.answer ? "You called it." : `Not quite. It was "${asking.answer}".`}
                  </T>
                )}
              </View>
            )}
          </Animated.View>
        )}

        {lesson && step.kind === "read" && (
          <Animated.View key={`read${step.i}`} entering={riseIn()} style={{ gap: 22 }}>
            <Label tone="student">
              {lesson.bites[step.i].fromNotes ? "From your notes · " : ""}Idea {step.i + 1} of {lesson.bites.length}
            </Label>
            <T size={30} weight="medium" style={{ lineHeight: 35 }}>
              {lesson.bites[step.i].title}
            </T>
            <T size={17} tone="soft" style={{ lineHeight: 26 }}>
              {lesson.bites[step.i].text}
            </T>
            <Animated.View entering={riseIn(STAGGER_MS * 3)} style={{ marginTop: 8 }}>
              {lesson.bites[step.i].scene ? (
                <SceneView scene={lesson.bites[step.i].scene!} label={lesson.bites[step.i].caption || lesson.bites[step.i].title} caption={lesson.bites[step.i].caption} />
              ) : (
                <Picture kind={lesson.bites[step.i].picture.kind} labels={lesson.bites[step.i].picture.labels} />
              )}
            </Animated.View>
            {lesson.bites[step.i].fromNotes && lesson.bites[step.i].quote ? (
              <View style={styles.quote}>
                <T size={14} tone="soft" style={{ fontStyle: "italic", lineHeight: 21 }}>
                  "{lesson.bites[step.i].quote}"
                </T>
              </View>
            ) : null}
          </Animated.View>
        )}

        {lesson && step.kind === "play" && lesson.bites[step.i].play && lesson.bites[step.i].scene && (
          <Animated.View key={`play${step.i}`} entering={riseIn()} style={{ gap: 20 }}>
            <Label tone="student">Try it</Label>
            <T size={28} weight="medium" style={{ lineHeight: 33 }}>
              {lesson.bites[step.i].play!.prompt}
            </T>
            <SceneView scene={lesson.bites[step.i].scene!} changes={lesson.bites[step.i].play!.changes} value={slider} label={lesson.bites[step.i].play!.prompt} caption={lesson.bites[step.i].caption} />
            <Slider
              value={slider}
              low={lesson.bites[step.i].play!.low}
              high={lesson.bites[step.i].play!.high}
              onBand={(b, v) => {
                setBand(b);
                if (v >= 0.6) setPlayed(true);
              }}
            />
            <T size={16} style={{ lineHeight: 23, minHeight: 46 }}>
              {lesson.bites[step.i].play!.readouts[band] ?? ""}
            </T>
          </Animated.View>
        )}

        {lesson && step.kind === "try" && (
          <Animated.View key={`try${step.i}`} entering={riseIn()} style={{ gap: 18 }}>
            <Label tone="student">Try it</Label>
            <Puzzle
              puzzle={lesson.bites[step.i].puzzle}
              onDone={(ok) => {
                setAnswered(ok);
                if (ok) setRight((n) => n + 1);
                // After the sheet's Fenny has risen in.
                setTimeout(() => react(ok ? "yay" : "oops"), 260);
              }}
            />
          </Animated.View>
        )}

        {lesson && step.kind === "finish" && (
          <Animated.View entering={riseIn()} style={[styles.centre, { gap: 0 }]}>
            <LivingLight size={110} energy={1} mood="got" cue={cue} touchable />
            <T size={30} weight="medium" style={{ textAlign: "center", marginTop: 28, lineHeight: 35 }}>
              You've got it.{"\n"}
              <T size={30} weight="medium" tone="student">
                Now teach it to Fenny.
              </T>
            </T>
            <T size={16} tone="soft" style={{ textAlign: "center", marginTop: 14, maxWidth: 320, lineHeight: 24 }}>
              {lesson.recap}
            </T>
            <Animated.View entering={riseIn(STAGGER_MS * 3)} style={styles.stats}>
              <Stat value={String(lesson.bites.length)} label="ideas learnt" tone="student" />
              <Stat value={`${right}/${lesson.bites.length}`} label="first try" />
            </Animated.View>
          </Animated.View>
        )}
      </ScrollView>
      {/* Top: a way back, and one segment per bite and puzzle. Drawn after the
          scroll so nothing can sit over the back button. */}
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <Press accessibilityRole="button" accessibilityLabel="Back to the call" onPress={onClose} style={styles.back} hitSlop={10}>
          <T size={14} tone="soft">
            Back to the call
          </T>
        </Press>
        <View style={styles.segments} accessibilityLabel={`Step ${Math.min(done + 1, total)} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.segment, i < done && styles.segmentDone, i === done && styles.segmentNow]} />
          ))}
        </View>
      </View>


      {/* Bottom: the next step. After a puzzle, a short sheet says why. */}
      {lesson && (
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]} pointerEvents="box-none">
          {step.kind === "try" && answered !== null && (
            <Animated.View entering={riseIn()} style={[styles.sheet, { backgroundColor: answered ? "rgba(169,190,230,0.14)" : "rgba(240,154,128,0.14)" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <LivingLight size={30} mood={answered ? "got" : "curious"} cue={cue} />
                <T size={16} weight="semibold" style={{ color: answered ? colour.student : colour.gap, flex: 1 }}>
                  {answered ? "Nice, that's it." : "Not quite, here's the right one."}
                </T>
              </View>
              <T size={14.5} tone="soft" style={{ marginTop: 4, lineHeight: 21 }}>
                {lesson.bites[step.i].puzzle.why}
              </T>
            </Animated.View>
          )}
          {step.kind === "watch" &&
            (filmOver ? (
              <>
                <PillButton label="Next" variant="solid" onPress={next} />
                <PillButton
                  label="Watch again"
                  onPress={() => {
                    setFilmOver(false);
                    setFilmRun((n) => n + 1);
                  }}
                />
              </>
            ) : (
              !(asking && !picked) && <PillButton label="Skip to the puzzles" onPress={next} />
            ))}
          {step.kind === "read" && <PillButton label="Got it" variant="solid" onPress={next} />}
          {step.kind === "play" && (played ? <PillButton label="Next" variant="solid" onPress={next} /> : <PillButton label="Slide to see it" onPress={next} />)}
          {step.kind === "try" && answered !== null && <PillButton label="Continue" variant="solid" onPress={next} />}
          {step.kind === "finish" &&
            (() => {
              const back = () => onDone(`${WELCOME[Math.floor(Math.random() * WELCOME.length)]} ${lesson.explainBack}`);
              // Smart: most puzzles missed, so the simpler version comes first.
              const lost = level === "smart" && lvl !== "simple" && right < lesson.bites.length / 2;
              return (
                <>
                  {lost && (
                    <T size={14.5} tone="soft" style={{ textAlign: "center" }}>
                      That was a tricky one. Want it explained more simply first?
                    </T>
                  )}
                  {lost ? <PillButton label="Explain it simpler" variant="solid" onPress={() => setLvl("simple")} /> : <PillButton label="Back to Fenny" variant="solid" onPress={back} />}
                  <View style={styles.choices}>
                    {lost ? (
                      <PillButton label="Back to Fenny" style={{ flex: 1 }} onPress={back} />
                    ) : (
                      lvl !== "simple" && <PillButton label="Simpler" style={{ flex: 1 }} onPress={() => setLvl(lvl === "deep" ? "standard" : "simple")} />
                    )}
                    {lvl !== "deep" && <PillButton label="Go deeper" style={{ flex: 1 }} onPress={() => setLvl(lvl === "simple" ? "standard" : "deep")} />}
                  </View>
                </>
              );
            })()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", left: 0, right: 0, zIndex: 2, paddingHorizontal: 20, gap: 14 },
  back: { alignSelf: "flex-start", paddingVertical: 6 },
  segments: { flexDirection: "row", gap: 5 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.10)" },
  segmentDone: { backgroundColor: colour.student },
  segmentNow: { backgroundColor: "rgba(169,190,230,0.45)" },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 60 },
  quote: { borderLeftWidth: 2, borderLeftColor: "rgba(169,190,230,0.45)", paddingLeft: 14, paddingVertical: 2 },
  stats: { flexDirection: "row", gap: 44, marginTop: 30 },
  bottom: { position: "absolute", left: 20, right: 20, bottom: 0, gap: 12 },
  sheet: { borderRadius: 24, padding: 18 },
  choices: { flexDirection: "row", gap: 10 },
});

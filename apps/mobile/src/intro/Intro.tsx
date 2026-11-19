// First run, built from the canvas board "Part: intro and sign in".
// Splash, three story slides and the sign-in sheet are one scene: the living
// light is a single element that springs between its spot in each moment.
// Then name, subjects, microphone, and the student says hello.
// Sign-in buttons carry straight on until accounts exist (build step 2).
import { Press } from "../ui/Press";
import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { requestRecordingPermissionsAsync } from "expo-audio";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { finishIntro, getProfile, SUBJECTS } from "../data/profile";
import { colour, font } from "../theme";
import { Glass, Icon, Label, PillButton, T } from "../ui/kit";
import { LivingLight } from "../ui/LivingLight";
import { useFennyCue } from "../ui/FennyOrb";
import { smooth, snappy, spring } from "../ui/motion";
import { Soft } from "../ui/Soft";

const img = {
  dawn: require("../../assets/images/intro-dawn.webp"),
  orbit: require("../../assets/images/intro-orbit.webp"),
  trails: require("../../assets/images/intro-trails.webp"),
  glow: require("../../assets/images/intro-glow.webp"),
  gap: require("../../assets/images/intro-gap.webp"),
};

type Screen = "splash" | "s0" | "s1" | "s2" | "auth" | "name" | "study" | "mic" | "meet";

const STORY = [
  {
    kicker: "The Feynman technique",
    lead: "Explain it out loud.",
    point: "Find what you missed.",
    body: "If you can teach it to someone who knows nothing, you understand it. Where you stall is a gap.",
    tone: "student" as const,
  },
  {
    kicker: "Meet your student",
    lead: "It knows nothing.",
    point: "On purpose.",
    body: "It asks the questions your examiner will, and never gives you the answer. You work it out.",
    tone: "student" as const,
  },
  {
    kicker: "Then the clever bit",
    lead: "Every gap comes back",
    point: "until it sticks.",
    body: "We check what you said against your notes and bring each weak spot back on the right day.",
    tone: "gap" as const,
  },
];

// Where the light sits in each moment, on the 390 x 844 board: centre x, centre y, scale.
const HERO: Partial<Record<Screen, [number, number, number]>> = {
  splash: [195, 470, 0.9],
  s0: [195, 270, 0.8],
  s1: [195, 410, 0.42],
  s2: [352, 150, 0.26],
  auth: [195, 262, 0.5],
};
const STAGE: Screen[] = ["splash", "s0", "s1", "s2", "auth"];
const HERO_SIZE = 220;
const ease = Easing.bezier(0.2, 0.8, 0.2, 1);

const tap = () => Haptics.selectionAsync().catch(() => {});

export default function Intro() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const [screen, setScreen] = useState<Screen>("splash");
  const [name, setName] = useState(getProfile().name);
  const [subjects, setSubjects] = useState<string[]>(getProfile().subjects);

  const onStage = STAGE.includes(screen);
  const slide = screen === "s0" ? 0 : screen === "s1" ? 1 : screen === "s2" ? 2 : -1;

  // Fenny says hello as it meets them on the second slide.
  const [cue, react] = useFennyCue();
  useEffect(() => {
    if (screen !== "s1") return;
    const id = setTimeout(() => react("hello"), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // The splash moves on by itself, as on the board.
  useEffect(() => {
    if (screen !== "splash") return;
    const id = setTimeout(() => setScreen("s0"), 5200);
    return () => clearTimeout(id);
  }, [screen]);

  const next = () => {
    tap();
    if (screen === "splash") setScreen("s0");
    else if (screen === "s0") setScreen("s1");
    else if (screen === "s1") setScreen("s2");
    else if (screen === "s2") setScreen("auth");
  };
  const done = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    finishIntro(name, subjects);
    router.replace("/");
  };

  // The light: one element, sprung between moments.
  const sx = width / 390;
  const sy = height / 844;
  const hx = useSharedValue(195 * sx);
  const hy = useSharedValue(470 * sy);
  const hs = useSharedValue(0.9);
  const rise = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    rise.value = withTiming(1, { duration: reduce ? 0 : 2000, easing: ease });
  }, [rise, reduce]);
  useEffect(() => {
    const p = HERO[screen];
    if (!p) return;
    hx.value = smooth(p[0] * sx);
    hy.value = smooth(p[1] * sy);
    hs.value = smooth(p[2]);
  }, [screen, sx, sy, hx, hy, hs]);
  const heroStyle = useAnimatedStyle(() => ({
    opacity: rise.value,
    transform: [
      { translateX: hx.value - HERO_SIZE / 2 },
      { translateY: hy.value - HERO_SIZE / 2 + (1 - rise.value) * 260 },
      { scale: hs.value * (0.45 + 0.55 * rise.value) },
    ],
  }));

  // The sign-in sheet springs up over the same scene.
  const sheetY = useSharedValue(height);
  useEffect(() => {
    sheetY.value = smooth(screen === "auth" ? 0 : height);
  }, [screen, height, sheetY]);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));

  // The round next button stretches into the wide "Get started" button.
  const last = screen === "s2";
  const ctlW = useSharedValue(62);
  useEffect(() => {
    ctlW.value = smooth(last ? width - 52 : 62);
  }, [last, width, ctlW]);
  const ctlStyle = useAnimatedStyle(() => ({ width: ctlW.value }));

  return (
    <View style={styles.root}>
      {onStage && (
        <>
          <Bg source={img.dawn} on={screen === "splash" || screen === "s0" || screen === "auth"} lift={screen === "auth"} />
          <Bg source={img.orbit} on={screen === "s1"} />
          <Bg source={img.trails} on={screen === "s2"} />
          <LinearGradient pointerEvents="none" colors={["rgba(10,11,13,0)", "rgba(10,11,13,0.7)", colour.ground]} locations={[0.45, 0.72, 0.92]} style={StyleSheet.absoluteFill} />

          <Pressable style={StyleSheet.absoluteFill} onPress={screen === "auth" ? undefined : next} accessibilityLabel="Next" accessibilityRole="button">
            <Animated.View pointerEvents="none" style={[styles.hero, heroStyle]}>
              {(screen === "splash" || screen === "s0" || screen === "s1") && <Ripples size={HERO_SIZE} />}
              <LivingLight size={HERO_SIZE} energy={screen === "s1" ? 1 : 0} mood={screen === "s1" ? "curious" : "rest"} peek cue={cue} />
            </Animated.View>

            {screen === "splash" && <Splash bottom={insets.bottom} />}
            {screen === "s1" && <Bubbles top={insets.top + 50} />}
            {screen === "s2" && <Cards top={insets.top + 100} />}

            {slide >= 0 && (
              <View pointerEvents="none" style={[styles.copy, { bottom: insets.bottom + 110 }]}>
                <StoryCopy key={slide} {...STORY[slide]} />
              </View>
            )}
          </Pressable>

          {slide >= 0 && (
            <Animated.View entering={FadeInDown.springify().duration(550)} style={[styles.controls, { bottom: Math.max(insets.bottom, 20) + 14 }]}>
              <View style={{ flexDirection: "row", gap: 6, flex: 1, opacity: last ? 0 : 1 }} accessibilityElementsHidden>
                {[0, 1, 2].map((i) => (
                  <Dot key={i} on={i === slide} />
                ))}
              </View>
              {!last && (
                <Press onPress={() => setScreen("auth")} style={{ padding: 12 }} accessibilityRole="button">
                  <T size={14} tone="muted">
                    Skip
                  </T>
                </Press>
              )}
              <Animated.View style={[styles.morph, ctlStyle]}>
                <Press onPress={next} accessibilityRole="button" accessibilityLabel={last ? "Get started" : "Next"} style={{ flex: 1 }}>
                  <Soft lit style={{ flex: 1 }}>
                    {last ? (
                      <Animated.View entering={FadeIn.delay(200)}>
                        <T size={16} weight="semibold" tone="dark">
                          Get started
                        </T>
                      </Animated.View>
                    ) : (
                      <Arrow color={colour.onLight} />
                    )}
                  </Soft>
                </Press>
              </Animated.View>
            </Animated.View>
          )}

          <Animated.View style={[styles.sheet, { bottom: Math.max(insets.bottom, 8) }, sheetStyle]} pointerEvents={screen === "auth" ? "auto" : "none"}>
            {screen === "auth" && <Auth onGo={() => setScreen("name")} />}
          </Animated.View>
        </>
      )}

      {screen === "name" && (
        <Step top={insets.top} bottom={insets.bottom} progress={1} light>
          <Rise d={1}>
            <T size={36} weight="medium" style={{ marginTop: 22 }}>
              What should your student call you?
            </T>
          </Rise>
          <Rise d={2}>
            <T size={13} tone="muted" style={{ marginTop: 28, marginBottom: 8 }}>
              First name
            </T>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your first name"
              placeholderTextColor={colour.textDim}
              autoComplete="given-name"
              textContentType="givenName"
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => name.trim() && setScreen("study")}
              style={styles.field}
              accessibilityLabel="First name"
            />
          </Rise>
          <View style={{ flex: 1 }} />
          <PillButton label="Continue" variant="solid" onPress={() => name.trim() && (tap(), setScreen("study"))} style={{ opacity: name.trim() ? 1 : 0.4 }} />
        </Step>
      )}

      {screen === "study" && (
        <Step top={insets.top} bottom={insets.bottom} progress={2}>
          <Rise d={1}>
            <T size={36} weight="medium" style={{ marginTop: 44 }}>
              <T size={36} weight="medium" tone="dim">
                Nice to meet you, {name.trim()}.
              </T>
              {"\n"}What are you studying?
            </T>
          </Rise>
          <Rise d={2}>
            <T size={15} tone="soft" style={{ marginTop: 10, marginBottom: 24 }}>
              Pick any. Your student will learn your subject's words.
            </T>
          </Rise>
          <Rise d={3}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {SUBJECTS.map(([id, label]) => (
                <Chip
                  key={id}
                  label={label}
                  on={subjects.includes(id)}
                  onPress={() => {
                    tap();
                    setSubjects((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
                  }}
                />
              ))}
            </View>
          </Rise>
          <View style={{ flex: 1 }} />
          <PillButton
            label="Continue"
            variant="solid"
            onPress={() => subjects.length && (tap(), setScreen("mic"))}
            style={{ opacity: subjects.length ? 1 : 0.4 }}
          />
        </Step>
      )}

      {screen === "mic" && (
        <Step top={insets.top} bottom={insets.bottom} progress={3} centre plain>
          <View style={{ width: 150, height: 150, marginTop: 110, alignItems: "center", justifyContent: "center" }}>
            <Ripples size={150} />
            <Soft style={{ width: 90, height: 90 }}>
              <Icon name="mic" size={28} />
            </Soft>
          </View>
          <Rise d={1}>
            <T size={34} weight="medium" style={{ marginTop: 50, textAlign: "center" }}>
              Your student needs to hear you
            </T>
          </Rise>
          <Rise d={2}>
            <T size={15.5} tone="soft" style={{ marginTop: 12, textAlign: "center", maxWidth: 310 }}>
              It listens while the call is on, and stops the moment you end it. You can talk over it any time.
            </T>
          </Rise>
          <View style={{ flex: 1 }} />
          <PillButton
            label="Allow microphone"
            variant="solid"
            style={{ alignSelf: "stretch" }}
            onPress={async () => {
              tap();
              await requestRecordingPermissionsAsync().catch(() => null);
              setScreen("meet");
            }}
          />
          <Press onPress={() => setScreen("meet")} style={{ padding: 12, marginTop: 6 }} accessibilityRole="button">
            <T size={14} tone="muted">
              Not now
            </T>
          </Press>
        </Step>
      )}

      {screen === "meet" && <Meet name={name.trim()} bottom={insets.bottom} onDone={done} onReplay={() => setScreen("splash")} />}
    </View>
  );
}

/** Background photo that cross-dissolves and settles in. */
function Bg({ source, on, lift }: { source: number; on: boolean; lift?: boolean }) {
  const o = useSharedValue(on ? 1 : 0);
  const s = useSharedValue(on ? 1 : 1.1);
  const y = useSharedValue(0);
  useEffect(() => {
    o.value = withTiming(on ? 1 : 0, { duration: 1100 });
    s.value = withTiming(on ? 1 : 1.1, { duration: 2400, easing: ease });
    y.value = smooth(lift ? -200 : 0);
  }, [on, lift, o, s, y]);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }, { scale: s.value }] }));
  return <Animated.Image source={source} resizeMode="cover" style={[StyleSheet.absoluteFill, st]} accessibilityElementsHidden />;
}

/** Three soft rings breathing out from the light. */
function Ripples({ size }: { size: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
      {[0, 1200, 2400].map((d) => (
        <Ripple key={d} size={size} delay={d} />
      ))}
    </View>
  );
}
function Ripple({ size, delay }: { size: number; delay: number }) {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 3600, easing: Easing.out(Easing.quad) }), -1, false));
  }, [t, delay, reduce]);
  const st = useAnimatedStyle(() => ({
    opacity: t.value < 0.2 ? t.value / 0.2 * 0.55 : 0.55 * (1 - (t.value - 0.2) / 0.8),
    transform: [{ scale: 0.55 + t.value * 2.05 }],
  }));
  return <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: "rgba(214,222,236,0.55)" }, st]} />;
}

function Splash({ bottom }: { bottom: number }) {
  return (
    <>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "70%", alignItems: "center", gap: 14 }}>
        <Animated.View entering={FadeInDown.delay(1100).duration(1500).easing(ease)}>
          <T size={54} weight="semibold" style={{ fontFamily: font.wordmark, letterSpacing: -1.9, lineHeight: 60 }}>
            Fenny
          </T>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(2000).duration(900)}>
          <Label tone="soft">Teach it to know it</Label>
        </Animated.View>
      </View>
      <Animated.View entering={FadeIn.delay(2800).duration(900)} style={{ position: "absolute", left: 0, right: 0, bottom: bottom + 34, alignItems: "center" }}>
        <Label>Tap to begin</Label>
      </Animated.View>
    </>
  );
}

/** Each line rises in, 100 ms apart. */
function StoryCopy({ kicker, lead, point, body, tone }: (typeof STORY)[number]) {
  return (
    <View>
      <Rise d={1}>
        <Label tone={tone}>{kicker}</Label>
      </Rise>
      <Rise d={2}>
        <T size={40} weight="medium" style={{ marginTop: 14, lineHeight: 42 }}>
          <T size={40} weight="medium" tone="dim">
            {lead}
          </T>
          {"\n"}
          {point}
        </T>
      </Rise>
      <Rise d={3}>
        <T size={16} tone="soft" style={{ marginTop: 14 }}>
          {body}
        </T>
      </Rise>
    </View>
  );
}

function Rise({ d, children }: { d: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(20 + d * 100).springify().duration(spring.smooth.duration).dampingRatio(spring.smooth.dampingRatio)} exiting={FadeOut.duration(180)}>
      {children}
    </Animated.View>
  );
}

function Bubbles({ top }: { top: number }) {
  const lines: [string, "student" | "you", number][] = [
    ["So what actually holds it there?", "student", 550],
    ["Weak bonds, I think…", "you", 1250],
    ["Weak how? Like a magnet?", "student", 2000],
  ];
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 22, right: 22, top, gap: 10 }} accessibilityElementsHidden>
      {lines.map(([text, who, delay]) => (
        <Animated.View
          key={text}
          entering={FadeInDown.delay(delay).springify().duration(spring.snappy.duration).dampingRatio(0.7)}
          style={[styles.bubble, who === "student" ? styles.bubbleStudent : styles.bubbleYou]}
        >
          <T size={16} tone={who === "you" ? "soft" : "text"}>
            {text}
          </T>
        </Animated.View>
      ))}
    </View>
  );
}

function Cards({ top }: { top: number }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 44, width: 250, top, height: 300 }} accessibilityElementsHidden>
      <Animated.View entering={FadeInDown.delay(250).springify()} style={[styles.card, { backgroundColor: "#15161A", transform: [{ rotate: "-8deg" }, { translateX: -10 }, { translateY: 10 }] }]} />
      <Animated.View entering={FadeInDown.delay(400).springify()} style={[styles.card, { backgroundColor: "#1B1D21", transform: [{ rotate: "6deg" }, { translateX: 10 }, { translateY: 4 }] }]} />
      <Animated.View entering={FadeInDown.delay(600).springify().dampingRatio(0.7)} style={[styles.card, styles.cardFront]}>
        <Animated.Image source={img.gap} resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity: 0.75 }]} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,11,13,0.35)" }]} />
        <View style={styles.cardTag}>
          <T size={12} tone="gap">
            Gap · back Thursday
          </T>
        </View>
        <T size={19} weight="semibold" style={{ position: "absolute", left: 18, right: 18, bottom: 18, lineHeight: 23 }}>
          Km and Vmax were the wrong way round.
        </T>
      </Animated.View>
    </View>
  );
}

function Dot({ on }: { on: boolean }) {
  const w = useSharedValue(on ? 26 : 6);
  useEffect(() => {
    w.value = smooth(on ? 26 : 6);
  }, [on, w]);
  const st = useAnimatedStyle(() => ({ width: w.value }));
  return <Animated.View style={[{ height: 6, borderRadius: 3, backgroundColor: on ? colour.silver : "rgba(255,255,255,0.22)" }, st]} />;
}

function Arrow({ color = colour.text }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function Auth({ onGo }: { onGo: () => void }) {
  return (
    <View>
      <View style={styles.grabber} />
      <Rise d={1}>
        <T size={36} weight="medium" style={{ marginTop: 20 }}>
          <T size={36} weight="medium" tone="dim">
            Your student is waiting.
          </T>
          {"\n"}Let's get you in.
        </T>
      </Rise>
      <Rise d={2}>
        <T size={15} tone="soft" style={{ marginTop: 12, marginBottom: 22 }}>
          Accounts arrive in the next build. For now, any of these carries straight on.
        </T>
      </Rise>
      <Rise d={3}>
        <View style={{ gap: 10 }}>
          <PillButton label="Continue with Apple" variant="solid" onPress={onGo} style={{ height: 58 }} />
          <PillButton label="Continue with Google" onPress={onGo} style={{ height: 58 }} />
          <PillButton label="Use my email" onPress={onGo} style={{ height: 58, backgroundColor: "transparent", borderWidth: 0 }} />
        </View>
      </Rise>
    </View>
  );
}

function Step({
  top,
  bottom,
  progress,
  children,
  centre,
  light,
  plain,
}: {
  top: number;
  bottom: number;
  progress: number;
  children: React.ReactNode;
  centre?: boolean;
  light?: boolean;
  plain?: boolean;
}) {
  return (
    <Animated.View entering={FadeIn.duration(500)} style={StyleSheet.absoluteFill}>
      {!plain && <Animated.Image source={img.glow} resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} />}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingTop: top + 20, paddingBottom: Math.max(bottom, 20) + 10, paddingHorizontal: 22, alignItems: centre ? "center" : "stretch" }}>
          <View style={{ flexDirection: "row", gap: 6, alignSelf: "stretch" }} accessibilityElementsHidden>
            {[1, 2, 3].map((i) => (
              <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= progress ? colour.silver : "rgba(255,255,255,0.15)" }} />
            ))}
          </View>
          {light && (
            <Rise d={0}>
              <View style={{ marginTop: 44, width: 64, height: 64 }}>
                <LivingLight size={64} mood="listen" />
              </View>
            </Rise>
          )}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const s = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => (s.value = snappy(0.94))}
      onPressOut={() => (s.value = snappy(1))}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Animated.View style={st}>
        {on ? (
          <Soft lit style={{ width: chipWidth(label), height: 46 }}>
            <T size={15} tone="dark">{label}</T>
          </Soft>
        ) : (
          <Glass style={{ height: 46, borderRadius: 999, paddingHorizontal: 17, justifyContent: "center" }}>
            <T size={15} tone="soft">
              {label}
            </T>
          </Glass>
        )}
      </Animated.View>
    </Pressable>
  );
}
// Instrument Sans at 15 px averages about 7.6 px a character.
const chipWidth = (label: string) => Math.round(label.length * 7.6 + 36);

/** The student says hello, typed out under the light. */
function Meet({ name, bottom, onDone, onReplay }: { name: string; bottom: number; onDone: () => void; onReplay: () => void }) {
  const line = useMemo(() => `Hi ${name || "there"}. I know nothing about anything. Want to teach me something?`, [name]);
  const [chars, setChars] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const start = setTimeout(() => {
      timer.current = setInterval(
        () =>
          setChars((n) => {
            if (n + 1 >= line.length && timer.current) clearInterval(timer.current);
            return Math.min(n + 1, line.length);
          }),
        38,
      );
    }, 1500);
    return () => {
      clearTimeout(start);
      if (timer.current) clearInterval(timer.current);
    };
  }, [line]);
  const typed = chars >= line.length;
  return (
    <Animated.View entering={FadeIn.duration(500)} style={StyleSheet.absoluteFill}>
      <Animated.Image source={img.glow} resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity: 0.8 }]} />
      <Animated.View entering={FadeInDown.duration(1900).easing(ease)} style={{ position: "absolute", top: "20%", alignSelf: "center", width: 220, height: 220 }}>
        <Ripples size={220} />
        <LivingLight size={220} energy={typed ? 0 : 1} mood={typed ? "listen" : "curious"} />
      </Animated.View>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 26, paddingBottom: Math.max(bottom, 20) + 10, alignItems: "center" }}>
        <Animated.View entering={FadeInDown.delay(1200).duration(700)}>
          <Label tone="student">Your student</Label>
        </Animated.View>
        <T size={26} weight="medium" style={{ marginTop: 14, minHeight: 96, textAlign: "center", lineHeight: 32 }}>
          {line.slice(0, chars)}
        </T>
        {typed && (
          <Animated.View entering={FadeInDown.springify()} style={{ alignSelf: "stretch", marginTop: 26 }}>
            <PillButton label="Teach me something" variant="solid" onPress={onDone} style={{ height: 58 }} />
            <Press onPress={onReplay} style={{ padding: 12, marginTop: 6, alignItems: "center" }} accessibilityRole="button">
              <T size={14} tone="muted">
                Play the intro again
              </T>
            </Press>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colour.ground },
  hero: { position: "absolute", left: 0, top: 0, width: HERO_SIZE, height: HERO_SIZE, alignItems: "center", justifyContent: "center" },
  copy: { position: "absolute", left: 26, right: 26 },
  controls: { position: "absolute", left: 26, right: 26, height: 62, flexDirection: "row", alignItems: "center", gap: 14 },
  morph: { position: "absolute", right: 0, top: 0, height: 62, borderRadius: 999 },
  sheet: {
    position: "absolute",
    left: 8,
    right: 8,
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 22,
    borderRadius: 40,
    backgroundColor: "rgba(18,19,22,0.92)",
    borderWidth: 1,
    borderColor: colour.hairline,
  },
  grabber: { alignSelf: "center", width: 38, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.22)" },
  field: {
    height: 58,
    borderRadius: 18,
    paddingHorizontal: 18,
    fontSize: 18,
    color: colour.text,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: colour.hairline,
    fontFamily: font.regular,
  },
  bubble: { paddingVertical: 13, paddingHorizontal: 16, maxWidth: 250 },
  bubbleStudent: { alignSelf: "flex-start", borderRadius: 22, borderBottomLeftRadius: 6, backgroundColor: "rgba(169,190,230,0.14)", borderWidth: 1, borderColor: "rgba(169,190,230,0.26)" },
  bubbleYou: { alignSelf: "flex-end", borderRadius: 22, borderBottomRightRadius: 6, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  card: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: 28 },
  cardFront: { overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "#1B1D21" },
  cardTag: {
    position: "absolute",
    left: 16,
    top: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(20,21,24,0.7)",
    borderWidth: 1,
    borderColor: colour.hairline,
  },
});

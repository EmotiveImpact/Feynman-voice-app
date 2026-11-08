// New topic, from the canvas board "Part: upload flow". A sheet over Today.
// Scan pages works: the phone's own scanner snaps the pages and the server
// reads them (handwriting too). The other sources are still marked "Soon".
// Without notes you type (or dictate) the topic and your student asks about
// the basics.
import { Press } from "../ui/Press";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useProfile } from "../data/profile";
import { colour, font } from "../theme";
import { Glass, Icon, Label, PillButton, T } from "../ui/kit";
import { LivingLight } from "../ui/LivingLight";
import { smooth, spring } from "../ui/motion";
import { Soft } from "../ui/Soft";
import { readPage } from "../api";
import { joinPages, saveNotes } from "../data/notes";
import { inBatches, pageForUpload, scanPages } from "./scan";

const SOURCES = [
  ["Slides or PDF", "PowerPoint, Keynote, PDF, Word"],
  ["Scan pages", "Textbook, handouts, notes"],
  ["From the cloud", "Google Drive, OneDrive"],
  ["Paste text", "Copied notes or a link"],
];
const SCAN = "Scan pages";

/** Pages being read, read, or a problem reading them. */
type ScanState =
  | { stage: "reading"; done: number; total: number }
  | { stage: "ready"; pages: string[]; titles: string[]; unreadable: number }
  | { stage: "error"; message: string; keep?: { stage: "ready"; pages: string[]; titles: string[]; unreadable: number } };

export default function NewTopic() {
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("");
  const recent = profile.topics.slice(0, 4);
  const [scan, setScan] = useState<ScanState | null>(null);
  const pages = scan?.stage === "ready" ? scan.pages : scan?.stage === "error" ? (scan.keep?.pages ?? []) : [];

  /** Scan pages (adding to any already read), then read each one on the server. */
  const scanNotes = async () => {
    if (scan?.stage === "reading") return;
    const before = scan?.stage === "ready" ? scan : scan?.stage === "error" ? (scan.keep ?? null) : null;
    let uris: string[];
    try {
      uris = await scanPages();
    } catch (e) {
      setScan({ stage: "error", message: e instanceof Error ? e.message : "The scanner didn't open." });
      return;
    }
    if (!uris.length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    let done = 0;
    setScan({ stage: "reading", done, total: uris.length });
    try {
      const read = await inBatches(uris, 3, async (uri) => {
        const page = await readPage(await pageForUpload(uri), topic.trim() || undefined);
        done += 1;
        setScan({ stage: "reading", done, total: uris.length });
        return page;
      });
      const ok = read.filter((p) => p.readable && p.text);
      const next = {
        stage: "ready" as const,
        pages: [...(before?.pages ?? []), ...ok.map((p) => p.text)],
        titles: [...(before?.titles ?? []), ...ok.map((p) => p.title)],
        unreadable: read.length - ok.length,
      };
      if (!next.pages.length) {
        setScan({ stage: "error", message: "I couldn't read those pages. Try again in better light, with the page flat." });
        return;
      }
      setScan(next);
      // Suggest a name from the first page they read, unless they've typed one.
      if (!topic.trim() && next.titles.find(Boolean)) setTopic(next.titles.find(Boolean)!);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {
      setScan({ stage: "error", message: "I couldn't reach the server to read your pages. Check your connection and try again.", keep: before ?? undefined });
    }
  };

  const dim = useSharedValue(0);
  const y = useSharedValue(600);
  useEffect(() => {
    dim.value = smooth(1);
    y.value = smooth(0);
  }, [dim, y]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  // teach: go straight to a short lesson first, before explaining anything.
  const start = (t: string, teach = false) => {
    const title = t.trim();
    if (!title) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (pages.length) saveNotes(title, joinPages(pages));
    const params: Record<string, string> = { topic: title };
    if (goal.trim()) params.goal = goal.trim();
    if (teach) params.teach = "1";
    router.replace({ pathname: "/session", params });
  };

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(5,5,6,0.6)" }, dimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityLabel="Close" />
      </Animated.View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, { marginBottom: Math.max(insets.bottom, 8) }, sheetStyle]}>
          <View style={styles.grabber} />
          <Rise d={1}>
            <View style={{ marginTop: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <T size={30} weight="medium" style={{ lineHeight: 32 }}>
                <T size={30} weight="medium" tone="dim">
                  Give me your notes.
                </T>
                {"\n"}I'll learn from you.
              </T>
              <View style={{ width: 44, height: 44 }}>
                <LivingLight size={44} mood="listen" touchable />
              </View>
            </View>
          </Rise>

          <Rise d={2}>
            <View style={styles.grid}>
              {SOURCES.map(([title, sub]) =>
                title === SCAN ? (
                  <Press key={title} onPress={scanNotes} style={{ width: "48.5%" }} accessibilityRole="button" accessibilityLabel="Scan pages of your notes">
                    <Glass style={[styles.source, styles.live]}>
                      <T size={15} weight="semibold">
                        {title}
                      </T>
                      <T size={12} tone="soft">
                        {sub}
                      </T>
                    </Glass>
                  </Press>
                ) : (
                  <Glass key={title} style={styles.source}>
                    <View style={styles.soon}>
                      <Label tone="muted" style={{ fontSize: 10 }}>
                        Soon
                      </Label>
                    </View>
                    <T size={15} weight="semibold" tone="soft">
                      {title}
                    </T>
                    <T size={12} tone="dim">
                      {sub}
                    </T>
                  </Glass>
                ),
              )}
            </View>
          </Rise>

          {scan && (
            <Animated.View entering={FadeInDown.springify().duration(spring.smooth.duration).dampingRatio(spring.smooth.dampingRatio)}>
              <Glass style={styles.scanCard}>
                {scan.stage === "reading" && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 28, height: 28 }}>
                      <LivingLight size={28} mood="think" />
                    </View>
                    <T size={14.5} tone="soft">
                      Reading page {Math.min(scan.done + 1, scan.total)} of {scan.total}…
                    </T>
                  </View>
                )}
                {scan.stage === "ready" && (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Icon name="check" size={16} />
                      <T size={14.5} weight="semibold">
                        {scan.pages.length === 1 ? "1 page read" : `${scan.pages.length} pages read`}
                      </T>
                      {scan.unreadable > 0 && (
                        <T size={12.5} tone="dim">
                          · {scan.unreadable} too blurry
                        </T>
                      )}
                    </View>
                    <T size={12.5} tone="dim" lines={2} style={{ marginTop: 6 }}>
                      {scan.pages[0].replace(/[#*>-]+/g, " ").replace(/\s+/g, " ").trim()}
                    </T>
                    <View style={{ flexDirection: "row", gap: 18, marginTop: 10 }}>
                      <Pressable onPress={scanNotes} accessibilityRole="button" hitSlop={8}>
                        <T size={13} tone="soft" weight="semibold">
                          Scan more
                        </T>
                      </Pressable>
                      <Pressable onPress={() => setScan(null)} accessibilityRole="button" hitSlop={8}>
                        <T size={13} tone="dim">
                          Remove
                        </T>
                      </Pressable>
                    </View>
                  </>
                )}
                {scan.stage === "error" && (
                  <>
                    <T size={13.5} tone="soft">
                      {scan.message}
                    </T>
                    <Pressable onPress={scanNotes} accessibilityRole="button" hitSlop={8} style={{ marginTop: 8 }}>
                      <T size={13} weight="semibold">
                        Try again
                      </T>
                    </Pressable>
                  </>
                )}
              </Glass>
            </Animated.View>
          )}

          <Rise d={3}>
            <T size={15} style={{ marginTop: 18 }}>
              {pages.length ? "What's this topic called?" : "No notes? Just say the topic"}
            </T>
            <T size={12.5} tone="soft" style={{ marginTop: 2 }}>
              {pages.length ? "Your student will learn from your pages." : "Your student will ask about the basics."}
            </T>
            <View style={styles.inputRow}>
              <TextInput
                value={topic}
                onChangeText={setTopic}
                placeholder="Enzyme kinetics, the French Revolution…"
                placeholderTextColor={colour.textDim}
                returnKeyType="go"
                onSubmitEditing={() => start(topic)}
                style={styles.input}
                accessibilityLabel="Topic"
              />
              <Press onPress={() => start(topic)} disabled={!topic.trim()} accessibilityRole="button" accessibilityLabel="Start explaining" style={{ opacity: topic.trim() ? 1 : 0.4 }}>
                <Soft style={{ width: 50, height: 50 }}>
                  <Icon name="mic" />
                </Soft>
              </Press>
            </View>
            {topic.trim().length > 0 && (
              <Animated.View entering={FadeIn}>
                <TextInput
                  value={goal}
                  onChangeText={setGoal}
                  placeholder="By the exam I want to explain… (optional)"
                  placeholderTextColor={colour.textDim}
                  returnKeyType="go"
                  onSubmitEditing={() => start(topic)}
                  style={[styles.input, { marginTop: 8, flex: 0 }]}
                  accessibilityLabel="What you want to be able to explain"
                />
                {/* New to it? Learn it first, then explain it back to Fenny. */}
                <PillButton
                  label="New to this? Teach me first"
                  accessibilityLabel="Teach me first: a short lesson before you explain"
                  onPress={() => start(topic, true)}
                  style={{ marginTop: 10 }}
                />
              </Animated.View>
            )}
          </Rise>

          {recent.length > 0 && (
            <Rise d={4}>
              <Label style={{ marginTop: 18 }}>Recent</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {recent.map((t) => (
                  <Press key={t.title} onPress={() => start(t.title)} accessibilityRole="button">
                    <Glass style={{ height: 40, borderRadius: 999, paddingHorizontal: 15, justifyContent: "center" }}>
                      <T size={14} tone="soft">
                        {t.title}
                      </T>
                    </Glass>
                  </Press>
                ))}
              </View>
            </Rise>
          )}

          <Animated.View entering={FadeIn.delay(450)}>
            <T size={12.5} tone="muted" style={{ marginTop: 16, textAlign: "center" }}>
              Reading is free; only speaking uses minutes.
            </T>
            <PillButton label="Not now" onPress={() => router.back()} style={{ marginTop: 4, backgroundColor: "transparent", borderWidth: 0 }} />
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Rise({ d, children }: { d: number; children: React.ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.delay(120 + d * 80).springify().duration(spring.smooth.duration).dampingRatio(spring.smooth.dampingRatio)}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: 8,
    paddingTop: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderRadius: 40,
    backgroundColor: "rgba(18,19,22,0.96)",
    borderWidth: 1,
    borderColor: colour.hairline,
  },
  grabber: { alignSelf: "center", width: 38, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.22)" },
  grid: { marginTop: 20, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  source: { width: "48.5%", borderRadius: 22, padding: 14, gap: 2, opacity: 0.55 },
  soon: { position: "absolute", right: 10, top: 10 },
  live: { width: "100%", opacity: 1, borderWidth: 1, borderColor: "rgba(214,224,240,0.22)" },
  scanCard: { marginTop: 10, borderRadius: 22, padding: 14 },
  inputRow: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  input: {
    flex: 1,
    height: 54,
    borderRadius: 999,
    paddingHorizontal: 20,
    fontSize: 16,
    color: colour.text,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: colour.hairline,
    fontFamily: font.regular,
  },
});

// New topic: a sheet over Today. The quickest way in comes first: name a
// topic and start. Notes are the second way: Scan pages uses the phone's own
// scanner and the server reads them (handwriting too). The sources that do
// not work yet are one quiet line, not a wall of greyed-out buttons.
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
import { PickError, pickAndReadFile } from "./pickFile";
import { inBatches, pageForUpload, scanPages } from "./scan";


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
  const scanned = scan?.stage === "ready" ? scan.pages : scan?.stage === "error" ? (scan.keep?.pages ?? []) : [];
  // Notes pasted from anywhere (an email, a doc, a web page), kept as one more page.
  const [pasting, setPasting] = useState(false);
  const [draft, setDraft] = useState("");
  const [pasted, setPasted] = useState("");
  // Files picked from the phone (PDF, slides, Word), read on the server.
  const [files, setFiles] = useState<{ name: string; text: string; pages: number }[]>([]);
  const [fileState, setFileState] = useState<{ busy?: string; error?: string }>({});
  const pages = [...scanned, ...files.map((f) => f.text), ...(pasted ? [pasted] : [])];
  const addFile = async () => {
    if (fileState.busy) return;
    setFileState({});
    try {
      setFileState({ busy: "Choosing…" });
      const got = await pickAndReadFile(topic.trim() || undefined);
      if (!got) return setFileState({});
      if (!got.readable || !got.text) return setFileState({ error: "I couldn't find any text in that file." });
      setFiles((f) => [...f, { name: got.name, text: got.text, pages: got.pages }]);
      if (!topic.trim() && got.title) setTopic(got.title);
      setFileState({});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setFileState({ error: e instanceof PickError || e instanceof Error ? e.message : "I couldn't read that file." });
    }
  };
  const usePasted = () => {
    const text = draft.trim();
    if (!text) return;
    setPasted(text);
    setPasting(false);
    // Suggest a name from the first line, unless they've typed one.
    const first = text.split("\n").map((l) => l.replace(/^[#*\-\s]+/, "").trim()).find(Boolean) ?? "";
    if (!topic.trim() && first.length > 2 && first.length <= 60) setTopic(first);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

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
              <T size={28} weight="medium" style={{ lineHeight: 33 }}>
                <T size={28} weight="medium" tone="dim">
                  Name a topic.
                </T>
                {"\n"}I'll ask the questions.
              </T>
              <View style={{ width: 44, height: 44 }}>
                <LivingLight size={44} mood="listen" touchable />
              </View>
            </View>
          </Rise>

          <Rise d={2}>
            <View style={styles.inputRow}>
              <TextInput
                value={topic}
                onChangeText={setTopic}
                placeholder={pages.length ? "What is this topic called?" : "Enzyme kinetics, say"}
                placeholderTextColor={colour.textDim}
                returnKeyType="go"
                onSubmitEditing={() => start(topic)}
                style={styles.input}
                accessibilityLabel="Topic"
              />
              <Press onPress={() => start(topic)} disabled={!topic.trim()} accessibilityRole="button" accessibilityLabel="Start explaining" style={{ opacity: topic.trim() ? 1 : 0.4 }}>
                <Soft lit={!!topic.trim()} style={{ width: 54, height: 54 }}>
                  <Icon name="mic" color={topic.trim() ? colour.onLight : colour.text} />
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
            <Rise d={3}>
              <Label style={{ marginTop: 20, marginLeft: 4 }}>Recent</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {recent.map((t) => (
                  <Press key={t.title} onPress={() => start(t.title)} accessibilityRole="button">
                    <View style={styles.chip}>
                      <T size={14} tone="soft">
                        {t.title}
                      </T>
                    </View>
                  </Press>
                ))}
              </View>
            </Rise>
          )}

          <Rise d={4}>
            <Label style={{ marginTop: 22, marginLeft: 4 }}>{pages.length ? "Your notes" : "Or give Fenny your notes"}</Label>
            {!scan && (
              <Press onPress={scanNotes} accessibilityRole="button" accessibilityLabel="Scan pages of your notes">
                <View style={styles.scanRow}>
                  <View style={styles.scanIcon}>
                    <Icon name="camera" size={20} color="#C9CDD4" />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <T size={15.5} weight="medium">
                      Scan pages
                    </T>
                    <T size={13} tone="muted">
                      Textbook, handouts, handwriting
                    </T>
                  </View>
                  <Icon name="chevron" size={18} color={colour.muted} />
                </View>
              </Press>
            )}
            <Press onPress={addFile} accessibilityRole="button" accessibilityLabel="Add a file: PDF, slides or Word">
              <View style={styles.scanRow}>
                <View style={styles.scanIcon}>
                  {fileState.busy ? <LivingLight size={24} mood="think" /> : <Icon name="file" size={20} color="#C9CDD4" />}
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <T size={15.5} weight="medium">
                    {fileState.busy ? "Reading your file…" : files.length ? "Add another file" : "Add a file"}
                  </T>
                  <T size={13} tone="muted">
                    PDF, slides or Word, from Files or Drive
                  </T>
                </View>
                <Icon name="chevron" size={18} color={colour.muted} />
              </View>
            </Press>
            {fileState.error ? (
              <T size={13} style={{ color: "#E5A794", marginTop: 8, marginLeft: 4 }}>
                {fileState.error}
              </T>
            ) : null}
            {files.map((f, i) => (
              <View key={`${f.name}-${i}`} style={[styles.scanRow, { paddingVertical: 10 }]}>
                <View style={styles.scanIcon}>
                  <Icon name="check" size={18} color="#C9CDD4" />
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <T size={14.5} weight="medium" lines={1}>
                    {f.name}
                  </T>
                  <T size={12.5} tone="dim">
                    {f.pages > 1 ? `${f.pages} slides · ` : ""}
                    {words(f.text)} words read
                  </T>
                </View>
                <Pressable onPress={() => setFiles((all) => all.filter((_, k) => k !== i))} accessibilityRole="button" accessibilityLabel={`Remove ${f.name}`} hitSlop={8}>
                  <T size={13} tone="dim">
                    Remove
                  </T>
                </Pressable>
              </View>
            ))}
            {!pasted && !pasting && (
              <Press onPress={() => setPasting(true)} accessibilityRole="button" accessibilityLabel="Paste your notes">
                <View style={styles.scanRow}>
                  <View style={styles.scanIcon}>
                    <Icon name="paste" size={20} color="#C9CDD4" />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <T size={15.5} weight="medium">
                      Paste your notes
                    </T>
                    <T size={13} tone="muted">
                      From an email or a web page
                    </T>
                  </View>
                  <Icon name="chevron" size={18} color={colour.muted} />
                </View>
              </Press>
            )}
            {pasting && (
              <Animated.View entering={FadeIn}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Paste or type your notes here"
                  placeholderTextColor={colour.textDim}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                  style={styles.pasteBox}
                  accessibilityLabel="Your notes"
                />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <PillButton label="Cancel" onPress={() => setPasting(false)} style={{ flex: 1, height: 46 }} />
                  <PillButton label="Use these notes" variant="solid" onPress={usePasted} style={{ flex: 1, height: 46, opacity: draft.trim() ? 1 : 0.5 }} />
                </View>
              </Animated.View>
            )}
            {!!pasted && (
              <View style={[styles.scanRow, { alignItems: "flex-start" }]}>
                <View style={styles.scanIcon}>
                  <Icon name="check" size={18} color="#C9CDD4" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={15} weight="medium">
                    Pasted notes · {words(pasted)} words
                  </T>
                  <T size={12.5} tone="dim" lines={2}>
                    {pasted.replace(/[#*>-]+/g, " ").replace(/\s+/g, " ").trim()}
                  </T>
                  <View style={{ flexDirection: "row", gap: 18, marginTop: 6 }}>
                    <Pressable
                      onPress={() => {
                        setDraft(pasted);
                        setPasted("");
                        setPasting(true);
                      }}
                      accessibilityRole="button"
                      hitSlop={8}
                    >
                      <T size={13} tone="soft" weight="semibold">
                        Edit
                      </T>
                    </Pressable>
                    <Pressable onPress={() => setPasted("")} accessibilityRole="button" hitSlop={8}>
                      <T size={13} tone="dim">
                        Remove
                      </T>
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
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
    backgroundColor: "#131417",
  },
  grabber: { alignSelf: "center", width: 38, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.22)" },
  chip: { height: 40, borderRadius: 999, paddingHorizontal: 15, justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)" },
  pasteBox: {
    marginTop: 10,
    minHeight: 140,
    maxHeight: 240,
    borderRadius: 20,
    padding: 16,
    paddingTop: 14,
    fontSize: 15,
    lineHeight: 21,
    color: colour.text,
    backgroundColor: "rgba(255,255,255,0.07)",
    fontFamily: font.regular,
  },
  scanRow: { marginTop: 10, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, paddingLeft: 12, paddingRight: 16, backgroundColor: "rgba(255,255,255,0.055)" },
  scanIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  scanCard: { marginTop: 10, borderRadius: 22, padding: 14 },
  inputRow: { marginTop: 20, flexDirection: "row", alignItems: "center", gap: 10 },
  input: {
    flex: 1,
    height: 54,
    borderRadius: 999,
    paddingHorizontal: 20,
    fontSize: 16,
    color: colour.text,
    backgroundColor: "rgba(255,255,255,0.07)",
    fontFamily: font.regular,
  },
});

function words(t: string) {
  return t.trim().split(/\s+/).filter(Boolean).length.toLocaleString("en-GB");
}

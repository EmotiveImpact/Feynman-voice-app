// Topics, from the canvas board: every topic you've explained.
import { Press } from "../ui/Press";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import type { SharedValue } from "react-native-reanimated";
import { ago, photoFor, type Profile, type TopicRecord } from "../data/profile";
import { Icon, T } from "../ui/kit";
import { Soft } from "../ui/Soft";
import { IdeaDots } from "./IdeaDots";
import { Page } from "./Page";
import { CARD, In, mins } from "./Today";

export function Topics({ profile, top, bottom, scrollY, onNew, onTopic }: { profile: Profile; top: number; bottom: number; scrollY: SharedValue<number>; onNew: () => void; onTopic: (t: string) => void }) {
  const n = profile.topics.length;
  return (
    <Page top={top} bottom={bottom} scrollY={scrollY} style={{ gap: 10 }}>
      <In d={1}>
        <View style={styles.head}>
          <View style={{ flex: 1, gap: 4 }}>
            <T size={30} weight="medium">
              Topics
            </T>
            <T size={15} tone="muted">
              {n === 0 ? "Nothing here yet. Start your first one." : n === 1 ? "1 topic you've taught Fenny" : `${n} topics you've taught Fenny`}
            </T>
          </View>
          <Press onPress={onNew} accessibilityRole="button" accessibilityLabel="New topic">
            <Soft style={{ width: 48, height: 48 }}>
              <Icon name="plus" size={21} color="#D6D9DE" />
            </Soft>
          </Press>
        </View>
      </In>
      {profile.topics.map((t, i) => {
        const photo = photoFor(profile, t.title);
        const ideas = t.ideas?.slice(0, 7) ?? [];
        return (
          <In key={t.title} d={2 + Math.min(i, 6)}>
            <Press
              // A topic with ideas opens its stars; one without starts a call.
              onPress={() => (t.ideas?.length ? router.push({ pathname: "/map", params: { topic: t.title } }) : onTopic(t.title))}
              accessibilityRole="button"
              accessibilityLabel={t.ideas?.length ? `See ${t.title}` : `Explain ${t.title} again`}
            >
              <View style={styles.row}>
                {/* Teach me this thing: the photo the topic started from. */}
                {photo ? <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
                    <T size={17} weight="semibold" style={{ flex: 1 }} lines={1}>
                      {t.title}
                    </T>
                    <T size={13} tone="muted">
                      {ago(t.at)}
                    </T>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 24 }}>
                    <View style={{ flex: 1 }}>
                      {ideas.length ? (
                        <IdeaDots total={ideas.length} lit={ideas.filter((k) => t.known?.includes(k.id)).length} />
                      ) : (
                        <T size={13} tone="muted">
                          {t.sessions === 1 ? "1 session" : `${t.sessions} sessions`} · {mins(t.seconds)} explaining
                        </T>
                      )}
                    </View>
                    {open(t) > 0 && (
                      <View style={styles.pill}>
                        <T size={12.5} style={{ color: "#F0AE9B" }}>
                          {open(t) === 1 ? "1 gap" : `${open(t)} gaps`}
                        </T>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </Press>
          </In>
        );
      })}
    </Page>
  );
}

const open = (t: TopicRecord) => (t.gaps ?? []).filter((g) => !g.clearedAt).length;

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 30, marginBottom: 14, paddingLeft: 2 },
  row: { ...CARD, flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 17, paddingHorizontal: 18 },
  photo: { width: 52, height: 52, borderRadius: 14, backgroundColor: "#24272C" },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(240,154,128,0.14)" },
});

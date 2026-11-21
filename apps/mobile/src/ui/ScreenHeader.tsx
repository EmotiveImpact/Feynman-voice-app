// The top of a screen you came into from somewhere else (a topic, Settings):
// a round back button on the left, the screen's name in the middle at the
// same size as the home pages' top bar, and an optional thing on the right.
// The page fades out under it as it scrolls, so text never runs behind it.
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Extrapolation, interpolate, type SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { colour } from "../theme";
import { Icon, T } from "./kit";
import { Press } from "./Press";
import { Soft } from "./Soft";

export const HEADER_H = 56;

export function ScreenHeader({ top, title, backLabel = "Back", scrollY, titleAlways = false, right, onBack }: { top: number; title: string; backLabel?: string; scrollY: SharedValue<number>; titleAlways?: boolean; right?: ReactNode; onBack?: () => void }) {
  const shade = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [2, 36], [0, 1], Extrapolation.CLAMP) }));
  const name = useAnimatedStyle(() =>
    titleAlways
      ? { opacity: 1 }
      : {
          opacity: interpolate(scrollY.value, [40, 80], [0, 1], Extrapolation.CLAMP),
          transform: [{ translateY: interpolate(scrollY.value, [40, 80], [6, 0], Extrapolation.CLAMP) }],
        },
  );
  return (
    <View pointerEvents="box-none" style={[styles.bar, { paddingTop: top + 4 }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { bottom: -40 }, shade]}>
        <LinearGradient colors={[colour.ground, colour.ground, "rgba(8,9,11,0)"]} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Press onPress={onBack ?? (() => router.back())} accessibilityRole="button" accessibilityLabel={backLabel} hitSlop={6}>
        <Soft style={{ width: 42, height: 42 }}>
          <Icon name="back" size={20} color="#D6D9DE" />
        </Soft>
      </Press>
      <Animated.View pointerEvents="none" style={[styles.title, name]}>
        <T size={16} weight="semibold" lines={1}>
          {title}
        </T>
      </Animated.View>
      <View style={styles.side}>{right}</View>
    </View>
  );
}

/** A scroll position and its handler, for a screen with a ScreenHeader. */
export function useHeaderScroll() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  return { scrollY, onScroll };
}

const styles = StyleSheet.create({
  bar: { position: "absolute", left: 0, right: 0, top: 0, zIndex: 5, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 8, minHeight: HEADER_H },
  title: { flex: 1, alignItems: "center" },
  side: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
});

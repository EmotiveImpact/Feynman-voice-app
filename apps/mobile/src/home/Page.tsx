// One home page: a scroll view that tells the top bar how far it has moved,
// with the same edges on every tab.
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { type SharedValue, useAnimatedScrollHandler } from "react-native-reanimated";
import { homeStyles } from "./styles";

export function Page({ top, bottom, scrollY, children, style }: { top: number; bottom: number; scrollY: SharedValue<number>; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  return (
    <Animated.ScrollView
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={[homeStyles.scroll, { paddingTop: top + 64, paddingBottom: bottom + 130 }, style]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </Animated.ScrollView>
  );
}


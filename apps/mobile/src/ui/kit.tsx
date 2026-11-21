// Small shared pieces: type, glass, buttons, backgrounds, icons.
import type { ReactNode } from "react";
import { BUTTON_SHADOW, LIT_BG, SOFT_BG } from "./Soft";
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colour, font, radius } from "../theme";
import { FennyAura, type AuraScene } from "./FennyAura";
import { Press } from "./Press";

export const images = {
  horizon: require("../../assets/images/horizon.webp"),
  aurora: require("../../assets/images/aurora.webp"),
  cardReview: require("../../assets/images/card-review.webp"),
  cardGap: require("../../assets/images/card-gap.webp"),
  titanium: require("../../assets/images/panel-titanium.webp"),
};

type Tone = "text" | "dim" | "muted" | "soft" | "student" | "gap" | "dark";
const tones: Record<Tone, string> = {
  text: colour.text,
  dim: colour.textDim,
  muted: colour.muted,
  soft: colour.soft,
  student: colour.student,
  gap: colour.gap,
  dark: colour.onLight,
};

export function T({
  children,
  size = 16,
  weight = "regular",
  tone = "text",
  style,
  lines,
}: {
  children: ReactNode;
  size?: number;
  weight?: "regular" | "medium" | "semibold" | "mono";
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  lines?: number;
}) {
  const family = weight === "mono" ? font.mono : font[weight];
  // Inter tracked in a touch, as Linear does: tighter on headings than body.
  const tight = size >= 24 ? { letterSpacing: -size * 0.022, lineHeight: size * 1.1 } : { letterSpacing: weight === "mono" ? 0 : -size * 0.011, lineHeight: size * 1.45 };
  return (
    <Text numberOfLines={lines} style={[{ fontFamily: family, fontSize: size, color: tones[tone] }, tight, style]}>
      {children}
    </Text>
  );
}

/** A quiet section heading: small, medium weight, written as a sentence. */
export function Label({ children, tone = "muted", style }: { children: ReactNode; tone?: Tone; style?: StyleProp<TextStyle> }) {
  return (
    <T size={13.5} weight="medium" tone={tone} style={style}>
      {children}
    </T>
  );
}

/**
 * A glass surface: a soft blurred fill with no outline and no top edge.
 * `strong` is the denser glass for bars.
 */
export function Glass({ children, style, strong, blur = 28 }: { children?: ReactNode; style?: StyleProp<ViewStyle>; strong?: boolean; blur?: number }) {
  return (
    <View style={[styles.glass, strong && { backgroundColor: colour.glassStrong }, style]}>
      <BlurView intensity={blur} tint="dark" style={StyleSheet.absoluteFill} />
      {!strong && <LinearGradient pointerEvents="none" colors={["rgba(255,255,255,0.055)", "rgba(255,255,255,0.025)"]} style={StyleSheet.absoluteFill} />}
      {children}
    </View>
  );
}

/** The living background: drifting blurred lights drawn in code, placed per screen (see FennyAura). */
export function Backdrop({ scene }: { scene?: AuraScene }) {
  return <FennyAura scene={scene} />;
}

export function PillButton({
  label,
  onPress,
  variant = "glass",
  style,
  accessibilityLabel,
  children,
}: {
  label?: string;
  onPress?: () => void;
  variant?: "solid" | "glass";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  children?: ReactNode;
}) {
  const solid = variant === "solid";
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={[styles.pill, solid ? styles.solid : styles.ghost, style, StyleSheet.flatten(style)?.backgroundColor === "transparent" && styles.flat]}
    >
      {/* Solid soft silver (primary) or solid graphite: no bevel, no edge. */}
      {children ?? (
        <T size={15} weight={solid ? "semibold" : "regular"} tone={solid ? "dark" : "text"} style={solid ? undefined : { color: "#D6D9DE" }}>
          {label}
        </T>
      )}
    </Press>
  );
}

export function RoundButton({ onPress, label, children, size = 48, on }: { onPress?: () => void; label: string; children: ReactNode; size?: number; on?: boolean }) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={on === undefined ? undefined : { expanded: on }}
      onPress={onPress}
      style={[styles.round, { width: size, height: size }, on && { backgroundColor: "#34383F" }]}
    >
      {children}
    </Press>
  );
}

export function Stat({ value, label, tone = "text" }: { value: string; label: string; tone?: Tone }) {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <T size={28} weight="medium" tone={tone} style={{ lineHeight: 32 }}>
        {value}
      </T>
      <T size={12.5} tone="muted">
        {label}
      </T>
    </View>
  );
}

type IconName = "mic" | "close" | "check" | "pause" | "person" | "wave" | "camera" | "arrow" | "plus" | "chevron" | "back" | "settings" | "paste" | "file";
export function Icon({ name, size = 20, color = colour.text }: { name: IconName; size?: number; color?: string }) {
  const p = { stroke: color, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "mic" && (
        <>
          <Rect x={9} y={3} width={6} height={12} rx={3} {...p} />
          <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" {...p} />
        </>
      )}
      {name === "arrow" && <Path d="M5 12h14M13 6l6 6-6 6" {...p} />}
      {name === "plus" && <Path d="M12 5v14M5 12h14" {...p} />}
      {name === "back" && <Path d="M15 6l-6 6 6 6" {...p} />}
      {name === "settings" && (
        <>
          <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" {...p} />
          <Circle cx={16} cy={7} r={2} {...p} />
          <Circle cx={10} cy={17} r={2} {...p} />
        </>
      )}
      {name === "paste" && (
        <>
          <Rect x={6} y={5} width={12} height={15} rx={2} {...p} />
          <Path d="M9.5 5V3.5h5V5M9 10h6M9 13.5h6M9 17h3.5" {...p} />
        </>
      )}
      {name === "file" && <Path d="M7 3.5h6.5L18 8v12.5H7zM13 3.5V8.5h5M10 13h5M10 16.5h5" {...p} />}
      {name === "chevron" && <Path d="M9 6l6 6-6 6" {...p} />}
      {name === "close" && <Path d="M6 6l12 12M18 6L6 18" {...p} />}
      {name === "check" && <Path d="M5 12.5l4.5 4.5L19 7.5" {...p} />}
      {name === "pause" && <Path d="M9 6v12M15 6v12" {...p} />}
      {name === "person" && (
        <>
          <Circle cx={12} cy={9} r={3.5} {...p} />
          <Path d="M5 20a7 7 0 0 1 14 0" {...p} />
        </>
      )}
      {name === "wave" && <Path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" {...p} />}
      {name === "camera" && (
        <>
          <Path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.5-2h5.6l1.5 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" {...p} />
          <Circle cx={12} cy={13} r={3.5} {...p} />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  glass: { borderRadius: radius.card, overflow: "hidden" },
  // Solid buttons on a soft shadow (see Soft): no overflow clip, or iOS drops the shadow.
  pill: { height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, ...BUTTON_SHADOW },
  solid: { backgroundColor: LIT_BG },
  ghost: { backgroundColor: SOFT_BG },
  flat: { shadowOpacity: 0, elevation: 0 },
  round: { borderRadius: 999, backgroundColor: SOFT_BG, alignItems: "center", justifyContent: "center", ...BUTTON_SHADOW },
});

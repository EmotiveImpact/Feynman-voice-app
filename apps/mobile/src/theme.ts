// Design tokens for the "one light" direction (round 3 on the design canvas).
// Graphite ground, glass surfaces, silver for the one thing to press,
// a soft steel-blue light for the student, coral only ever for a gap.

export const colour = {
  ground: "#08090B",
  glass: "rgba(255,255,255,0.07)",
  glassStrong: "rgba(18,19,22,0.72)",
  hairline: "rgba(255,255,255,0.12)",
  hairlineSoft: "rgba(255,255,255,0.08)",
  // Softened a touch (build 11): body text and labels sit lower in contrast.
  text: "#E4E6EA",
  textDim: "#747982",
  muted: "#888D96",
  soft: "#A9ADB4",
  silver: "#E6E9EE",
  student: "#A9BEE6",
  gap: "#F09A80",
  clear: "#E6E9EE",
  onLight: "#141519",
} as const;

// Inter, as on the website (Linear-style: medium headings, regular body).
// The wordmark keeps Instrument Sans.
export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  wordmark: "InstrumentSans_600SemiBold",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
} as const;

export const radius = { card: 24, sheet: 38, pill: 999 } as const;

export const space = { gutter: 20, gap: 10 } as const;

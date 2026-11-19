// A topic's ideas as a row of small dots, lit ones first.
import { StyleSheet, View } from "react-native";
import { T } from "../ui/kit";

export function IdeaDots({ total, lit, note = true }: { total: number; lit: number; note?: boolean }) {
  return (
    <View style={styles.row} accessibilityLabel={`${lit} of ${total} ideas explained`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, i < lit && styles.lit]} />
      ))}
      {note && (
        <T size={13} tone="muted" style={{ marginLeft: 4 }}>
          {lit} of {total} ideas
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(214,218,226,0.2)" },
  lit: { backgroundColor: "#C3D0EA" },
});

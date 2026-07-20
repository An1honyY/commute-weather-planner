import { StyleSheet, Text, View } from "react-native";

// Gear recommendation card — docs/09-design-system.md §9.3 item 4. The
// real recommendGear() engine doesn't exist until Phase 5
// (docs/07-recommendation-engine.md), so Phase 3 renders the same slot
// layout the engine's Recommendation type will eventually fill (layers
// stack / accessories row / bottoms-shoes-umbrella slots / notes list)
// with static placeholder content — the structural shell "looks right,"
// per the phase description, ahead of real data.
export default function GearRecommendationCard() {
  return (
    <View style={styles.card}>
      <View style={styles.layerStack}>
        <Text style={styles.fallback}>Jacket recommendation — coming once the engine is wired up (Phase 5)</Text>
      </View>
      <View style={styles.slotsRow}>
        <Text style={styles.slotFallback}>Shoes</Text>
        <Text style={styles.slotFallback}>Umbrella</Text>
      </View>
      <Text style={styles.note}>· Gear picks will reflect your actual wardrobe once Gear and the engine are connected.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { margin: 16, padding: 16, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDE1EA", gap: 12 },
  layerStack: { gap: 4 },
  fallback: { fontSize: 14, fontStyle: "italic", color: "#5C6478" },
  slotsRow: { flexDirection: "row", gap: 16 },
  slotFallback: { fontSize: 13, fontStyle: "italic", color: "#5C6478" },
  note: { fontSize: 12, color: "#5C6478" },
});

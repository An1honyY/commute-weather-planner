import { StyleSheet, Text, View } from "react-native";
import type { Recommendation } from "../../lib/recommend";

// Gear recommendation card — docs/09-design-system.md §9.3 item 4, now
// backed by the real recommendGear() engine (docs/07-recommendation-
// engine.md §7, docs/08-build-phases.md Phase 5) instead of Phase 3's
// static placeholder. Purely presentational — JourneyDetailScreen computes
// the Recommendation once and shares it with the severe-weather banner
// above this card.
// Works for any resolved-or-fallback pick (LayerPick, Recommendation.shoes,
// Recommendation.umbrella) — they all share the same "real item has a
// name, fallback has fallbackText" shape.
function pickLabel(pick: { name: string } | { fallbackText: string }): { text: string; isFallback: boolean } {
  return "name" in pick ? { text: pick.name, isFallback: false } : { text: pick.fallbackText, isFallback: true };
}

interface Props {
  recommendation: Recommendation;
}

export default function GearRecommendationCard({ recommendation }: Props) {
  // §9.3 — visually base at the bottom working up to jacket on top;
  // layerPlanForWarmthLevel resolves base-first, so reverse for display.
  const layersTopDown = [...recommendation.layers].reverse();

  const shoesLabel = recommendation.shoes ? pickLabel(recommendation.shoes) : undefined;
  const umbrellaLabel = recommendation.umbrella ? pickLabel(recommendation.umbrella) : undefined;
  const bottomsLabel = recommendation.bottoms ? pickLabel(recommendation.bottoms) : undefined;

  return (
    <View style={styles.card}>
      {layersTopDown.length > 0 && (
        <View style={styles.layerStack}>
          {layersTopDown.map((pick, i) => {
            const { text, isFallback } = pickLabel(pick);
            return (
              <Text key={i} style={isFallback ? styles.fallback : styles.layerText}>
                {text}
              </Text>
            );
          })}
        </View>
      )}

      {recommendation.accessories.length > 0 && (
        <View style={styles.accessoriesRow}>
          {recommendation.accessories.map((pick, i) => {
            const { text, isFallback } = pickLabel(pick);
            return (
              <Text key={i} style={isFallback ? styles.fallback : styles.accessoryText}>
                {text}
              </Text>
            );
          })}
        </View>
      )}

      <View style={styles.slotsRow}>
        {bottomsLabel && (
          <Text style={bottomsLabel.isFallback ? styles.fallback : styles.slotText}>{bottomsLabel.text}</Text>
        )}
        {shoesLabel && <Text style={shoesLabel.isFallback ? styles.fallback : styles.slotText}>{shoesLabel.text}</Text>}
        {umbrellaLabel && (
          <Text style={umbrellaLabel.isFallback ? styles.fallback : styles.slotText}>{umbrellaLabel.text}</Text>
        )}
      </View>

      {recommendation.notes.length > 0 && (
        <View style={styles.notes}>
          {recommendation.notes.map((note, i) => (
            <Text key={i} style={styles.note}>
              · {note}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { margin: 16, padding: 16, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDE1EA", gap: 12 },
  layerStack: { gap: 4 },
  layerText: { fontSize: 15, fontWeight: "600" },
  fallback: { fontSize: 14, fontStyle: "italic", color: "#5C6478" },
  accessoriesRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  accessoryText: { fontSize: 13 },
  slotsRow: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  slotText: { fontSize: 13, fontWeight: "600" },
  notes: { gap: 4 },
  note: { fontSize: 12, color: "#5C6478" },
});

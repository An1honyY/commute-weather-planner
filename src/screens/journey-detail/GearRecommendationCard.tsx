import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Recommendation } from "../../lib/recommend";
import useTheme from "../../theme/useTheme";
import type { GearAddTarget } from "../../navigation/types";
import type { RecommendationSnapshot } from "../../types";

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
  recommendation?: Recommendation;
  // docs/09-design-system.md §9.4.2 — History's detail view swaps the live
  // Recommendation for the frozen RecommendationSnapshot fields where one
  // exists, rather than re-running the engine against inventory that may
  // have since changed. Snapshot names are flat strings — no fallback/
  // real-item distinction survives the freeze, so they render plainly.
  snapshot?: RecommendationSnapshot;
  // §9.6 — "fallback text should read as an action... double tap to add
  // one," matching the empty-state CTA pattern from §4.1. Only meaningful
  // for a live `recommendation` (tap navigates to the matching Gear add
  // form) — a frozen `snapshot` describes a past journey's pick, and
  // there's nothing actionable about adding gear retroactively to it, so
  // this is simply never passed/used in that branch.
  onAddGear?: (target: GearAddTarget) => void;
}

// A fallback Text becomes a Pressable when onAddGear is supplied (live
// mode only — GearRecommendationCard never passes it in the snapshot
// branch). Module-level, not nested in the component, so it isn't
// recreated every render.
function FallbackText({
  text,
  target,
  style,
  onAddGear,
}: {
  text: string;
  target: GearAddTarget;
  style: object;
  onAddGear?: (target: GearAddTarget) => void;
}) {
  if (!onAddGear) return <Text style={style}>{text}</Text>;
  return (
    <Pressable
      onPress={() => onAddGear(target)}
      accessibilityRole="button"
      accessibilityLabel={`${text} — double tap to add one`}
      hitSlop={8}
    >
      <Text style={style}>{text}</Text>
    </Pressable>
  );
}

export default function GearRecommendationCard({ recommendation, snapshot, onAddGear }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  if (snapshot) {
    const layersTopDown = [...snapshot.layerNames].reverse();
    return (
      <View style={styles.card}>
        {layersTopDown.length > 0 && (
          <View style={styles.layerStack}>
            {layersTopDown.map((name, i) => (
              <Text key={i} style={styles.layerText}>
                {name}
              </Text>
            ))}
          </View>
        )}

        {snapshot.accessoryNames.length > 0 && (
          <View style={styles.accessoriesRow}>
            {snapshot.accessoryNames.map((name, i) => (
              <Text key={i} style={styles.accessoryText}>
                {name}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.slotsRow}>
          {snapshot.shoeName && <Text style={styles.slotText}>{snapshot.shoeName}</Text>}
          {snapshot.umbrellaName && <Text style={styles.slotText}>{snapshot.umbrellaName}</Text>}
        </View>

        {snapshot.notes.length > 0 && (
          <View style={styles.notes}>
            {snapshot.notes.map((note, i) => (
              <Text key={i} style={styles.note}>
                · {note}
              </Text>
            ))}
          </View>
        )}
      </View>
    );
  }

  if (!recommendation) return null;

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
            if (isFallback && "layerType" in pick) {
              return (
                <FallbackText
                  key={i}
                  text={text}
                  target={{ kind: "clothing", clothingType: pick.layerType }}
                  style={styles.fallback}
                  onAddGear={onAddGear}
                />
              );
            }
            return (
              <Text key={i} style={styles.layerText}>
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
            if (isFallback) {
              return (
                <FallbackText
                  key={i}
                  text={text}
                  target={{ kind: "clothing", clothingType: "accessory" }}
                  style={styles.fallback}
                  onAddGear={onAddGear}
                />
              );
            }
            return (
              <Text key={i} style={styles.accessoryText}>
                {text}
              </Text>
            );
          })}
        </View>
      )}

      <View style={styles.slotsRow}>
        {bottomsLabel &&
          (bottomsLabel.isFallback ? (
            <FallbackText
              text={bottomsLabel.text}
              target={{ kind: "clothing", clothingType: "bottoms" }}
              style={styles.fallback}
              onAddGear={onAddGear}
            />
          ) : (
            <Text style={styles.slotText}>{bottomsLabel.text}</Text>
          ))}
        {shoesLabel &&
          (shoesLabel.isFallback ? (
            <FallbackText text={shoesLabel.text} target={{ kind: "shoe" }} style={styles.fallback} onAddGear={onAddGear} />
          ) : (
            <Text style={styles.slotText}>{shoesLabel.text}</Text>
          ))}
        {umbrellaLabel &&
          (umbrellaLabel.isFallback ? (
            <FallbackText
              text={umbrellaLabel.text}
              target={{ kind: "umbrella" }}
              style={styles.fallback}
              onAddGear={onAddGear}
            />
          ) : (
            <Text style={styles.slotText}>{umbrellaLabel.text}</Text>
          ))}
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

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      margin: 16,
      padding: 16,
      borderRadius: 12,
      backgroundColor: theme.surfaceRaised,
      borderWidth: theme.surfaceRaisedBorder === "transparent" ? 0 : 1,
      borderColor: theme.surfaceRaisedBorder,
      gap: 12,
    },
    layerStack: { gap: 4 },
    layerText: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    fallback: { fontSize: 14, fontStyle: "italic", color: theme.textSecondary },
    accessoriesRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    accessoryText: { fontSize: 13, color: theme.textPrimary },
    slotsRow: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
    slotText: { fontSize: 13, fontWeight: "600", color: theme.textPrimary },
    notes: { gap: 4 },
    note: { fontSize: 12, color: theme.textSecondary },
  });
}

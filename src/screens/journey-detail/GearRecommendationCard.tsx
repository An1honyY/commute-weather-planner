import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LayerPick, Recommendation } from "../../lib/recommend";
import useTheme from "../../theme/useTheme";
import { cardElevationStyle } from "../../theme/tokens";
import { SPACING, TYPE } from "../../theme/typography";
import ClothingTypeIcon, { accessoryIconKind, type ClothingIconKind } from "../../components/ClothingTypeIcon";
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

// §9.3 (2026-07-21) — every layer/accessory/slot row leads with an icon,
// not just bold text. Only meaningful against a live `recommendation`
// (LayerPick/ShoeItem/UmbrellaItem carry type info); the frozen `snapshot`
// path has nothing but flat name strings post-freeze, so it stays icon-less.
function layerIconKind(pick: LayerPick): ClothingIconKind {
  const type = "layerType" in pick ? pick.layerType : pick.type;
  if (type === "accessory") return accessoryIconKind("fallbackText" in pick ? pick.fallbackText : pick.name);
  if (type === "jacket" || type === "midlayer" || type === "base" || type === "bottoms") return type;
  return "accessory";
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
    // layerTypes is index-matched to layerNames (pre-reversal) — zip them
    // together before reversing so a name never ends up paired with the
    // wrong type. Missing on snapshots frozen before this field existed;
    // those layers just render without an icon rather than a wrong one.
    const layersTopDown = [...snapshot.layerNames]
      .map((name, i) => ({ name, kind: snapshot.layerTypes?.[i] }))
      .reverse();
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recommended gear</Text>
        {layersTopDown.length > 0 && (
          <View style={styles.layerStack}>
            {layersTopDown.map(({ name, kind }, i) => (
              <View key={i} style={styles.pickRow}>
                {kind && <ClothingTypeIcon kind={kind} size={16} color={theme.accentWalk} />}
                <Text style={styles.layerText}>{name}</Text>
              </View>
            ))}
          </View>
        )}

        {snapshot.accessoryNames.length > 0 && (
          <View style={styles.accessoriesRow}>
            {snapshot.accessoryNames.map((name, i) => (
              <View key={i} style={styles.pickRow}>
                <ClothingTypeIcon kind={accessoryIconKind(name)} size={15} color={theme.accentWalk} />
                <Text style={styles.accessoryText}>{name}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.slotsRow}>
          {snapshot.shoeName && (
            <View style={styles.pickRow}>
              <ClothingTypeIcon kind="shoe" size={15} color={theme.accentWalk} />
              <Text style={styles.slotText}>{snapshot.shoeName}</Text>
            </View>
          )}
          {snapshot.umbrellaName && (
            <View style={styles.pickRow}>
              <ClothingTypeIcon kind="umbrella" size={15} color={theme.accentWalk} />
              <Text style={styles.slotText}>{snapshot.umbrellaName}</Text>
            </View>
          )}
        </View>

        {snapshot.notes.length > 0 && (
          <View style={styles.notesCallout}>
            <View style={styles.notesAccentBar} />
            <View style={styles.notesTextCol}>
              {snapshot.notes.map((note, i) => (
                <Text key={i} style={styles.note}>
                  {note}
                </Text>
              ))}
            </View>
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
      <Text style={styles.cardTitle}>Recommended gear</Text>
      {layersTopDown.length > 0 && (
        <View style={styles.layerStack}>
          {layersTopDown.map((pick, i) => {
            const { text, isFallback } = pickLabel(pick);
            const icon = <ClothingTypeIcon kind={layerIconKind(pick)} size={16} color={isFallback ? theme.textSecondary : theme.accentWalk} />;
            if (isFallback && "layerType" in pick) {
              return (
                <View key={i} style={styles.pickRow}>
                  {icon}
                  <FallbackText
                    text={text}
                    target={{ kind: "clothing", clothingType: pick.layerType }}
                    style={styles.fallback}
                    onAddGear={onAddGear}
                  />
                </View>
              );
            }
            return (
              <View key={i} style={styles.pickRow}>
                {icon}
                <Text style={styles.layerText}>{text}</Text>
              </View>
            );
          })}
        </View>
      )}

      {recommendation.accessories.length > 0 && (
        <View style={styles.accessoriesRow}>
          {recommendation.accessories.map((pick, i) => {
            const { text, isFallback } = pickLabel(pick);
            const icon = <ClothingTypeIcon kind={layerIconKind(pick)} size={15} color={isFallback ? theme.textSecondary : theme.accentWalk} />;
            if (isFallback) {
              return (
                <View key={i} style={styles.pickRow}>
                  {icon}
                  <FallbackText
                    text={text}
                    target={{ kind: "clothing", clothingType: "accessory" }}
                    style={styles.fallback}
                    onAddGear={onAddGear}
                  />
                </View>
              );
            }
            return (
              <View key={i} style={styles.pickRow}>
                {icon}
                <Text style={styles.accessoryText}>{text}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.slotsRow}>
        {bottomsLabel && (
          <View style={styles.pickRow}>
            <ClothingTypeIcon kind="bottoms" size={15} color={bottomsLabel.isFallback ? theme.textSecondary : theme.accentWalk} />
            {bottomsLabel.isFallback ? (
              <FallbackText
                text={bottomsLabel.text}
                target={{ kind: "clothing", clothingType: "bottoms" }}
                style={styles.fallback}
                onAddGear={onAddGear}
              />
            ) : (
              <Text style={styles.slotText}>{bottomsLabel.text}</Text>
            )}
          </View>
        )}
        {shoesLabel && (
          <View style={styles.pickRow}>
            <ClothingTypeIcon kind="shoe" size={15} color={shoesLabel.isFallback ? theme.textSecondary : theme.accentWalk} />
            {shoesLabel.isFallback ? (
              <FallbackText text={shoesLabel.text} target={{ kind: "shoe" }} style={styles.fallback} onAddGear={onAddGear} />
            ) : (
              <Text style={styles.slotText}>{shoesLabel.text}</Text>
            )}
          </View>
        )}
        {umbrellaLabel && (
          <View style={styles.pickRow}>
            <ClothingTypeIcon kind="umbrella" size={15} color={umbrellaLabel.isFallback ? theme.textSecondary : theme.accentWalk} />
            {umbrellaLabel.isFallback ? (
              <FallbackText
                text={umbrellaLabel.text}
                target={{ kind: "umbrella" }}
                style={styles.fallback}
                onAddGear={onAddGear}
              />
            ) : (
              <Text style={styles.slotText}>{umbrellaLabel.text}</Text>
            )}
          </View>
        )}
      </View>

      {recommendation.notes.length > 0 && (
        <View style={styles.notesCallout}>
          <View style={styles.notesAccentBar} />
          <View style={styles.notesTextCol}>
            {recommendation.notes.map((note, i) => (
              <Text key={i} style={styles.note}>
                {note}
              </Text>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      margin: SPACING.xl,
      padding: SPACING.lg,
      borderRadius: 12,
      backgroundColor: theme.surfaceRaised,
      gap: SPACING.md,
      ...cardElevationStyle(theme),
    },
    cardTitle: { ...TYPE.subtitle, color: theme.textPrimary },
    layerStack: { gap: 6 },
    pickRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    layerText: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    fallback: { fontSize: 14, fontStyle: "italic", color: theme.textSecondary },
    accessoriesRow: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
    accessoryText: { fontSize: 13, color: theme.textPrimary },
    slotsRow: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
    slotText: { fontSize: 13, fontWeight: "600", color: theme.textPrimary },
    // A visually distinct "footnote" callout — inset against the card's
    // surfaceRaised fill with its own accent bar — so the AC-contrast/
    // warmup-discount/UV reasoning here reads as secondary context, not
    // more of the same-weight recommendation as the icon+text picks above.
    notesCallout: { flexDirection: "row", gap: SPACING.sm, backgroundColor: theme.bg, borderRadius: 8, padding: SPACING.sm },
    notesAccentBar: { width: 3, borderRadius: 2, backgroundColor: theme.accentWalk },
    notesTextCol: { flex: 1, gap: 4 },
    note: { fontSize: 12, color: theme.textSecondary },
  });
}

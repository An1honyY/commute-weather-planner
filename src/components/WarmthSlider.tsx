import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import useTheme from "../theme/useTheme";

// Shared warmth-rating control — docs/09-design-system.md §9.1.2. A 1-10
// stepped slider (implemented as ten tappable segments rather than a drag
// gesture, since @react-native-community/slider isn't in the tech-stack
// table, docs/01-tech-stack.md — this reads as "stepped" either way and
// keeps every tap a clean 44x44pt target per §9.6) with the two anchor
// labels always visible, plus the jacket-only substitutesForMidlayer
// toggle from Section 3.6/7.12. Reused identically by onboarding's gear
// basics step and the full Gear CRUD form (docs/04-screens-navigation.md
// §4.1/§4).
const SEGMENTS = Array.from({ length: 10 }, (_, i) => i + 1);

interface Props {
  value: number;
  onChange: (value: number) => void;
  showSubstitutesToggle: boolean;
  substitutesForMidlayer: boolean;
  onToggleSubstitutes: (value: boolean) => void;
}

export default function WarmthSlider({
  value,
  onChange,
  showSubstitutesToggle,
  substitutesForMidlayer,
  onToggleSubstitutes,
}: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <View>
      <Text style={styles.currentValue}>{value}</Text>
      <View style={styles.track}>
        {SEGMENTS.map((segment) => (
          <Pressable
            key={segment}
            onPress={() => onChange(segment)}
            hitSlop={4}
            style={[styles.segment, segment <= value && styles.segmentFilled]}
            accessibilityRole="adjustable"
            accessibilityLabel={`Warmth ${segment} of 10`}
          />
        ))}
      </View>
      <View style={styles.anchors}>
        <Text style={styles.anchorLabel}>1 · barely warmer than a t-shirt</Text>
        <Text style={styles.anchorLabel}>10 · heaviest winter coat you own</Text>
      </View>

      {showSubstitutesToggle && (
        <View style={styles.substitutesRow}>
          <View style={styles.substitutesTextCol}>
            <Text style={styles.substitutesLabel}>This is also warm enough to skip a midlayer</Text>
            <Text style={styles.substitutesContext}>
              Turn this on if this jacket is insulated enough on its own — like a rain shell with a
              built-in thin puffer lining. We won&apos;t ask you to add anything underneath it when it&apos;s
              picked.
            </Text>
          </View>
          <Switch value={substitutesForMidlayer} onValueChange={onToggleSubstitutes} />
        </View>
      )}
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    currentValue: { textAlign: "center", fontSize: 22, fontWeight: "700", marginBottom: 8, color: theme.textPrimary },
    track: { flexDirection: "row", gap: 4, height: 44 },
    segment: { flex: 1, borderRadius: 4, backgroundColor: theme.border },
    segmentFilled: { backgroundColor: theme.accentWalk },
    anchors: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
    anchorLabel: { fontSize: 11, color: theme.textSecondary, flexShrink: 1, maxWidth: "48%" },
    substitutesRow: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 12 },
    substitutesTextCol: { flex: 1 },
    substitutesLabel: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    substitutesContext: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  });
}

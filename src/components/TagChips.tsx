import { Pressable, StyleSheet, Text, View } from "react-native";
import useTheme from "../theme/useTheme";

// Quick-select tag chips — docs/07-recommendation-engine.md §7.6: "quick-
// select chips in the Gear CRUD add/edit form, not free text, so the engine
// can rely on matching against them." Two fixed option sets, reused as-is
// rather than free-form tagging.
export const ACCESSORY_TAG_OPTIONS = ["sunglasses", "reflective", "gloves", "hat", "scarf", "socks"] as const;
export const LAYER_TAG_OPTIONS = ["cycling", "formal"] as const; // jackets/midlayers, §7.9/§7.10
// Base layers (tops) get a "breathable" tag so the engine can resolve a
// real light/airy top in hot weather (§7.15) instead of only a note.
export const BASE_TAG_OPTIONS = ["breathable", "cycling", "formal"] as const;
// Bottoms get their own set — warm-weather preference (shorts/skirt) vs.
// trousers, on top of the same cycling/formal tags jackets/midlayers use.
export const BOTTOMS_TAG_OPTIONS = ["shorts", "skirt", "trousers", "cycling", "formal"] as const;

interface Props {
  options: readonly string[];
  selected: string[];
  onChange: (tags: string[]) => void;
}

export default function TagChips({ options, selected, onChange }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  function toggle(tag: string) {
    onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag]);
  }

  return (
    <View style={styles.row}>
      {options.map((tag) => {
        const active = selected.includes(tag);
        return (
          <Pressable
            key={tag}
            onPress={() => toggle(tag)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{tag}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: 36,
      justifyContent: "center",
    },
    chipActive: { backgroundColor: theme.accentWalk, borderColor: theme.accentWalk },
    chipLabel: { fontSize: 13, color: theme.textPrimary },
    chipLabelActive: { color: "#FFFFFF", fontWeight: "600" },
  });
}

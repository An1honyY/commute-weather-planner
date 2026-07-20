import { Pressable, StyleSheet, Text, View } from "react-native";

// Quick-select tag chips — docs/07-recommendation-engine.md §7.6: "quick-
// select chips in the Gear CRUD add/edit form, not free text, so the engine
// can rely on matching against them." Two fixed option sets, reused as-is
// rather than free-form tagging.
export const ACCESSORY_TAG_OPTIONS = ["sunglasses", "reflective", "gloves", "hat", "scarf", "socks"] as const;
export const LAYER_TAG_OPTIONS = ["cycling", "formal"] as const; // jackets/midlayers/bottoms, §7.9/§7.10/§7.13

interface Props {
  options: readonly string[];
  selected: string[];
  onChange: (tags: string[]) => void;
}

export default function TagChips({ options, selected, onChange }: Props) {
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

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DDE1EA",
    minHeight: 36,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: "#C97F2E", borderColor: "#C97F2E" },
  chipLabel: { fontSize: 13, color: "#1A1E29" },
  chipLabelActive: { color: "#FFFFFF", fontWeight: "600" },
});

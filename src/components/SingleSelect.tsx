import { Pressable, StyleSheet, Text, View } from "react-native";

// Single-select chip row for small enum fields (ShoeType, grip, windRating,
// VehicleType, weatherProtection, ClothingType) — same visual language as
// TagChips.tsx but mutually exclusive selection.
interface Props<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
}

export default function SingleSelect<T extends string>({ options, value, onChange, labels }: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{labels?.[option] ?? option}</Text>
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
  chipActive: { backgroundColor: "#1A1E29", borderColor: "#1A1E29" },
  chipLabel: { fontSize: 13, color: "#1A1E29" },
  chipLabelActive: { color: "#FFFFFF", fontWeight: "600" },
});

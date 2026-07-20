import { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { listLocations } from "../db/repositories/locations";
import type { SavedLocation } from "../types";

// Origin/destination/waypoint picker for the Plan screen —
// docs/04-screens-navigation.md §4.3/§4.3.1: "autocomplete against saved
// locations first — favorites surfaced above the rest." Free-text/Google
// Places search is Phase 4 (needs billing wiring not yet in place); this
// phase only offers the saved-location list, which `listLocations()`
// already returns favorites-first.
interface Props {
  label: string;
  value: SavedLocation | undefined;
  onChange: (location: SavedLocation) => void;
  placeholder: string;
}

export default function SavedLocationPicker({ label, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<SavedLocation[]>([]);

  useFocusEffect(
    useCallback(() => {
      listLocations().then(setLocations);
    }, [])
  );

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={styles.field}>
        <Text style={value ? styles.valueText : styles.placeholderText}>{value?.label ?? placeholder}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            {locations.length === 0 ? (
              <Text style={styles.empty}>No locations yet — add some in the Locations tab</Text>
            ) : (
              <FlatList
                data={locations}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    style={styles.option}
                  >
                    {item.isFavorite && <Text style={styles.star}>★</Text>}
                    <Text style={styles.optionLabel}>{item.label}</Text>
                    <Text style={styles.optionAddress}>{item.address}</Text>
                  </Pressable>
                )}
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, color: "#5C6478", marginTop: 12, marginBottom: 4 },
  field: { borderWidth: 1, borderColor: "#DDE1EA", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, minHeight: 44, justifyContent: "center" },
  valueText: { fontSize: 15 },
  placeholderText: { fontSize: 15, color: "#9AA3B8" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: "70%" },
  sheetTitle: { fontSize: 17, fontWeight: "600", marginBottom: 12 },
  empty: { color: "#5C6478", paddingVertical: 20, textAlign: "center" },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#DDE1EA", flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  star: { color: "#B8860B" },
  optionLabel: { fontSize: 15, fontWeight: "600" },
  optionAddress: { fontSize: 12, color: "#5C6478" },
});

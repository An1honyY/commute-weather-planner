import { useCallback, useState } from "react";
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { createLocation, deleteLocation, listLocations, updateLocation } from "../../db/repositories/locations";
import type { SavedLocation } from "../../types";
import LocationForm, { type LocationFormValues } from "./LocationForm";

type Mode = { kind: "list" } | { kind: "add" } | { kind: "edit"; location: SavedLocation };

export default function LocationsScreen() {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });

  const reload = useCallback(() => {
    listLocations().then((rows) => {
      setLocations(rows);
      setLoaded(true);
    });
  }, []);

  useFocusEffect(reload);

  async function handleSubmit(values: LocationFormValues) {
    if (mode.kind === "edit") {
      await updateLocation({ ...mode.location, ...values });
    } else {
      await createLocation(values);
    }
    setMode({ kind: "list" });
    reload();
  }

  async function handleDelete() {
    if (mode.kind !== "edit") return;
    await deleteLocation(mode.location.id);
    setMode({ kind: "list" });
    reload();
  }

  async function toggleFavorite(location: SavedLocation) {
    await updateLocation({ ...location, isFavorite: !location.isFavorite });
    reload();
  }

  if (mode.kind === "add") {
    return (
      <SafeAreaView style={styles.container}>
        <LocationForm onSubmit={handleSubmit} onCancel={() => setMode({ kind: "list" })} />
      </SafeAreaView>
    );
  }

  if (mode.kind === "edit") {
    return (
      <SafeAreaView style={styles.container}>
        <LocationForm
          initial={mode.location}
          onSubmit={handleSubmit}
          onCancel={() => setMode({ kind: "list" })}
          onDelete={handleDelete}
        />
      </SafeAreaView>
    );
  }

  const firstNonFavoriteIndex = locations.findIndex((l) => !l.isFavorite);

  return (
    <SafeAreaView style={styles.container}>
      {loaded && locations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.title}>Locations</Text>
          <Text style={styles.empty}>No locations yet — add Home and Work first</Text>
          <Pressable onPress={() => setMode({ kind: "add" })} style={styles.addButton}>
            <Text style={styles.addButtonLabel}>+ Add a location</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Pressable onPress={() => setMode({ kind: "add" })} style={styles.addButton}>
              <Text style={styles.addButtonLabel}>+ Add a location</Text>
            </Pressable>
          }
          renderItem={({ item, index }) => (
            <>
              {index === firstNonFavoriteIndex && index > 0 && <View style={styles.divider} />}
              <Pressable onPress={() => setMode({ kind: "edit", location: item })} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowAddress}>{item.address}</Text>
                </View>
                <Pressable onPress={() => toggleFavorite(item)} hitSlop={8} style={styles.starButton}>
                  <Text style={[styles.star, item.isFavorite && styles.starActive]}>
                    {item.isFavorite ? "★" : "☆"}
                  </Text>
                </Pressable>
              </Pressable>
            </>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  title: { fontSize: 20, fontWeight: "600" },
  empty: { color: "#666" },
  listContent: { padding: 16, gap: 8 },
  addButton: { paddingVertical: 12, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: "#DDE1EA", marginBottom: 8 },
  addButtonLabel: { fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#DDE1EA", marginVertical: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F6F7FA",
    marginBottom: 8,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowAddress: { fontSize: 13, color: "#5C6478", marginTop: 2 },
  starButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  star: { fontSize: 20, color: "#5C6478" },
  starActive: { color: "#B8860B" },
});

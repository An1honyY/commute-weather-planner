import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { createClothing, deleteClothing, listClothing, updateClothing } from "../../db/repositories/clothing";
import type { ClothingItem } from "../../types";
import ClothingForm from "./ClothingForm";
import GearThumbnail from "../../components/GearThumbnail";
import GearRowBadges from "../../components/GearRowBadges";
import UnavailabilitySheet from "../../components/UnavailabilitySheet";

type Mode = { kind: "list" } | { kind: "add" } | { kind: "edit"; item: ClothingItem };

export default function ClothingList() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [unavailabilityTarget, setUnavailabilityTarget] = useState<ClothingItem | null>(null);
  // Date.now() is impure to call during render — a useState lazy
  // initializer (react-hooks/purity) only runs once at mount.
  const [nowMs] = useState(() => Date.now());

  const reload = useCallback(() => {
    listClothing().then((rows) => {
      setItems(rows);
      setLoaded(true);
    });
  }, []);

  useFocusEffect(reload);

  async function handleSubmit(item: ClothingItem) {
    if (mode.kind === "edit") {
      await updateClothing(item);
    } else {
      await createClothing(item);
    }
    setMode({ kind: "list" });
    reload();
  }

  async function handleDelete() {
    if (mode.kind !== "edit") return;
    await deleteClothing(mode.item.id);
    setMode({ kind: "list" });
    reload();
  }

  async function markAsWashing(item: ClothingItem) {
    const until = new Date();
    until.setDate(until.getDate() + 2); // LAUNDRY_DEFAULT_TURNAROUND_DAYS, §7.16
    await updateClothing({
      ...item,
      unavailableUntil: until.toISOString(),
      unavailableReason: "laundry",
      wearsSinceClean: 0,
      needsCleaning: false,
    });
    reload();
  }

  function confirmMarkAsWashing(item: ClothingItem) {
    Alert.alert(`Mark ${item.name} as in the laundry?`, "This'll mark it unavailable for about 2 days and reset its wear count.", [
      { text: "Not yet", style: "cancel" },
      { text: "Mark as washing", onPress: () => markAsWashing(item) },
    ]);
  }

  if (mode.kind === "add") {
    return <ClothingForm onSubmit={handleSubmit} onCancel={() => setMode({ kind: "list" })} />;
  }

  if (mode.kind === "edit") {
    return (
      <>
        <ClothingForm
          initial={mode.item}
          onSubmit={handleSubmit}
          onCancel={() => setMode({ kind: "list" })}
          onDelete={handleDelete}
          onMarkUnavailable={() => setUnavailabilityTarget(mode.item)}
        />
        {unavailabilityTarget && (
          <UnavailabilitySheet
            key={unavailabilityTarget.id}
            initialReason={unavailabilityTarget.unavailableReason}
            onClose={() => setUnavailabilityTarget(null)}
            onConfirm={({ unavailableUntil, unavailableReason }) => {
              const laundryReset =
                unavailableReason === "laundry" ? { wearsSinceClean: 0, needsCleaning: false } : {};
              const updated = { ...unavailabilityTarget, unavailableUntil, unavailableReason, ...laundryReset };
              updateClothing(updated).then(() => {
                setMode({ kind: "edit", item: updated });
                reload();
              });
            }}
          />
        )}
      </>
    );
  }

  return (
    <View style={styles.container}>
      {loaded && items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.empty}>No clothing yet — add your first item</Text>
          <Pressable onPress={() => setMode({ kind: "add" })} style={styles.addButton}>
            <Text style={styles.addButtonLabel}>+ Add clothing</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Pressable onPress={() => setMode({ kind: "add" })} style={styles.addButton}>
              <Text style={styles.addButtonLabel}>+ Add clothing</Text>
            </Pressable>
          }
          renderItem={({ item }) => {
            const isUnavailable = !!item.unavailableUntil && new Date(item.unavailableUntil).getTime() > nowMs;
            return (
              <Pressable onPress={() => setMode({ kind: "edit", item })} style={styles.row}>
                <GearThumbnail photoUri={item.photoUri} kind="clothing" dimmed={isUnavailable} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, isUnavailable && styles.dimmedText]}>{item.name}</Text>
                  <Text style={styles.rowMeta}>
                    {item.type} · warmth {item.warmth}
                  </Text>
                  <GearRowBadges
                    item={item}
                    onTapUnavailable={() => setUnavailabilityTarget(item)}
                    onTapWashReminder={() => confirmMarkAsWashing(item)}
                  />
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {unavailabilityTarget && (
        <UnavailabilitySheet
          key={unavailabilityTarget.id}
          initialReason={unavailabilityTarget.unavailableReason}
          onClose={() => setUnavailabilityTarget(null)}
          onConfirm={({ unavailableUntil, unavailableReason }) => {
            const laundryReset = unavailableReason === "laundry" ? { wearsSinceClean: 0, needsCleaning: false } : {};
            updateClothing({ ...unavailabilityTarget, unavailableUntil, unavailableReason, ...laundryReset }).then(reload);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  empty: { color: "#666" },
  listContent: { padding: 16, gap: 8 },
  addButton: { paddingVertical: 12, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: "#DDE1EA", marginBottom: 8 },
  addButtonLabel: { fontWeight: "600" },
  row: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 12, backgroundColor: "#F6F7FA", marginBottom: 8 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  dimmedText: { opacity: 0.6 },
  rowMeta: { fontSize: 13, color: "#5C6478", marginTop: 2 },
});

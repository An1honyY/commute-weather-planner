import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { createUmbrella, deleteUmbrella, listUmbrellas, updateUmbrella } from "../../db/repositories/umbrellas";
import type { UmbrellaItem } from "../../types";
import UmbrellaForm from "./UmbrellaForm";
import GearThumbnail from "../../components/GearThumbnail";
import GearRowBadges from "../../components/GearRowBadges";
import UnavailabilitySheet from "../../components/UnavailabilitySheet";

type Mode = { kind: "list" } | { kind: "add" } | { kind: "edit"; item: UmbrellaItem };

export default function UmbrellaList() {
  const [items, setItems] = useState<UmbrellaItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [unavailabilityTarget, setUnavailabilityTarget] = useState<UmbrellaItem | null>(null);
  const [nowMs] = useState(() => Date.now());

  const reload = useCallback(() => {
    listUmbrellas().then((rows) => {
      setItems(rows);
      setLoaded(true);
    });
  }, []);

  useFocusEffect(reload);

  async function handleSubmit(item: UmbrellaItem) {
    if (mode.kind === "edit") {
      await updateUmbrella(item);
    } else {
      await createUmbrella(item);
    }
    setMode({ kind: "list" });
    reload();
  }

  async function handleDelete() {
    if (mode.kind !== "edit") return;
    await deleteUmbrella(mode.item.id);
    setMode({ kind: "list" });
    reload();
  }

  // UmbrellaItem has no unavailableReason field (Section 3) — only the
  // return date is persisted here, unlike clothing/shoes.
  function applyUnavailability(target: UmbrellaItem, unavailableUntil: string | undefined) {
    return updateUmbrella({ ...target, unavailableUntil });
  }

  if (mode.kind === "add") {
    return <UmbrellaForm onSubmit={handleSubmit} onCancel={() => setMode({ kind: "list" })} />;
  }

  if (mode.kind === "edit") {
    return (
      <>
        <UmbrellaForm
          initial={mode.item}
          onSubmit={handleSubmit}
          onCancel={() => setMode({ kind: "list" })}
          onDelete={handleDelete}
          onMarkUnavailable={() => setUnavailabilityTarget(mode.item)}
        />
        {unavailabilityTarget && (
          <UnavailabilitySheet
            key={unavailabilityTarget.id}
            onClose={() => setUnavailabilityTarget(null)}
            onConfirm={({ unavailableUntil }) => {
              applyUnavailability(unavailabilityTarget, unavailableUntil).then(() => {
                setMode({ kind: "edit", item: { ...unavailabilityTarget, unavailableUntil } });
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
          <Text style={styles.empty}>No umbrellas yet — add your first one</Text>
          <Pressable onPress={() => setMode({ kind: "add" })} style={styles.addButton}>
            <Text style={styles.addButtonLabel}>+ Add umbrella</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Pressable onPress={() => setMode({ kind: "add" })} style={styles.addButton}>
              <Text style={styles.addButtonLabel}>+ Add umbrella</Text>
            </Pressable>
          }
          renderItem={({ item }) => {
            const isUnavailable = !!item.unavailableUntil && new Date(item.unavailableUntil).getTime() > nowMs;
            return (
              <Pressable onPress={() => setMode({ kind: "edit", item })} style={styles.row}>
                <GearThumbnail photoUri={item.photoUri} kind="umbrella" dimmed={isUnavailable} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, isUnavailable && styles.dimmedText]}>{item.name}</Text>
                  <Text style={styles.rowMeta}>
                    {item.type} · {item.windRating} wind rating
                  </Text>
                  <GearRowBadges
                    item={item}
                    onTapUnavailable={() => setUnavailabilityTarget(item)}
                    onTapWashReminder={() => {}}
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
          onClose={() => setUnavailabilityTarget(null)}
          onConfirm={({ unavailableUntil }) => applyUnavailability(unavailabilityTarget, unavailableUntil).then(reload)}
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

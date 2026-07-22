import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { createVehicle, deleteVehicle, listVehicles, updateVehicle } from "../../db/repositories/vehicles";
import type { VehicleItem } from "../../types";
import VehicleForm from "./VehicleForm";
import GearThumbnail from "../../components/GearThumbnail";
import useTheme from "../../theme/useTheme";

type Mode = { kind: "list" } | { kind: "add" } | { kind: "edit"; item: VehicleItem };

export default function VehicleList() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [items, setItems] = useState<VehicleItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });

  const reload = useCallback(() => {
    listVehicles().then((rows) => {
      setItems(rows);
      setLoaded(true);
    });
  }, []);

  useFocusEffect(reload);

  async function handleSubmit(item: VehicleItem) {
    if (mode.kind === "edit") {
      await updateVehicle(item);
    } else {
      await createVehicle(item);
    }
    setMode({ kind: "list" });
    reload();
  }

  async function handleDelete() {
    if (mode.kind !== "edit") return;
    await deleteVehicle(mode.item.id);
    setMode({ kind: "list" });
    reload();
  }

  if (mode.kind === "add") {
    return <VehicleForm onSubmit={handleSubmit} onCancel={() => setMode({ kind: "list" })} />;
  }

  if (mode.kind === "edit") {
    return (
      <VehicleForm
        initial={mode.item}
        onSubmit={handleSubmit}
        onCancel={() => setMode({ kind: "list" })}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <View style={styles.container}>
      {loaded && items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.empty}>No vehicles yet — add your first one</Text>
          <Pressable onPress={() => setMode({ kind: "add" })} style={styles.addButton}>
            <Text style={styles.addButtonLabel}>+ Add vehicle</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Pressable onPress={() => setMode({ kind: "add" })} style={styles.addButton}>
              <Text style={styles.addButtonLabel}>+ Add vehicle</Text>
            </Pressable>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => setMode({ kind: "edit", item })} style={styles.row}>
              <GearThumbnail photoUri={item.photoUri} kind="vehicle" />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.type} · {item.weatherProtection} weather protection
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    empty: { color: theme.textSecondary },
    listContent: { padding: 20, gap: 8 },
    addButton: { paddingVertical: 12, paddingHorizontal: 20, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: theme.border, marginBottom: 8 },
    addButtonLabel: { fontWeight: "600", color: theme.textPrimary },
    row: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 12, backgroundColor: theme.surface, marginBottom: 8 },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    rowMeta: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  });
}

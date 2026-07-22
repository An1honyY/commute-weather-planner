import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { createShoe, deleteShoe, listShoes, updateShoe } from "../../db/repositories/shoes";
import type { ShoeItem } from "../../types";
import ShoeForm from "./ShoeForm";
import GearThumbnail from "../../components/GearThumbnail";
import GearRowBadges from "../../components/GearRowBadges";
import UnavailabilitySheet from "../../components/UnavailabilitySheet";
import useTheme from "../../theme/useTheme";

type Mode = { kind: "list" } | { kind: "add" } | { kind: "edit"; item: ShoeItem };

interface Props {
  // §9.6 — set when GearRecommendationCard's fallback text sent the user
  // here to add shoes; opens straight into the add form.
  autoOpenAdd?: boolean;
}

export default function ShoeList({ autoOpenAdd }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [items, setItems] = useState<ShoeItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>(autoOpenAdd ? { kind: "add" } : { kind: "list" });
  const [unavailabilityTarget, setUnavailabilityTarget] = useState<ShoeItem | null>(null);
  const [nowMs] = useState(() => Date.now());

  // "Adjusting state when a prop changes" (render-time, not an effect) —
  // see ClothingList.tsx for why autoOpenAdd only ever holds true briefly.
  const [consumedAutoOpenAdd, setConsumedAutoOpenAdd] = useState(autoOpenAdd);
  if (autoOpenAdd !== consumedAutoOpenAdd) {
    setConsumedAutoOpenAdd(autoOpenAdd);
    if (autoOpenAdd) setMode({ kind: "add" });
  }

  const reload = useCallback(() => {
    listShoes().then((rows) => {
      setItems(rows);
      setLoaded(true);
    });
  }, []);

  useFocusEffect(reload);

  async function handleSubmit(item: ShoeItem) {
    if (mode.kind === "edit") {
      await updateShoe(item);
    } else {
      await createShoe(item);
    }
    setMode({ kind: "list" });
    reload();
  }

  async function handleDelete() {
    if (mode.kind !== "edit") return;
    await deleteShoe(mode.item.id);
    setMode({ kind: "list" });
    reload();
  }

  async function markAsWashing(item: ShoeItem) {
    const until = new Date();
    until.setDate(until.getDate() + 2);
    await updateShoe({
      ...item,
      unavailableUntil: until.toISOString(),
      unavailableReason: "laundry",
      wearsSinceClean: 0,
      needsCleaning: false,
    });
    reload();
  }

  function confirmMarkAsWashing(item: ShoeItem) {
    Alert.alert(`Mark ${item.name} as being cleaned?`, "This'll mark it unavailable for about 2 days and reset its wear count.", [
      { text: "Not yet", style: "cancel" },
      { text: "Mark as washing", onPress: () => markAsWashing(item) },
    ]);
  }

  if (mode.kind === "add") {
    return <ShoeForm onSubmit={handleSubmit} onCancel={() => setMode({ kind: "list" })} />;
  }

  if (mode.kind === "edit") {
    return (
      <>
        <ShoeForm
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
              updateShoe(updated).then(() => {
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
          <Text style={styles.empty}>No shoes yet — add your first pair</Text>
          <Pressable onPress={() => setMode({ kind: "add" })} style={styles.addButton}>
            <Text style={styles.addButtonLabel}>+ Add shoes</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Pressable onPress={() => setMode({ kind: "add" })} style={styles.addButton}>
              <Text style={styles.addButtonLabel}>+ Add shoes</Text>
            </Pressable>
          }
          renderItem={({ item }) => {
            const isUnavailable = !!item.unavailableUntil && new Date(item.unavailableUntil).getTime() > nowMs;
            return (
              <Pressable onPress={() => setMode({ kind: "edit", item })} style={styles.row}>
                <GearThumbnail photoUri={item.photoUri} kind="shoe" dimmed={isUnavailable} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, isUnavailable && styles.dimmedText]}>{item.name}</Text>
                  <Text style={styles.rowMeta}>
                    {item.type} · {item.grip} grip
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
            updateShoe({ ...unavailabilityTarget, unavailableUntil, unavailableReason, ...laundryReset }).then(reload);
          }}
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
    dimmedText: { opacity: 0.6 },
    rowMeta: { fontSize: 13, color: theme.textSecondary, marginTop: 2 },
  });
}

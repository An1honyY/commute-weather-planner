import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { createClothing, deleteClothing, listClothing, updateClothing } from "../../db/repositories/clothing";
import { showAlert } from "../../lib/crossPlatformAlert";
import type { ClothingItem, ClothingType } from "../../types";
import ClothingForm from "./ClothingForm";
import GearThumbnail from "../../components/GearThumbnail";
import GearRowBadges from "../../components/GearRowBadges";
import UnavailabilitySheet from "../../components/UnavailabilitySheet";
import useTheme from "../../theme/useTheme";

type Mode = { kind: "list" } | { kind: "add"; presetType?: ClothingType } | { kind: "edit"; item: ClothingItem };

interface Props {
  // §9.6 — set when GearRecommendationCard's fallback text sent the user
  // here to add a specific missing item type; opens straight into the add
  // form pre-set to that type instead of the list.
  autoOpenAddType?: ClothingType;
}

export default function ClothingList({ autoOpenAddType }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>(autoOpenAddType ? { kind: "add", presetType: autoOpenAddType } : { kind: "list" });
  const [unavailabilityTarget, setUnavailabilityTarget] = useState<ClothingItem | null>(null);
  // Date.now() is impure to call during render — a useState lazy
  // initializer (react-hooks/purity) only runs once at mount.
  const [nowMs] = useState(() => Date.now());

  // "Adjusting state when a prop changes" (render-time, not an effect) —
  // GearScreen clears route.params.openAdd itself right after navigating
  // here, so autoOpenAddType only ever holds a real value for one render;
  // tracking the previous value is what lets that one render open the form.
  const [consumedAutoOpenAddType, setConsumedAutoOpenAddType] = useState(autoOpenAddType);
  if (autoOpenAddType !== consumedAutoOpenAddType) {
    setConsumedAutoOpenAddType(autoOpenAddType);
    if (autoOpenAddType) setMode({ kind: "add", presetType: autoOpenAddType });
  }

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
    showAlert(`Mark ${item.name} as in the laundry?`, "This'll mark it unavailable for about 2 days and reset its wear count.", [
      { text: "Not yet", style: "cancel" },
      { text: "Mark as washing", onPress: () => markAsWashing(item) },
    ]);
  }

  if (mode.kind === "add") {
    return <ClothingForm initialType={mode.presetType} onSubmit={handleSubmit} onCancel={() => setMode({ kind: "list" })} />;
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
                <GearThumbnail photoUri={item.photoUri} kind={item.type} dimmed={isUnavailable} />
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

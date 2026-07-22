import { useCallback, useState } from "react";
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  deleteAnnotation,
  listAnnotations,
  updateAnnotation,
} from "../../db/repositories/annotations";
import type { EnvironmentAnnotation } from "../../types";
import AnnotationForm, { type AnnotationFormValues } from "./AnnotationForm";
import { EFFECT_META } from "./effectMeta";
import useTheme from "../../theme/useTheme";

// EnvironmentAnnotation manage/list screen — docs/04-screens-navigation.md
// §4.5. Review/prune what's accumulated over time; *adding* happens in
// context via the Journey Detail map long-press, not here. Delete is a
// per-row action (and available inside edit) rather than swipe-to-delete —
// same no-gesture-dependency call as the rest of this screen's form
// simplifications, see DECISIONS.md.
type Mode = { kind: "list" } | { kind: "edit"; annotation: EnvironmentAnnotation };

export default function LocalKnowledgeScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [annotations, setAnnotations] = useState<EnvironmentAnnotation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "list" });

  const reload = useCallback(() => {
    listAnnotations().then((rows) => {
      setAnnotations(rows);
      setLoaded(true);
    });
  }, []);

  useFocusEffect(reload);

  async function handleSave(values: AnnotationFormValues) {
    if (mode.kind !== "edit") return;
    await updateAnnotation({ ...mode.annotation, ...values });
    setMode({ kind: "list" });
    reload();
  }

  async function handleDelete(id: string) {
    await deleteAnnotation(id);
    setMode({ kind: "list" });
    reload();
  }

  if (mode.kind === "edit") {
    return (
      <SafeAreaView style={styles.container}>
        <AnnotationForm
          initial={mode.annotation}
          showCoordinateFields
          onSave={handleSave}
          onCancel={() => setMode({ kind: "list" })}
          onDelete={() => handleDelete(mode.annotation.id)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {loaded && annotations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.title}>Local knowledge</Text>
          <Text style={styles.empty}>
            No local knowledge yet — long-press anywhere on a journey&apos;s map to mark a windy corner,
            a covered walkway, or a sunny stretch.
          </Text>
        </View>
      ) : (
        <FlatList
          data={annotations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable onPress={() => setMode({ kind: "edit", annotation: item })} style={styles.row}>
              <View style={styles.iconCircle}>
                <Text style={styles.icon}>{EFFECT_META[item.effect].icon}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowMeta}>
                  {EFFECT_META[item.effect].label} · within {item.radiusM}m
                </Text>
                {item.notes ? <Text style={styles.rowNotes}>{item.notes}</Text> : null}
              </View>
              <Pressable
                onPress={() => handleDelete(item.id)}
                hitSlop={8}
                style={styles.deleteButton}
                accessibilityLabel={`Delete ${item.label}`}
              >
                <Text style={styles.deleteGlyph}>✕</Text>
              </Pressable>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    emptyContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 32 },
    title: { fontSize: 20, fontWeight: "600", color: theme.textPrimary },
    empty: { color: theme.textSecondary, textAlign: "center" },
    listContent: { padding: 20 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.surface,
      marginBottom: 8,
    },
    // §9.1 annotationPin token — one consistent color across all six effect
    // types, distinguished from each other by the icon glyph (§4.5), not hue.
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.annotationPin,
    },
    icon: { fontSize: 18 },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    rowMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    rowNotes: { fontSize: 12, color: theme.textSecondary, marginTop: 2, fontStyle: "italic" },
    deleteButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
    deleteGlyph: { fontSize: 16, color: theme.danger },
  });
}

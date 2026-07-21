import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { EnvironmentAnnotation, EnvironmentEffectType } from "../../types";
import { EFFECT_META, EFFECT_OPTIONS } from "./effectMeta";
import useTheme from "../../theme/useTheme";

// Shared add/edit form for an EnvironmentAnnotation — docs/04-screens-
// navigation.md §4.5. Used both as the Journey Detail map long-press sheet
// (coordinates pre-filled from the tap, coordinate fields hidden) and the
// Local knowledge list's edit view (coordinates shown as editable lat/lng
// number fields — the same no-map-dependency precedent as Locations CRUD,
// see DECISIONS.md). Radius is a stepped 50–300m chip row (default 100m)
// rather than a drag slider, matching WarmthSlider's no-new-dependency
// stepped-control precedent.
const RADIUS_OPTIONS = [50, 100, 150, 200, 250, 300];

export interface AnnotationFormValues {
  label: string;
  effect: EnvironmentEffectType;
  lat: number;
  lng: number;
  radiusM: number;
  notes?: string;
}

interface Props {
  // Add-from-map: pass the tapped coordinates and leave `initial` unset.
  // Edit: pass the full existing annotation.
  initial?: EnvironmentAnnotation;
  initialCoordinate?: { lat: number; lng: number };
  showCoordinateFields?: boolean;
  onSave: (values: AnnotationFormValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
  // Live radius-circle preview on the map underneath the sheet (§4.5).
  onPreviewChange?: (preview: { lat: number; lng: number; radiusM: number }) => void;
}

export default function AnnotationForm({
  initial,
  initialCoordinate,
  showCoordinateFields = false,
  onSave,
  onCancel,
  onDelete,
  onPreviewChange,
}: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [effect, setEffect] = useState<EnvironmentEffectType>(initial?.effect ?? "wind-tunnel");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [radiusM, setRadiusM] = useState(initial?.radiusM ?? 100);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lat, setLat] = useState(String(initial?.lat ?? initialCoordinate?.lat ?? ""));
  const [lng, setLng] = useState(String(initial?.lng ?? initialCoordinate?.lng ?? ""));

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const canSave = label.trim().length > 0 && lat !== "" && lng !== "" && !Number.isNaN(latNum) && !Number.isNaN(lngNum);

  function pickRadius(value: number) {
    setRadiusM(value);
    if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
      onPreviewChange?.({ lat: latNum, lng: lngNum, radiusM: value });
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.fieldLabel}>What&apos;s special about this spot?</Text>
      <View style={styles.effectGrid}>
        {EFFECT_OPTIONS.map((option) => {
          const active = option === effect;
          return (
            <Pressable
              key={option}
              onPress={() => setEffect(option)}
              style={[styles.effectButton, active && styles.effectButtonActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={styles.effectIcon}>{EFFECT_META[option].icon}</Text>
              <Text style={[styles.effectLabel, active && styles.effectLabelActive]}>{EFFECT_META[option].label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>Label</Text>
      <TextInput
        style={styles.input}
        value={label}
        onChangeText={setLabel}
        placeholder={EFFECT_META[effect].placeholder}
      />

      <Text style={styles.fieldLabel}>Applies within {radiusM}m</Text>
      <View style={styles.radiusRow}>
        {RADIUS_OPTIONS.map((option) => (
          <Pressable
            key={option}
            onPress={() => pickRadius(option)}
            style={[styles.radiusChip, option === radiusM && styles.radiusChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: option === radiusM }}
          >
            <Text style={[styles.radiusLabel, option === radiusM && styles.radiusLabelActive]}>{option}m</Text>
          </Pressable>
        ))}
      </View>

      {showCoordinateFields && (
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={styles.fieldLabel}>Latitude</Text>
            <TextInput
              style={styles.input}
              value={lat}
              onChangeText={setLat}
              keyboardType="numbers-and-punctuation"
              placeholder="-36.8485"
            />
          </View>
          <View style={styles.half}>
            <Text style={styles.fieldLabel}>Longitude</Text>
            <TextInput
              style={styles.input}
              value={lng}
              onChangeText={setLng}
              keyboardType="numbers-and-punctuation"
              placeholder="174.7633"
            />
          </View>
        </View>
      )}

      <Text style={styles.fieldLabel}>Notes (optional)</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Shown when this spot affects a journey"
        multiline
      />

      <View style={styles.actions}>
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text>Cancel</Text>
        </Pressable>
        <Pressable
          disabled={!canSave}
          onPress={() =>
            onSave({
              label: label.trim(),
              effect,
              lat: latNum,
              lng: lngNum,
              radiusM,
              notes: notes.trim() || undefined,
            })
          }
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
        >
          <Text style={styles.saveLabel}>Save</Text>
        </Pressable>
      </View>

      {onDelete && (
        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <Text style={styles.deleteLabel}>Delete annotation</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: 16, gap: 4 },
    fieldLabel: { fontSize: 13, color: theme.textSecondary, marginTop: 12, marginBottom: 4 },
    effectGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    effectButton: {
      width: "31%",
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      gap: 4,
    },
    effectButtonActive: { backgroundColor: theme.textPrimary, borderColor: theme.textPrimary },
    effectIcon: { fontSize: 20 },
    effectLabel: { fontSize: 11, textAlign: "center", color: theme.textPrimary },
    effectLabelActive: { color: theme.bg, fontWeight: "600" },
    input: { borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.textPrimary },
    notesInput: { minHeight: 64, textAlignVertical: "top" },
    radiusRow: { flexDirection: "row", gap: 8 },
    radiusChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
    },
    radiusChipActive: { backgroundColor: theme.textPrimary, borderColor: theme.textPrimary },
    radiusLabel: { fontSize: 12, color: theme.textPrimary },
    radiusLabelActive: { color: theme.bg, fontWeight: "600" },
    row: { flexDirection: "row", gap: 12 },
    half: { flex: 1 },
    actions: { flexDirection: "row", gap: 12, marginTop: 24 },
    cancelButton: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: theme.border },
    saveButton: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8, backgroundColor: theme.textPrimary },
    saveButtonDisabled: { opacity: 0.4 },
    saveLabel: { color: theme.bg, fontWeight: "600" },
    deleteButton: { marginTop: 16, alignItems: "center", paddingVertical: 10 },
    deleteLabel: { color: theme.danger },
  });
}

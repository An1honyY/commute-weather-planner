import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { SavedLocation } from "../../types";
import useTheme from "../../theme/useTheme";

// Add/edit form for a SavedLocation — docs/04-screens-navigation.md item 3.
// Map pin-drop / Google Places address search are deferred: react-native-
// maps has no web target (would break the web dev-mode smoke-check this
// project already relies on) and Google Places billing/wiring belongs with
// the rest of Section 2's live APIs in Phase 4 — logged in DECISIONS.md.
// This form covers the same data with plain text/number fields instead.
type ClimateOverride = "yes" | "no" | "default";

function toClimateOverride(value: boolean | undefined): ClimateOverride {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "default";
}

function fromClimateOverride(value: ClimateOverride): boolean | undefined {
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined;
}

export interface LocationFormValues {
  label: string;
  address: string;
  lat: number;
  lng: number;
  isFavorite: boolean;
  hasReliableClimateControl: boolean | undefined;
}

interface Props {
  initial?: SavedLocation;
  onSubmit: (values: LocationFormValues) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export default function LocationForm({ initial, onSubmit, onCancel, onDelete }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [label, setLabel] = useState(initial?.label ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [lat, setLat] = useState(initial ? String(initial.lat) : "");
  const [lng, setLng] = useState(initial ? String(initial.lng) : "");
  const [isFavorite, setIsFavorite] = useState(initial?.isFavorite ?? false);
  const [climate, setClimate] = useState<ClimateOverride>(toClimateOverride(initial?.hasReliableClimateControl));

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const canSubmit = label.trim().length > 0 && address.trim().length > 0 && !Number.isNaN(latNum) && !Number.isNaN(lngNum);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Label</Text>
      <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Home" />

      <Text style={styles.label}>Address</Text>
      <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="123 Queen St, Auckland" />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Latitude</Text>
          <TextInput style={styles.input} value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" placeholder="-36.8485" />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Longitude</Text>
          <TextInput style={styles.input} value={lng} onChangeText={setLng} keyboardType="numbers-and-punctuation" placeholder="174.7633" />
        </View>
      </View>

      <Pressable onPress={() => setIsFavorite((v) => !v)} style={styles.favoriteRow}>
        <Text style={styles.favoriteStar}>{isFavorite ? "★" : "☆"}</Text>
        <Text style={styles.label}>Favorite</Text>
      </Pressable>

      <Text style={styles.label}>Reliable AC/heating here?</Text>
      <View style={styles.segmentRow}>
        {(["yes", "no", "default"] as ClimateOverride[]).map((option) => (
          <Pressable
            key={option}
            onPress={() => setClimate(option)}
            style={[styles.segment, climate === option && styles.segmentActive]}
          >
            <Text style={[styles.segmentLabel, climate === option && styles.segmentLabelActive]}>
              {option === "yes" ? "Yes" : option === "no" ? "No" : "Don't override"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text>Cancel</Text>
        </Pressable>
        <Pressable
          disabled={!canSubmit}
          onPress={() =>
            onSubmit({
              label: label.trim(),
              address: address.trim(),
              lat: latNum,
              lng: lngNum,
              isFavorite,
              hasReliableClimateControl: fromClimateOverride(climate),
            })
          }
          style={[styles.saveButton, !canSubmit && styles.saveButtonDisabled]}
        >
          <Text style={styles.saveLabel}>Save</Text>
        </Pressable>
      </View>

      {onDelete && (
        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <Text style={styles.deleteLabel}>Delete location</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: 16, gap: 4 },
    label: { fontSize: 13, color: theme.textSecondary, marginTop: 12, marginBottom: 4 },
    input: { borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.textPrimary },
    row: { flexDirection: "row", gap: 12 },
    half: { flex: 1 },
    favoriteRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, minHeight: 44 },
    favoriteStar: { fontSize: 22, color: theme.favoriteStar },
    segmentRow: { flexDirection: "row", gap: 8 },
    segment: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: "center" },
    segmentActive: { backgroundColor: theme.textPrimary, borderColor: theme.textPrimary },
    segmentLabel: { fontSize: 13, color: theme.textPrimary },
    segmentLabelActive: { color: theme.bg, fontWeight: "600" },
    actions: { flexDirection: "row", gap: 12, marginTop: 24 },
    cancelButton: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: theme.border },
    saveButton: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8, backgroundColor: theme.textPrimary },
    saveButtonDisabled: { opacity: 0.4 },
    saveLabel: { color: theme.bg, fontWeight: "600" },
    deleteButton: { marginTop: 16, alignItems: "center", paddingVertical: 10 },
    deleteLabel: { color: theme.danger },
  });
}

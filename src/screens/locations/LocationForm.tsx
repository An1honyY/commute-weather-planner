import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { SavedLocation } from "../../types";
import useTheme from "../../theme/useTheme";
import AddressAutocomplete from "../../components/AddressAutocomplete";

// Add/edit form for a SavedLocation — docs/04-screens-navigation.md item 3.
// Address search now uses real Google Places autocomplete (AddressAutocomplete,
// docs/02-external-apis.md §2) — lat/lng resolve automatically from the
// selected suggestion and are no longer a primary-UX field; a collapsed
// "Advanced" section still exposes them as manual overrides for power users
// or when Places is unconfigured/offline (2026-07-21 onboarding rework,
// see DECISIONS.md; supersedes the earlier "text/number fields, Places
// deferred to Phase 4" decision). Map pin-drop is still deferred —
// react-native-maps has no web target, the same reasoning as before.
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
  // Collapsed by default, same pattern as Settings' "Advanced" threshold
  // override — auto-expanded when editing an existing location, since its
  // lat/lng are already meaningful values rather than blank fields waiting
  // on a Places selection.
  const [advancedExpanded, setAdvancedExpanded] = useState(!!initial);

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const canSubmit = label.trim().length > 0 && address.trim().length > 0 && !Number.isNaN(latNum) && !Number.isNaN(lngNum);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Label</Text>
      <TextInput style={styles.input} value={label} onChangeText={setLabel} placeholder="Home" />

      <Text style={styles.label}>Address</Text>
      <AddressAutocomplete
        value={address}
        onChangeText={setAddress}
        onSelectPlace={(result) => {
          setAddress(result.address);
          setLat(String(result.lat));
          setLng(String(result.lng));
        }}
        placeholder="123 Queen St, Auckland"
      />

      <Pressable onPress={() => setAdvancedExpanded((v) => !v)} style={styles.advancedHeader}>
        <Text style={styles.label}>{advancedExpanded ? "▾" : "▸"} Advanced — set exact coordinates</Text>
      </Pressable>
      {advancedExpanded && (
        <>
          <Text style={styles.hint}>
            Filled in automatically when you pick an address above — only change these if the search didn&apos;t
            find the right spot.
          </Text>
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
        </>
      )}

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
    advancedHeader: { marginTop: 16 },
    hint: { fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
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

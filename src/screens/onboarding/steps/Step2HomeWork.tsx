import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { createLocation } from "../../../db/repositories/locations";
import { withTimeout } from "../../../lib/withTimeout";
import useTheme from "../../../theme/useTheme";

// docs/04-screens-navigation.md §4.1 step 2 — "a minimal 2-field version
// of the Locations add-flow, pre-labeled." Lat/lng stay manual per the
// same map/geocoding-deferred decision as the full Locations form
// (DECISIONS.md, "Locations CRUD uses text/number fields"); a granted
// current-location fix (Step 1) can prefill Home's coordinates in one tap.
interface Props {
  currentCoords: { lat: number; lng: number } | undefined;
  onNext: () => void;
}

interface Fields {
  address: string;
  lat: string;
  lng: string;
}

function MiniLocationRow({
  label,
  fields,
  onChange,
  onUseCurrentLocation,
}: {
  label: string;
  fields: Fields;
  onChange: (fields: Fields) => void;
  onUseCurrentLocation?: () => void;
}) {
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={fields.address}
        onChangeText={(address) => onChange({ ...fields, address })}
        placeholder="Address"
      />
      <View style={styles.coordRow}>
        <TextInput
          style={[styles.input, styles.coordInput]}
          value={fields.lat}
          onChangeText={(lat) => onChange({ ...fields, lat })}
          placeholder="Latitude"
          keyboardType="numbers-and-punctuation"
        />
        <TextInput
          style={[styles.input, styles.coordInput]}
          value={fields.lng}
          onChangeText={(lng) => onChange({ ...fields, lng })}
          placeholder="Longitude"
          keyboardType="numbers-and-punctuation"
        />
      </View>
      {onUseCurrentLocation && (
        <Pressable onPress={onUseCurrentLocation}>
          <Text style={styles.useCurrentLabel}>Use my current location</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function Step2HomeWork({ currentCoords, onNext }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [home, setHome] = useState<Fields>({ address: "", lat: "", lng: "" });
  const [work, setWork] = useState<Fields>({ address: "", lat: "", lng: "" });

  async function saveAndContinue() {
    const jobs: Promise<unknown>[] = [];
    if (home.address.trim() && !Number.isNaN(Number(home.lat)) && !Number.isNaN(Number(home.lng))) {
      jobs.push(
        createLocation({
          label: "Home",
          address: home.address.trim(),
          lat: Number(home.lat),
          lng: Number(home.lng),
          isFavorite: true,
        })
      );
    }
    if (work.address.trim() && !Number.isNaN(Number(work.lat)) && !Number.isNaN(Number(work.lng))) {
      jobs.push(
        createLocation({
          label: "Work",
          address: work.address.trim(),
          lat: Number(work.lat),
          lng: Number(work.lng),
          isFavorite: true,
        })
      );
    }
    // A DB write that never settles shouldn't be able to strand the user on
    // this screen — see withTimeout.ts.
    await withTimeout(Promise.all(jobs), []);
    onNext();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Add Home and Work</Text>
      <Text style={styles.body}>Almost every journey starts from one of these — you can add more later.</Text>

      <MiniLocationRow
        label="Home"
        fields={home}
        onChange={setHome}
        onUseCurrentLocation={
          currentCoords
            ? () => setHome((f) => ({ ...f, lat: String(currentCoords.lat), lng: String(currentCoords.lng) }))
            : undefined
        }
      />
      <MiniLocationRow label="Work" fields={work} onChange={setWork} />

      <Pressable onPress={saveAndContinue} style={styles.primaryButton}>
        <Text style={styles.primaryLabel}>Continue</Text>
      </Pressable>
      <Pressable onPress={onNext} style={styles.skipButton}>
        <Text style={styles.skipLabel}>Skip</Text>
      </Pressable>
    </ScrollView>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: 24, gap: 4, backgroundColor: theme.bg },
    title: { fontSize: 22, fontWeight: "700", color: theme.textPrimary },
    body: { fontSize: 15, color: theme.textSecondary, marginTop: 4, marginBottom: 16 },
    row: { marginBottom: 20, gap: 8 },
    rowLabel: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    input: { borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.textPrimary },
    coordRow: { flexDirection: "row", gap: 8 },
    coordInput: { flex: 1 },
    useCurrentLabel: { color: theme.accentWalk, fontSize: 13 },
    primaryButton: { marginTop: 12, paddingVertical: 14, alignItems: "center", borderRadius: 8, backgroundColor: theme.textPrimary },
    primaryLabel: { color: theme.bg, fontWeight: "600", fontSize: 15 },
    skipButton: { marginTop: 12, alignItems: "center", paddingVertical: 10 },
    skipLabel: { color: theme.textSecondary },
  });
}

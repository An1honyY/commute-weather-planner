import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import SingleSelect from "../../components/SingleSelect";
import PhotoPicker from "../../components/PhotoPicker";
import { newId } from "../../db/rowMapping";
import type { VehicleItem, VehicleType } from "../../types";

const TYPE_OPTIONS: VehicleType[] = ["car", "bike", "motorcycle", "scooter", "none"];
const PROTECTION_OPTIONS: VehicleItem["weatherProtection"][] = ["full", "partial", "none"];

interface Props {
  initial?: VehicleItem;
  onSubmit: (item: VehicleItem) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export default function VehicleForm({ initial, onSubmit, onCancel, onDelete }: Props) {
  const [id] = useState(() => initial?.id ?? newId());
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<VehicleType>(initial?.type ?? "car");
  const [weatherProtection, setWeatherProtection] = useState<VehicleItem["weatherProtection"]>(
    initial?.weatherProtection ?? "full"
  );
  const [photoUri, setPhotoUri] = useState<string | undefined>(initial?.photoUri);

  const canSubmit = name.trim().length > 0;

  function handleSubmit() {
    onSubmit({ ...initial, id, name: name.trim(), type, weatherProtection, photoUri });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <PhotoPicker itemId={id} photoUri={photoUri} onChange={setPhotoUri} />

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Honda Civic" />

      <Text style={styles.label}>Type</Text>
      <SingleSelect options={TYPE_OPTIONS} value={type} onChange={setType} />

      <Text style={styles.label}>Weather protection</Text>
      <SingleSelect options={PROTECTION_OPTIONS} value={weatherProtection} onChange={setWeatherProtection} />

      <Pressable
        disabled={!canSubmit}
        onPress={handleSubmit}
        style={[styles.saveButton, !canSubmit && styles.saveButtonDisabled]}
      >
        <Text style={styles.saveLabel}>Save</Text>
      </Pressable>
      <Pressable onPress={onCancel} style={styles.cancelButton}>
        <Text>Cancel</Text>
      </Pressable>

      {onDelete && (
        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <Text style={styles.deleteLabel}>Delete vehicle</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 4, alignItems: "stretch" },
  label: { fontSize: 13, color: "#5C6478", marginTop: 16, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#DDE1EA", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  saveButton: { marginTop: 24, paddingVertical: 12, alignItems: "center", borderRadius: 8, backgroundColor: "#1A1E29" },
  saveButtonDisabled: { opacity: 0.4 },
  saveLabel: { color: "#FFFFFF", fontWeight: "600" },
  cancelButton: { marginTop: 12, paddingVertical: 12, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: "#DDE1EA" },
  deleteButton: { marginTop: 16, alignItems: "center", paddingVertical: 10 },
  deleteLabel: { color: "#B24FE3" },
});

import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import SingleSelect from "../../components/SingleSelect";
import PhotoPicker from "../../components/PhotoPicker";
import { newId } from "../../db/rowMapping";
import type { UmbrellaItem, UmbrellaType } from "../../types";

const TYPE_OPTIONS: UmbrellaType[] = ["compact", "full-size", "golf"];
const WIND_RATING_OPTIONS: UmbrellaItem["windRating"][] = ["low", "med", "high"];

interface Props {
  initial?: UmbrellaItem;
  onSubmit: (item: UmbrellaItem) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onMarkUnavailable?: () => void;
}

export default function UmbrellaForm({ initial, onSubmit, onCancel, onDelete, onMarkUnavailable }: Props) {
  const [id] = useState(() => initial?.id ?? newId());
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<UmbrellaType>(initial?.type ?? "compact");
  const [windRating, setWindRating] = useState<UmbrellaItem["windRating"]>(initial?.windRating ?? "med");
  const [photoUri, setPhotoUri] = useState<string | undefined>(initial?.photoUri);

  const canSubmit = name.trim().length > 0;

  function handleSubmit() {
    onSubmit({ ...initial, id, name: name.trim(), type, windRating, photoUri });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <PhotoPicker itemId={id} photoUri={photoUri} onChange={setPhotoUri} />

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Black golf umbrella" />

      <Text style={styles.label}>Type</Text>
      <SingleSelect options={TYPE_OPTIONS} value={type} onChange={setType} />

      <Text style={styles.label}>Wind rating</Text>
      <SingleSelect options={WIND_RATING_OPTIONS} value={windRating} onChange={setWindRating} />

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

      {onMarkUnavailable && (
        <Pressable onPress={onMarkUnavailable} style={styles.secondaryButton}>
          <Text style={styles.secondaryLabel}>Mark unavailable until…</Text>
        </Pressable>
      )}
      {onDelete && (
        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <Text style={styles.deleteLabel}>Delete item</Text>
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
  secondaryButton: { marginTop: 16, alignItems: "center", paddingVertical: 10 },
  secondaryLabel: { color: "#1A1E29", fontWeight: "600" },
  deleteButton: { marginTop: 8, alignItems: "center", paddingVertical: 10 },
  deleteLabel: { color: "#B24FE3" },
});

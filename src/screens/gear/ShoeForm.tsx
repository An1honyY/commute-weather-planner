import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import SingleSelect from "../../components/SingleSelect";
import PhotoPicker from "../../components/PhotoPicker";
import { newId } from "../../db/rowMapping";
import type { ShoeItem, ShoeType } from "../../types";

const TYPE_OPTIONS: ShoeType[] = ["sneaker", "boot", "sandal", "formal", "waterproof-boot"];
const GRIP_OPTIONS: ShoeItem["grip"][] = ["low", "med", "high"];

interface Props {
  initial?: ShoeItem;
  onSubmit: (item: ShoeItem) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onMarkUnavailable?: () => void;
}

export default function ShoeForm({ initial, onSubmit, onCancel, onDelete, onMarkUnavailable }: Props) {
  const [id] = useState(() => initial?.id ?? newId());
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<ShoeType>(initial?.type ?? "sneaker");
  const [waterproof, setWaterproof] = useState(initial?.waterproof ?? false);
  const [grip, setGrip] = useState<ShoeItem["grip"]>(initial?.grip ?? "med");
  const [photoUri, setPhotoUri] = useState<string | undefined>(initial?.photoUri);

  const canSubmit = name.trim().length > 0;

  function handleSubmit() {
    onSubmit({ ...initial, id, name: name.trim(), type, waterproof, grip, photoUri });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <PhotoPicker itemId={id} photoUri={photoUri} onChange={setPhotoUri} />

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Waterproof boots" />

      <Text style={styles.label}>Type</Text>
      <SingleSelect options={TYPE_OPTIONS} value={type} onChange={setType} />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Waterproof</Text>
        <Switch value={waterproof} onValueChange={setWaterproof} />
      </View>

      <Text style={styles.label}>Grip</Text>
      <SingleSelect options={GRIP_OPTIONS} value={grip} onChange={setGrip} />

      <View style={styles.actions}>
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text>Cancel</Text>
        </Pressable>
        <Pressable disabled={!canSubmit} onPress={handleSubmit} style={[styles.saveButton, !canSubmit && styles.saveButtonDisabled]}>
          <Text style={styles.saveLabel}>Save</Text>
        </Pressable>
      </View>

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
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, minHeight: 44 },
  switchLabel: { fontSize: 15 },
  actions: { flexDirection: "row", gap: 12, marginTop: 24 },
  cancelButton: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: "#DDE1EA" },
  saveButton: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8, backgroundColor: "#1A1E29" },
  saveButtonDisabled: { opacity: 0.4 },
  saveLabel: { color: "#FFFFFF", fontWeight: "600" },
  secondaryButton: { marginTop: 16, alignItems: "center", paddingVertical: 10 },
  secondaryLabel: { color: "#1A1E29", fontWeight: "600" },
  deleteButton: { marginTop: 8, alignItems: "center", paddingVertical: 10 },
  deleteLabel: { color: "#B24FE3" },
});

import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import SingleSelect from "../../components/SingleSelect";
import PhotoPicker from "../../components/PhotoPicker";
import FormRow from "../../components/FormRow";
import FormSection from "../../components/FormSection";
import { newId } from "../../db/rowMapping";
import useTheme from "../../theme/useTheme";
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
  const theme = useTheme();
  const styles = getStyles(theme);
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
      <FormSection title="Basics">
        <PhotoPicker itemId={id} photoUri={photoUri} onChange={setPhotoUri} />
        <View>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
            placeholder="Waterproof boots"
          />
        </View>
      </FormSection>

      <FormSection title="Details">
        <View>
          <Text style={styles.label}>Type</Text>
          <SingleSelect options={TYPE_OPTIONS} value={type} onChange={setType} />
        </View>
        <FormRow label="Waterproof">
          <Switch value={waterproof} onValueChange={setWaterproof} />
        </FormRow>
        <View>
          <Text style={styles.label}>Grip</Text>
          <SingleSelect options={GRIP_OPTIONS} value={grip} onChange={setGrip} />
        </View>
      </FormSection>

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

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: 20, alignItems: "stretch" },
    label: { fontSize: 13, color: theme.textSecondary, marginBottom: 4 },
    input: { borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.textPrimary },
    actions: { flexDirection: "row", gap: 12, marginTop: 24 },
    cancelButton: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: theme.border },
    saveButton: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8, backgroundColor: theme.accentWalk },
    saveButtonDisabled: { opacity: 0.4 },
    saveLabel: { color: theme.bg, fontWeight: "600" },
    secondaryButton: { marginTop: 16, alignItems: "center", paddingVertical: 10 },
    secondaryLabel: { color: theme.textPrimary, fontWeight: "600" },
    deleteButton: { marginTop: 8, alignItems: "center", paddingVertical: 10 },
    deleteLabel: { color: theme.danger },
  });
}

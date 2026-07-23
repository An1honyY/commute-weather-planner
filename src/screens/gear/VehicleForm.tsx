import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import SingleSelect from "../../components/SingleSelect";
import PhotoPicker from "../../components/PhotoPicker";
import FormSection from "../../components/FormSection";
import { newId } from "../../db/rowMapping";
import useTheme from "../../theme/useTheme";
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
  const theme = useTheme();
  const styles = getStyles(theme);
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
      <FormSection title="Basics">
        <PhotoPicker itemId={id} photoUri={photoUri} onChange={setPhotoUri} />
        <View>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
            placeholder="Honda Civic"
          />
        </View>
      </FormSection>

      <FormSection title="Details">
        <View>
          <Text style={styles.label}>Type</Text>
          <SingleSelect options={TYPE_OPTIONS} value={type} onChange={setType} />
        </View>
        <View>
          <Text style={styles.label}>Weather protection</Text>
          <SingleSelect options={PROTECTION_OPTIONS} value={weatherProtection} onChange={setWeatherProtection} />
        </View>
      </FormSection>

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

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: 20, alignItems: "stretch" },
    label: { fontSize: 13, color: theme.textSecondary, marginBottom: 4 },
    input: { borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.textPrimary },
    saveButton: { marginTop: 24, paddingVertical: 12, alignItems: "center", borderRadius: 8, backgroundColor: theme.accentWalk },
    saveButtonDisabled: { opacity: 0.4 },
    saveLabel: { color: theme.bg, fontWeight: "600" },
    cancelButton: { marginTop: 12, paddingVertical: 12, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: theme.border },
    deleteButton: { marginTop: 16, alignItems: "center", paddingVertical: 10 },
    deleteLabel: { color: theme.danger },
  });
}

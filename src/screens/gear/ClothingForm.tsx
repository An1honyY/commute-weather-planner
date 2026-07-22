import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import WarmthSlider from "../../components/WarmthSlider";
import TagChips, { ACCESSORY_TAG_OPTIONS, BOTTOMS_TAG_OPTIONS, LAYER_TAG_OPTIONS } from "../../components/TagChips";
import SingleSelect from "../../components/SingleSelect";
import PhotoPicker from "../../components/PhotoPicker";
import { newId } from "../../db/rowMapping";
import useTheme from "../../theme/useTheme";
import type { ClothingItem, ClothingType } from "../../types";

const TYPE_OPTIONS: ClothingType[] = ["jacket", "midlayer", "base", "bottoms", "accessory"];

function tagOptionsFor(type: ClothingType): readonly string[] {
  if (type === "accessory") return ACCESSORY_TAG_OPTIONS;
  if (type === "bottoms") return BOTTOMS_TAG_OPTIONS;
  if (type === "jacket" || type === "midlayer") return LAYER_TAG_OPTIONS;
  return [];
}

interface Props {
  initial?: ClothingItem;
  // §9.6 — when GearRecommendationCard's fallback text sent the user here
  // for a specific missing slot, pre-set the type instead of always
  // defaulting to "jacket". Ignored once `initial` is set (editing).
  initialType?: ClothingType;
  onSubmit: (item: ClothingItem) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onMarkUnavailable?: () => void;
}

export default function ClothingForm({ initial, initialType, onSubmit, onCancel, onDelete, onMarkUnavailable }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [id] = useState(() => initial?.id ?? newId());
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<ClothingType>(initial?.type ?? initialType ?? "jacket");
  const [warmth, setWarmth] = useState(initial?.warmth ?? 5);
  const [waterproof, setWaterproof] = useState(initial?.waterproof ?? false);
  const [windproof, setWindproof] = useState(initial?.windproof ?? false);
  const [packable, setPackable] = useState(initial?.packable ?? false);
  const [substitutesForMidlayer, setSubstitutesForMidlayer] = useState(initial?.substitutesForMidlayer ?? false);
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [photoUri, setPhotoUri] = useState<string | undefined>(initial?.photoUri);

  const tagOptions = tagOptionsFor(type);
  const canSubmit = name.trim().length > 0;

  function handleSubmit() {
    onSubmit({
      ...initial,
      id,
      name: name.trim(),
      type,
      warmth,
      waterproof,
      windproof,
      packable,
      substitutesForMidlayer: type === "jacket" ? substitutesForMidlayer : undefined,
      tags: tagOptions.length > 0 && tags.length > 0 ? tags : undefined,
      photoUri,
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <PhotoPicker itemId={id} photoUri={photoUri} onChange={setPhotoUri} />

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Blue rain shell" />

      <Text style={styles.label}>Type</Text>
      <SingleSelect options={TYPE_OPTIONS} value={type} onChange={setType} />

      <Text style={styles.label}>Warmth</Text>
      <WarmthSlider
        value={warmth}
        onChange={setWarmth}
        showSubstitutesToggle={type === "jacket"}
        substitutesForMidlayer={substitutesForMidlayer}
        onToggleSubstitutes={setSubstitutesForMidlayer}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Waterproof</Text>
        <Switch value={waterproof} onValueChange={setWaterproof} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Windproof</Text>
        <Switch value={windproof} onValueChange={setWindproof} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Packable</Text>
        <Switch value={packable} onValueChange={setPackable} />
      </View>

      {tagOptions.length > 0 && (
        <>
          <Text style={styles.label}>Tags</Text>
          <TagChips options={tagOptions} selected={tags} onChange={setTags} />
        </>
      )}

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
    container: { padding: 20, gap: 4, alignItems: "stretch" },
    label: { fontSize: 13, color: theme.textSecondary, marginTop: 16, marginBottom: 4 },
    input: { borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.textPrimary },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12, minHeight: 44 },
    switchLabel: { fontSize: 15, color: theme.textPrimary },
    actions: { flexDirection: "row", gap: 12, marginTop: 24 },
    cancelButton: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: theme.border },
    saveButton: { flex: 1, paddingVertical: 12, alignItems: "center", borderRadius: 8, backgroundColor: theme.textPrimary },
    saveButtonDisabled: { opacity: 0.4 },
    saveLabel: { color: theme.bg, fontWeight: "600" },
    secondaryButton: { marginTop: 16, alignItems: "center", paddingVertical: 10 },
    secondaryLabel: { color: theme.textPrimary, fontWeight: "600" },
    deleteButton: { marginTop: 8, alignItems: "center", paddingVertical: 10 },
    deleteLabel: { color: theme.danger },
  });
}

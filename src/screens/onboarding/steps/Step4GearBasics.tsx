import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import WarmthSlider from "../../../components/WarmthSlider";
import PhotoPicker from "../../../components/PhotoPicker";
import { seedWarmthCalibration } from "../../../db/repositories/calibration";
import { createClothing } from "../../../db/repositories/clothing";
import { createShoe } from "../../../db/repositories/shoes";
import { createUmbrella } from "../../../db/repositories/umbrellas";
import { newId } from "../../../db/rowMapping";
import { withTimeout } from "../../../lib/withTimeout";
import type { ClothingType } from "../../../types";

// docs/04-screens-navigation.md §4.1 step 4 — "a short checklist-style add
// flow (not the full Gear CRUD screen)" for jacket/shoes/umbrella (the
// minimum for real recommendations instead of fallbackText) plus an
// optional bottoms entry, opening with the self-report warmth question.
const SELF_REPORT_OPTIONS: { label: string; offset: number }[] = [
  { label: "Cold", offset: 1 },
  { label: "Average", offset: 0 },
  { label: "Warm", offset: -1 },
];

type EntryState = "pending" | "expanded" | "done" | "skipped";

function WarmthEntry({
  title,
  clothingType,
  showSubstitutesToggle,
  onSaved,
}: {
  title: string;
  clothingType: ClothingType;
  showSubstitutesToggle: boolean;
  onSaved: () => void;
}) {
  const [state, setState] = useState<EntryState>("pending");
  const [id] = useState(() => newId());
  const [name, setName] = useState("");
  const [warmth, setWarmth] = useState(5);
  const [substitutesForMidlayer, setSubstitutesForMidlayer] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);

  if (state === "done") {
    return (
      <View style={styles.entryRow}>
        <Text style={styles.entryDone}>✓ {title}: {name}</Text>
      </View>
    );
  }
  if (state === "skipped") {
    return (
      <View style={styles.entryRow}>
        <Text style={styles.entrySkipped}>{title} — skipped</Text>
      </View>
    );
  }
  if (state === "pending") {
    return (
      <View style={styles.entryRow}>
        <Text style={styles.entryTitle}>{title}</Text>
        <View style={styles.entryButtons}>
          <Pressable onPress={() => setState("skipped")}><Text style={styles.entrySkipLabel}>Skip</Text></Pressable>
          <Pressable onPress={() => setState("expanded")} style={styles.entryAddButton}>
            <Text style={styles.entryAddLabel}>+ Add</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.expandedEntry}>
      <PhotoPicker itemId={id} photoUri={photoUri} onChange={setPhotoUri} />
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={`${title} name`} />
      <WarmthSlider
        value={warmth}
        onChange={setWarmth}
        showSubstitutesToggle={showSubstitutesToggle}
        substitutesForMidlayer={substitutesForMidlayer}
        onToggleSubstitutes={setSubstitutesForMidlayer}
      />
      <Pressable
        disabled={!name.trim()}
        onPress={async () => {
          await withTimeout(
            createClothing({
              id,
              name: name.trim(),
              type: clothingType,
              warmth,
              waterproof: false,
              windproof: false,
              packable: false,
              substitutesForMidlayer: showSubstitutesToggle ? substitutesForMidlayer : undefined,
              photoUri,
            }),
            undefined
          );
          setState("done");
          onSaved();
        }}
        style={[styles.entrySaveButton, !name.trim() && styles.entrySaveButtonDisabled]}
      >
        <Text style={styles.entrySaveLabel}>Save</Text>
      </Pressable>
      <Pressable onPress={() => setState("skipped")}>
        <Text style={styles.entrySkipLabel}>Skip this one</Text>
      </Pressable>
    </View>
  );
}

function SimpleEntry({
  title,
  kind,
  onSaved,
}: {
  title: string;
  kind: "shoes" | "umbrella";
  onSaved: () => void;
}) {
  const [state, setState] = useState<EntryState>("pending");
  const [id] = useState(() => newId());
  const [name, setName] = useState("");
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);

  if (state === "done") {
    return (
      <View style={styles.entryRow}>
        <Text style={styles.entryDone}>✓ {title}: {name}</Text>
      </View>
    );
  }
  if (state === "skipped") {
    return (
      <View style={styles.entryRow}>
        <Text style={styles.entrySkipped}>{title} — skipped</Text>
      </View>
    );
  }
  if (state === "pending") {
    return (
      <View style={styles.entryRow}>
        <Text style={styles.entryTitle}>{title}</Text>
        <View style={styles.entryButtons}>
          <Pressable onPress={() => setState("skipped")}><Text style={styles.entrySkipLabel}>Skip</Text></Pressable>
          <Pressable onPress={() => setState("expanded")} style={styles.entryAddButton}>
            <Text style={styles.entryAddLabel}>+ Add</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.expandedEntry}>
      <PhotoPicker itemId={id} photoUri={photoUri} onChange={setPhotoUri} />
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={`${title} name`} />
      <Pressable
        disabled={!name.trim()}
        onPress={async () => {
          if (kind === "shoes") {
            await withTimeout(
              createShoe({ id, name: name.trim(), type: "sneaker", waterproof: false, grip: "med", photoUri }),
              undefined
            );
          } else {
            await withTimeout(
              createUmbrella({ id, name: name.trim(), type: "compact", windRating: "med", photoUri }),
              undefined
            );
          }
          setState("done");
          onSaved();
        }}
        style={[styles.entrySaveButton, !name.trim() && styles.entrySaveButtonDisabled]}
      >
        <Text style={styles.entrySaveLabel}>Save</Text>
      </Pressable>
      <Pressable onPress={() => setState("skipped")}>
        <Text style={styles.entrySkipLabel}>Skip this one</Text>
      </Pressable>
    </View>
  );
}

interface Props {
  onNext: () => void;
}

export default function Step4GearBasics({ onNext }: Props) {
  const [selfReportDone, setSelfReportDone] = useState(false);

  async function selectSelfReport(offset: number) {
    await withTimeout(seedWarmthCalibration(offset), undefined);
    setSelfReportDone(true);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Add a few gear basics</Text>

      {!selfReportDone ? (
        <View style={styles.selfReport}>
          <Text style={styles.question}>Do you tend to run warm, cold, or about average?</Text>
          <Text style={styles.body}>
            Helps us get your first few recommendations right — you can fine-tune this anytime from how
            a trip actually felt.
          </Text>
          <View style={styles.selfReportButtons}>
            {SELF_REPORT_OPTIONS.map((option) => (
              <Pressable key={option.label} onPress={() => selectSelfReport(option.offset)} style={styles.selfReportButton}>
                <Text style={styles.selfReportLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setSelfReportDone(true)}>
            <Text style={styles.entrySkipLabel}>Skip</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <WarmthEntry title="Jacket" clothingType="jacket" showSubstitutesToggle onSaved={() => {}} />
          <SimpleEntry title="Shoes" kind="shoes" onSaved={() => {}} />
          <SimpleEntry title="Umbrella" kind="umbrella" onSaved={() => {}} />
          <Text style={styles.optionalLabel}>Optional</Text>
          <WarmthEntry title="Bottoms/trousers" clothingType="bottoms" showSubstitutesToggle={false} onSaved={() => {}} />

          <Pressable onPress={onNext} style={styles.primaryButton}>
            <Text style={styles.primaryLabel}>Continue</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 4 },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  selfReport: { gap: 12 },
  question: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 13, color: "#5C6478" },
  selfReportButtons: { flexDirection: "row", gap: 8, marginTop: 8 },
  selfReportButton: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: "#DDE1EA" },
  selfReportLabel: { fontWeight: "600" },
  entryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#DDE1EA" },
  entryTitle: { fontSize: 15, fontWeight: "600" },
  entryDone: { fontSize: 15, color: "#3F9A5C" },
  entrySkipped: { fontSize: 15, color: "#5C6478" },
  entryButtons: { flexDirection: "row", alignItems: "center", gap: 16 },
  entrySkipLabel: { color: "#5C6478" },
  entryAddButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: "#1A1E29" },
  entryAddLabel: { color: "#FFFFFF", fontWeight: "600" },
  expandedEntry: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#DDE1EA", gap: 12 },
  input: { borderWidth: 1, borderColor: "#DDE1EA", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  entrySaveButton: { paddingVertical: 12, alignItems: "center", borderRadius: 8, backgroundColor: "#1A1E29" },
  entrySaveButtonDisabled: { opacity: 0.4 },
  entrySaveLabel: { color: "#FFFFFF", fontWeight: "600" },
  optionalLabel: { fontSize: 12, color: "#5C6478", marginTop: 16, marginBottom: 4, textTransform: "uppercase" },
  primaryButton: { marginTop: 24, paddingVertical: 14, alignItems: "center", borderRadius: 8, backgroundColor: "#1A1E29" },
  primaryLabel: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
});

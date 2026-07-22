import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import WarmthSlider from "../../components/WarmthSlider";
import PhotoPicker from "../../components/PhotoPicker";
import { seedWarmthCalibration } from "../../db/repositories/calibration";
import { createClothing } from "../../db/repositories/clothing";
import { createShoe } from "../../db/repositories/shoes";
import { createUmbrella } from "../../db/repositories/umbrellas";
import { newId } from "../../db/rowMapping";
import { withTimeout } from "../../lib/withTimeout";
import useTheme from "../../theme/useTheme";
import type { ClothingType } from "../../types";

// docs/04-screens-navigation.md §4.1 (2026-07-21 minimal-onboarding
// rework) — "a short checklist-style add flow (not the full Gear CRUD
// screen)" for jacket/shoes/umbrella (the minimum for real recommendations
// instead of fallbackText) plus an optional bottoms entry, opening with the
// self-report warmth question. Originally a forced onboarding step; now
// reached from the Today tab's SetupChecklist, any time the user chooses
// to — see DECISIONS.md.
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
  const theme = useTheme();
  const styles = getStyles(theme);
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
  const theme = useTheme();
  const styles = getStyles(theme);
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
  onDone: () => void;
}

export default function GearBasicsSetup({ onDone }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
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

          <Pressable onPress={onDone} style={styles.primaryButton}>
            <Text style={styles.primaryLabel}>Done</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: 24, gap: 4, backgroundColor: theme.bg },
    title: { fontSize: 22, fontWeight: "700", marginBottom: 16, color: theme.textPrimary },
    selfReport: { gap: 12 },
    question: { fontSize: 17, fontWeight: "600", color: theme.textPrimary },
    body: { fontSize: 13, color: theme.textSecondary },
    selfReportButtons: { flexDirection: "row", gap: 8, marginTop: 8 },
    selfReportButton: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: theme.border },
    selfReportLabel: { fontWeight: "600", color: theme.textPrimary },
    entryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border },
    entryTitle: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    entryDone: { fontSize: 15, color: theme.feedbackPositive },
    entrySkipped: { fontSize: 15, color: theme.textSecondary },
    entryButtons: { flexDirection: "row", alignItems: "center", gap: 16 },
    entrySkipLabel: { color: theme.textSecondary },
    entryAddButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.accentWalk },
    entryAddLabel: { color: theme.bg, fontWeight: "600" },
    expandedEntry: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.border, gap: 12 },
    input: { borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.textPrimary },
    entrySaveButton: { paddingVertical: 12, alignItems: "center", borderRadius: 8, backgroundColor: theme.accentWalk },
    entrySaveButtonDisabled: { opacity: 0.4 },
    entrySaveLabel: { color: theme.bg, fontWeight: "600" },
    optionalLabel: { fontSize: 12, color: theme.textSecondary, marginTop: 16, marginBottom: 4, textTransform: "uppercase" },
    primaryButton: { marginTop: 24, paddingVertical: 14, alignItems: "center", borderRadius: 8, backgroundColor: theme.accentWalk },
    primaryLabel: { color: theme.bg, fontWeight: "600", fontSize: 15 },
  });
}

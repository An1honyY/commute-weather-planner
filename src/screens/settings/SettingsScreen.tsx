import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  getCarryPreferenceDefault,
  getCrashReportingEnabled,
  getThemePreference,
  setCarryPreferenceDefault,
  setCrashReportingEnabled,
  setThemePreference,
  type ThemePreference,
} from "../../db/repositories/settings";
import { getAdvancedThresholds, saveAdvancedThresholds } from "../../db/repositories/advancedThresholds";
import { getWarmthCalibration, setWindSensitivityOffset } from "../../db/repositories/calibration";
import type { AdvancedWarmthThresholds, CarryPreference, WarmthCalibration } from "../../types";

// docs/09-design-system.md §9.1/§9.1.1, docs/08-build-phases.md Phase 5's
// scoped Settings screen: theme picker, CarryPreference default, the
// single-user-scope disclosure, and the collapsed Advanced threshold
// override. Full app-wide re-theming (every screen reading a useTheme()
// hook) is Phase 11 Polish — this screen persists the preference
// correctly now so that retrofit has a real value to read later, without
// this phase needing to touch every screen's colors.
const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const DEFAULT_FREEZING_C = 2;
const DEFAULT_COOL_UPPER_C = 14;
const DEFAULT_WARM_OUTDOOR_C = 18;

// §7.5.2/§9.1.1 — fixed three-position control, not a free slider (there's
// no natural feedback loop to learn this axis from automatically).
const WIND_SENSITIVITY_OPTIONS: { value: number; label: string }[] = [
  { value: -1, label: "Less bothered by wind" },
  { value: 0, label: "Average" },
  { value: 1, label: "More bothered by wind" },
];

const SEASON_LABELS: { key: "winter" | "summer" | "shoulder"; label: string }[] = [
  { key: "winter", label: "Winter" },
  { key: "summer", label: "Summer" },
  { key: "shoulder", label: "Other" },
];

export default function SettingsScreen() {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [carryPreference, setCarryPreference] = useState<CarryPreference>("no-preference");
  const [crashReporting, setCrashReporting] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [thresholds, setThresholds] = useState<AdvancedWarmthThresholds>({});
  const [calibration, setCalibration] = useState<WarmthCalibration>({ offsetLevels: 0, sampleCount: 0 });

  useFocusEffect(
    useCallback(() => {
      getThemePreference().then(setTheme);
      getCarryPreferenceDefault().then(setCarryPreference);
      getCrashReportingEnabled().then(setCrashReporting);
      getAdvancedThresholds().then(setThresholds);
      getWarmthCalibration().then(setCalibration);
    }, [])
  );

  async function selectTheme(value: ThemePreference) {
    setTheme(value);
    await setThemePreference(value);
  }

  async function selectCarryPreference(value: CarryPreference) {
    setCarryPreference(value);
    await setCarryPreferenceDefault(value);
  }

  async function toggleCrashReporting(value: boolean) {
    setCrashReporting(value);
    await setCrashReportingEnabled(value);
  }

  async function updateThreshold(field: keyof AdvancedWarmthThresholds, text: string) {
    const next = { ...thresholds, [field]: text.trim() === "" ? undefined : Number(text) };
    setThresholds(next);
    await saveAdvancedThresholds(next);
  }

  async function resetThresholds() {
    setThresholds({});
    await saveAdvancedThresholds({});
  }

  async function selectWindSensitivity(value: number) {
    setCalibration((c) => ({ ...c, windSensitivityOffset: value }));
    await setWindSensitivityOffset(value);
  }

  const seasonalSampleCounts = calibration.seasonalSampleCounts;
  const hasSeasonalSamples = seasonalSampleCounts && Object.values(seasonalSampleCounts).some((n) => n > 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>Appearance</Text>
      <View style={styles.segmentRow}>
        {THEME_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => selectTheme(option.value)}
            style={[styles.segment, theme === option.value && styles.segmentActive]}
          >
            <Text style={[styles.segmentLabel, theme === option.value && styles.segmentLabelActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Warmth</Text>
      <Text style={styles.body}>
        {calibration.sampleCount > 0
          ? `Adjusted from ${calibration.sampleCount} check-ins`
          : "No check-ins yet — rate the gear call after a trip to start calibrating"}
      </Text>
      {hasSeasonalSamples && seasonalSampleCounts && (
        <>
          <Text style={styles.hint}>We learn separately for each season, since how you dress in winter doesn&apos;t always match summer.</Text>
          <Text style={styles.body}>
            {SEASON_LABELS.map((s) => `${s.label}: ${seasonalSampleCounts[s.key]}`).join(" · ")}
          </Text>
        </>
      )}

      <Text style={[styles.label, styles.windSensitivityLabel]}>Wind sensitivity</Text>
      <Text style={styles.hint}>
        Only changes the extra warmth bump for windy spots you&apos;ve marked (Local knowledge) — doesn&apos;t affect your regular recommendations.
      </Text>
      <View style={styles.segmentRow}>
        {WIND_SENSITIVITY_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => selectWindSensitivity(option.value)}
            style={[styles.segment, (calibration.windSensitivityOffset ?? 0) === option.value && styles.segmentActive]}
          >
            <Text
              style={[
                styles.segmentLabel,
                (calibration.windSensitivityOffset ?? 0) === option.value && styles.segmentLabelActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Carrying a spare layer</Text>
      <Text style={styles.body}>
        The default for new trips — you can still override it per trip on the Plan screen.
      </Text>
      <Pressable
        onPress={() => selectCarryPreference(carryPreference === "no-preference" ? "avoid-spares" : "no-preference")}
        style={styles.carryChip}
      >
        <Text style={styles.carryChipLabel}>{carryPreference === "no-preference" ? "No preference" : "Avoid spares"}</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Crash reporting</Text>
      <View style={styles.switchRow}>
        <Text style={styles.body}>Send anonymous crash reports to help fix bugs.</Text>
        <Switch value={crashReporting} onValueChange={toggleCrashReporting} />
      </View>

      <Text style={styles.sectionTitle}>About</Text>
      <Text style={styles.body}>
        Commute Weather Planner is built for one person&apos;s wardrobe and one commute at a time.
      </Text>

      <Pressable onPress={() => setAdvancedExpanded((v) => !v)} style={styles.advancedHeader}>
        <Text style={styles.sectionTitle}>{advancedExpanded ? "▾" : "▸"} Advanced — set exact temperature thresholds</Text>
      </Pressable>
      <Text style={styles.body}>
        Most people get better results from the check-ins after a trip — only change these if you want to set the
        exact cutoffs yourself.
      </Text>
      {advancedExpanded && (
        <View style={styles.advancedBody}>
          <Text style={styles.label}>Freezing cutoff (°C)</Text>
          <Text style={styles.hint}>Below this, we always recommend maximum warmth, no exceptions.</Text>
          <TextInput
            style={styles.input}
            keyboardType="numbers-and-punctuation"
            placeholder={String(DEFAULT_FREEZING_C)}
            value={thresholds.freezingC === undefined ? "" : String(thresholds.freezingC)}
            onChangeText={(t) => updateThreshold("freezingC", t)}
          />

          <Text style={styles.label}>Cool cutoff (°C)</Text>
          <Text style={styles.hint}>Above this, conditions count as mild rather than cool.</Text>
          <TextInput
            style={styles.input}
            keyboardType="numbers-and-punctuation"
            placeholder={String(DEFAULT_COOL_UPPER_C)}
            value={thresholds.coolUpperC === undefined ? "" : String(thresholds.coolUpperC)}
            onChangeText={(t) => updateThreshold("coolUpperC", t)}
          />

          <Text style={styles.label}>Warm cutoff (°C)</Text>
          <Text style={styles.hint}>Above this, we treat it as warm enough to trigger the bus/train AC warning in summer.</Text>
          <TextInput
            style={styles.input}
            keyboardType="numbers-and-punctuation"
            placeholder={String(DEFAULT_WARM_OUTDOOR_C)}
            value={thresholds.warmOutdoorC === undefined ? "" : String(thresholds.warmOutdoorC)}
            onChangeText={(t) => updateThreshold("warmOutdoorC", t)}
          />

          <Pressable onPress={resetThresholds}>
            <Text style={styles.resetLabel}>Reset to defaults</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 4 },
  sectionTitle: { fontSize: 15, fontWeight: "600", marginTop: 24, marginBottom: 8 },
  body: { fontSize: 13, color: "#5C6478" },
  segmentRow: { flexDirection: "row", gap: 8 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#DDE1EA", alignItems: "center" },
  segmentActive: { backgroundColor: "#1A1E29", borderColor: "#1A1E29" },
  segmentLabel: { fontSize: 13 },
  segmentLabelActive: { color: "#FFFFFF", fontWeight: "600" },
  carryChip: { alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#DDE1EA" },
  carryChipLabel: { fontSize: 13 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44 },
  advancedHeader: { marginTop: 24 },
  advancedBody: { marginTop: 12, gap: 4 },
  label: { fontSize: 13, fontWeight: "600", marginTop: 12 },
  windSensitivityLabel: { marginTop: 16 },
  hint: { fontSize: 12, color: "#5C6478", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#DDE1EA", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  resetLabel: { color: "#C97F2E", marginTop: 16, fontSize: 13 },
});

import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import {
  getCarryPreferenceDefault,
  getCrashReportingEnabled,
  getDismissedSetupTasks,
  getThemePreference,
  getTimeFormatPreference,
  resetDismissedSetupTasks,
  setCarryPreferenceDefault,
  setCrashReportingEnabled,
  setThemePreference,
  setTimeFormatPreference,
  type ThemePreference,
  type TimeFormatPreference,
} from "../../db/repositories/settings";
import { getAdvancedThresholds, saveAdvancedThresholds } from "../../db/repositories/advancedThresholds";
import { getWarmthCalibration, setWindSensitivityOffset } from "../../db/repositories/calibration";
import { exportData, importData } from "../../lib/dataExport";
import { showAlert } from "../../lib/crossPlatformAlert";
import { initCrashReportingIfEnabled } from "../../lib/crashReporting";
import { useThemeStore } from "../../theme/useThemeStore";
import { useTimeFormatStore } from "../../lib/useTimeFormatStore";
import useTheme from "../../theme/useTheme";
import { cardElevationStyle } from "../../theme/tokens";
import { RADIUS, SPACING, TYPE } from "../../theme/typography";
import FormRow from "../../components/FormRow";
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

const TIME_FORMAT_OPTIONS: { value: TimeFormatPreference; label: string }[] = [
  { value: "12h", label: "12-hour (am/pm)" },
  { value: "24h", label: "24-hour" },
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
  const colors = useTheme();
  const styles = getStyles(colors);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [timeFormat, setTimeFormat] = useState<TimeFormatPreference>("12h");
  const [carryPreference, setCarryPreference] = useState<CarryPreference>("no-preference");
  const [crashReporting, setCrashReporting] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [thresholds, setThresholds] = useState<AdvancedWarmthThresholds>({});
  const [calibration, setCalibration] = useState<WarmthCalibration>({ offsetLevels: 0, sampleCount: 0 });
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [dismissedSetupTaskCount, setDismissedSetupTaskCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getThemePreference().then(setTheme);
      getTimeFormatPreference().then(setTimeFormat);
      getCarryPreferenceDefault().then(setCarryPreference);
      getCrashReportingEnabled().then(setCrashReporting);
      getAdvancedThresholds().then(setThresholds);
      getWarmthCalibration().then(setCalibration);
      getDismissedSetupTasks().then((ids) => setDismissedSetupTaskCount(ids.length));
    }, [])
  );

  async function showSetupTipsAgain() {
    await resetDismissedSetupTasks();
    setDismissedSetupTaskCount(0);
  }

  async function selectTheme(value: ThemePreference) {
    setTheme(value);
    useThemeStore.getState().setThemePreference(value);
    await setThemePreference(value);
  }

  async function selectTimeFormat(value: TimeFormatPreference) {
    setTimeFormat(value);
    useTimeFormatStore.getState().setTimeFormatPreference(value);
    await setTimeFormatPreference(value);
  }

  async function selectCarryPreference(value: CarryPreference) {
    setCarryPreference(value);
    await setCarryPreferenceDefault(value);
  }

  async function toggleCrashReporting(value: boolean) {
    setCrashReporting(value);
    await setCrashReportingEnabled(value);
    // §10.5 — flipping the toggle takes effect immediately: initializes the
    // provider the moment it's turned on, and the provider itself stays
    // uninitialized (no telemetry connection at all) whenever it's off.
    await initCrashReportingIfEnabled();
  }

  async function handleExport() {
    setExportBusy(true);
    try {
      await exportData();
    } catch {
      showAlert("Couldn't export your data", "Check your device has space and permission, then try again.");
    } finally {
      setExportBusy(false);
    }
  }

  async function handleImport() {
    setImportBusy(true);
    try {
      const result = await importData();
      if (result.error) {
        showAlert("Couldn't import that file", "Make sure it's a backup exported from this app, then try again.");
      } else if (result.imported) {
        showAlert("Import complete", "Your data has been restored.");
      }
    } catch {
      showAlert("Couldn't import that file", "Make sure it's a backup exported from this app, then try again.");
    } finally {
      setImportBusy(false);
    }
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
      <View style={styles.sectionCard}>
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
      </View>

      <Text style={styles.sectionTitle}>Time format</Text>
      <View style={styles.sectionCard}>
        <View style={styles.segmentRow}>
          {TIME_FORMAT_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => selectTimeFormat(option.value)}
              style={[styles.segment, timeFormat === option.value && styles.segmentActive]}
            >
              <Text style={[styles.segmentLabel, timeFormat === option.value && styles.segmentLabelActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Warmth</Text>
      <View style={styles.sectionCard}>
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
      </View>

      <Text style={styles.sectionTitle}>Carrying a spare layer</Text>
      <View style={styles.sectionCard}>
        <Text style={styles.body}>
          The default for new trips — you can still override it per trip on the Plan screen.
        </Text>
        <Pressable
          onPress={() => selectCarryPreference(carryPreference === "no-preference" ? "avoid-spares" : "no-preference")}
          style={styles.carryChip}
        >
          <Text style={styles.carryChipLabel}>{carryPreference === "no-preference" ? "No preference" : "Avoid spares"}</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Crash reporting</Text>
      <View style={styles.sectionCard}>
        <FormRow label="Anonymous crash reports" description="Helps us find and fix bugs.">
          <Switch value={crashReporting} onValueChange={toggleCrashReporting} />
        </FormRow>
      </View>

      <Text style={styles.sectionTitle}>Your data</Text>
      <View style={styles.sectionCard}>
        <Text style={styles.body}>
          Export a backup of your gear, locations, and journey history — including gear photos — as a single
          file, or restore from one after a reinstall.
        </Text>
        <View style={styles.dataButtonRow}>
          <Pressable
            onPress={handleExport}
            disabled={exportBusy}
            style={[styles.dataButton, exportBusy && styles.dataButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Export my data"
          >
            <Text style={styles.dataButtonLabel}>{exportBusy ? "Exporting…" : "Export my data"}</Text>
          </Pressable>
          <Pressable
            onPress={handleImport}
            disabled={importBusy}
            style={[styles.dataButton, importBusy && styles.dataButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Import data"
          >
            <Text style={styles.dataButtonLabel}>{importBusy ? "Importing…" : "Import data"}</Text>
          </Pressable>
        </View>
      </View>

      {dismissedSetupTaskCount > 0 && (
        <>
          <Text style={styles.sectionTitle}>Setup tips</Text>
          <View style={styles.sectionCard}>
            <Text style={styles.body}>
              You&apos;ve postponed {dismissedSetupTaskCount} setup {dismissedSetupTaskCount === 1 ? "tip" : "tips"} on
              the Today tab.
            </Text>
            <Pressable onPress={showSetupTipsAgain} style={styles.dataButton}>
              <Text style={styles.dataButtonLabel}>Show setup tips again</Text>
            </Pressable>
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>About</Text>
      <View style={styles.sectionCard}>
        <Text style={styles.body}>
          Commute Weather Planner is built for one person&apos;s wardrobe and one commute at a time.
        </Text>
      </View>

      <Pressable onPress={() => setAdvancedExpanded((v) => !v)} style={styles.advancedHeader}>
        <Text style={styles.sectionTitle}>{advancedExpanded ? "▾" : "▸"} Advanced — set exact temperature thresholds</Text>
      </Pressable>
      <View style={styles.sectionCard}>
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
              placeholderTextColor={colors.textSecondary}
              keyboardType="numbers-and-punctuation"
              placeholder={String(DEFAULT_FREEZING_C)}
              value={thresholds.freezingC === undefined ? "" : String(thresholds.freezingC)}
              onChangeText={(t) => updateThreshold("freezingC", t)}
            />

            <Text style={styles.label}>Cool cutoff (°C)</Text>
            <Text style={styles.hint}>Above this, conditions count as mild rather than cool.</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.textSecondary}
              keyboardType="numbers-and-punctuation"
              placeholder={String(DEFAULT_COOL_UPPER_C)}
              value={thresholds.coolUpperC === undefined ? "" : String(thresholds.coolUpperC)}
              onChangeText={(t) => updateThreshold("coolUpperC", t)}
            />

            <Text style={styles.label}>Warm cutoff (°C)</Text>
            <Text style={styles.hint}>Above this, we treat it as warm enough to trigger the bus/train AC warning in summer.</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor={colors.textSecondary}
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
      </View>

      {/* docs/12-dev-workflow-ci.md §12.2 — `__DEV__` compiles to a literal
          `false` in release builds, so this row (and the DevMenu route
          itself, RootNavigator.tsx) is dead-code-eliminated, not merely
          hidden behind a runtime check. */}
      {__DEV__ && (
        <>
          <Text style={styles.sectionTitle}>Developer</Text>
          <View style={styles.sectionCard}>
            <Pressable onPress={() => navigation.navigate("DevMenu")} style={styles.dataButton}>
              <Text style={styles.dataButtonLabel}>Debug menu</Text>
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: SPACING.xl, gap: 4, backgroundColor: theme.bg },
    sectionTitle: { ...TYPE.subtitle, fontSize: 15, marginTop: SPACING.xl, marginBottom: SPACING.sm, color: theme.textPrimary },
    sectionCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.lg,
      gap: SPACING.sm,
      ...cardElevationStyle(theme),
    },
    body: { ...TYPE.caption, color: theme.textSecondary },
    segmentRow: { flexDirection: "row", gap: SPACING.sm },
    segment: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: theme.border, alignItems: "center" },
    segmentActive: { backgroundColor: theme.accentWalk, borderColor: theme.accentWalk },
    segmentLabel: { fontSize: 13, color: theme.textPrimary },
    // Unified with LocationForm.tsx's equivalent segmented control — both
    // used to disagree (white vs theme.bg for the active label) with no
    // reason to diverge; white reads correctly against accentWalk in both
    // themes, so that's the one kept.
    segmentLabelActive: { color: "#FFFFFF", fontWeight: "600" },
    carryChip: { alignSelf: "flex-start", marginTop: SPACING.sm, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: theme.border },
    carryChipLabel: { fontSize: 13, color: theme.textPrimary },
    dataButtonRow: { flexDirection: "row", gap: SPACING.sm },
    dataButton: { flex: 1, minHeight: 44, paddingVertical: 10, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" },
    dataButtonDisabled: { opacity: 0.5 },
    dataButtonLabel: { fontSize: 13, fontWeight: "600", color: theme.textPrimary },
    advancedHeader: { marginTop: SPACING.xl },
    advancedBody: { marginTop: SPACING.md, gap: 4 },
    label: { fontSize: 13, fontWeight: "600", marginTop: SPACING.md, color: theme.textPrimary },
    windSensitivityLabel: { marginTop: SPACING.md },
    hint: { ...TYPE.micro, fontSize: 12, color: theme.textSecondary, marginBottom: 4 },
    input: { borderWidth: 1, borderColor: theme.border, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.textPrimary, backgroundColor: theme.bg },
    resetLabel: { color: theme.accentWalk, marginTop: SPACING.md, fontSize: 13 },
  });
}

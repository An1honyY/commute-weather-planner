import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { getDevOverrides, resetDevOverrides, setDevOverride, type DevOverrides } from "../../lib/devOverrides";
import { resetOnboardingAndPreferences } from "../../db/repositories/settings";
import { listUpcomingJourneys } from "../../db/repositories/journeys";
import { checkForecastDrift } from "../../lib/forecastDrift";
import useTheme from "../../theme/useTheme";
import type { RootStackParamList } from "../../navigation/types";
import type { Journey } from "../../types";
import type { ServiceError } from "../../services/types";

// docs/12-dev-workflow-ci.md §12.2 — the debug/dev menu. Gated by `__DEV__`
// both here (RootNavigator only registers this screen in dev/preview
// builds — see its own comment) and at each service's own override check,
// so this screen having no effect is never load-bearing for correctness,
// only for reachability. Reached from a `__DEV__`-only row in Settings
// rather than shake-to-open — §12.2 offers both as equally-valid "common,
// low-effort" examples, and a visible-but-dev-only tap target is easier to
// actually use while building than a shake gesture, with no production
// exposure risk either way since `__DEV__` compiles to a literal `false`
// (dead-code-eliminated) in release builds.
//
// Not built: §12.2 point 3, "fast-forward the current date used by
// recurrence materialization and History's date filter." Doing this for
// real means every `new Date()` call site that stands in for "now"
// (materializeToday.ts, HistoryScreen, TodayScreen, leaveBy.ts...) reading
// through one shared, overridable clock instead — a real refactor across
// many files, not a toggle to bolt on alongside the other four points.
// Logged in DECISIONS.md as deliberately left for its own scoped pass.
const ERROR_OPTIONS: { value: ServiceError | undefined; label: string }[] = [
  { value: undefined, label: "Off" },
  { value: "network", label: "Network" },
  { value: "rate-limited", label: "Rate-limited" },
  { value: "unreachable", label: "Unreachable" },
];

function ForceErrorRow({
  title,
  overrideKey,
  value,
  onChange,
}: {
  title: string;
  overrideKey: "routesError" | "weatherError" | "transitError";
  value: ServiceError | undefined;
  onChange: (key: "routesError" | "weatherError" | "transitError", next: ServiceError | undefined) => void;
}) {
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={styles.section}>
      <Text style={styles.rowTitle}>{title}</Text>
      <View style={styles.segmentRow}>
        {ERROR_OPTIONS.map((option) => (
          <Pressable
            key={option.label}
            onPress={() => onChange(overrideKey, option.value)}
            style={[styles.segment, value === option.value && styles.segmentActive]}
          >
            <Text style={[styles.segmentLabel, value === option.value && styles.segmentLabelActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function DevMenuScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [overrides, setOverrides] = useState<DevOverrides>(getDevOverrides());
  const [delayText, setDelayText] = useState("");
  const [upcomingJourneys, setUpcomingJourneys] = useState<Journey[]>([]);
  const [checkingDrift, setCheckingDrift] = useState<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      // A generous window (a year out) rather than the app's usual
      // near-term "upcoming" windows — this list exists to pick literally
      // any saved journey to test against, not to reflect what a user
      // would actually see today.
      listUpcomingJourneys(24 * 365).then(setUpcomingJourneys);
    }, [])
  );

  function updateOverride(key: "routesError" | "weatherError" | "transitError", value: ServiceError | undefined) {
    setDevOverride(key, value);
    setOverrides(getDevOverrides());
  }

  function applyDelay() {
    const minutes = Number(delayText);
    if (Number.isNaN(minutes)) return;
    setDevOverride("transitDelayMinutes", minutes);
    setOverrides(getDevOverrides());
  }

  function clearDelay() {
    setDevOverride("transitDelayMinutes", undefined);
    setOverrides(getDevOverrides());
    setDelayText("");
  }

  function clearAllOverrides() {
    resetDevOverrides();
    setOverrides(getDevOverrides());
    setDelayText("");
  }

  async function runDriftCheck(journey: Journey) {
    setCheckingDrift(journey.id);
    try {
      const result = await checkForecastDrift(journey);
      Alert.alert(
        result.changed ? "Forecast drifted" : "No meaningful drift",
        result.changed
          ? "Weather was re-fetched and the recommendation changed — the leave-by notification was re-scheduled."
          : "Weather was re-fetched but the recommendation didn't change enough to update anything."
      );
    } finally {
      setCheckingDrift(undefined);
    }
  }

  function confirmResetOnboarding() {
    Alert.alert(
      "Reset onboarding + preferences?",
      "Clears the onboarding-completed flag, default location, dismissed setup tips, theme preference, and crash-reporting opt-in. Doesn't touch locations/gear/journeys.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetOnboardingAndPreferences();
            navigation.reset({ index: 0, routes: [{ name: "Onboarding" }] });
          },
        },
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Force API errors</Text>
      <Text style={styles.hint}>Exercises §5.1&apos;s offline fallback UX without a real outage or rate limit.</Text>
      <ForceErrorRow title="Routes" overrideKey="routesError" value={overrides.routesError} onChange={updateOverride} />
      <ForceErrorRow title="Weather" overrideKey="weatherError" value={overrides.weatherError} onChange={updateOverride} />
      <ForceErrorRow title="Transit" overrideKey="transitError" value={overrides.transitError} onChange={updateOverride} />

      <Text style={styles.heading}>Simulate transit delay</Text>
      <Text style={styles.hint}>
        Applies to every AT GTFS Realtime lookup until cleared — {overrides.transitDelayMinutes !== undefined
          ? `currently forcing ${overrides.transitDelayMinutes} min.`
          : "not set."}
      </Text>
      <View style={styles.delayRow}>
        <TextInput
          style={styles.delayInput}
          value={delayText}
          onChangeText={setDelayText}
          placeholder="Minutes"
          keyboardType="numbers-and-punctuation"
        />
        <Pressable onPress={applyDelay} style={styles.smallButton}>
          <Text style={styles.smallButtonLabel}>Apply</Text>
        </Pressable>
        <Pressable onPress={clearDelay} style={styles.smallButton}>
          <Text style={styles.smallButtonLabel}>Clear</Text>
        </Pressable>
      </View>

      <Pressable onPress={clearAllOverrides} style={styles.linkButton}>
        <Text style={styles.linkLabel}>Clear all overrides</Text>
      </Pressable>

      <Text style={styles.heading}>Forecast drift re-check</Text>
      <Text style={styles.hint}>Manually runs §5.2&apos;s re-fetch-and-recompute against a chosen upcoming journey.</Text>
      {upcomingJourneys.length === 0 ? (
        <Text style={styles.hint}>No upcoming journeys to test against.</Text>
      ) : (
        upcomingJourneys.map((journey) => (
          <Pressable
            key={journey.id}
            onPress={() => runDriftCheck(journey)}
            disabled={checkingDrift === journey.id}
            style={styles.journeyRow}
          >
            <Text style={styles.journeyLabel}>
              {journey.origin.label} → {journey.destination.label}
            </Text>
            <Text style={styles.journeyMeta}>
              {checkingDrift === journey.id ? "Checking…" : new Date(journey.departTime).toLocaleString()}
            </Text>
          </Pressable>
        ))
      )}

      <Text style={styles.heading}>First-run state</Text>
      <Pressable onPress={confirmResetOnboarding} style={styles.dangerButton}>
        <Text style={styles.dangerButtonLabel}>Reset onboarding + preferences</Text>
      </Pressable>
    </ScrollView>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: 20, gap: 4, backgroundColor: theme.bg },
    heading: { fontSize: 15, fontWeight: "600", marginTop: 24, marginBottom: 4, color: theme.textPrimary },
    hint: { fontSize: 12, color: theme.textSecondary, marginBottom: 8 },
    section: { marginTop: 12 },
    rowTitle: { fontSize: 13, fontWeight: "600", color: theme.textPrimary, marginBottom: 6 },
    segmentRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    segment: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.border },
    segmentActive: { backgroundColor: theme.textPrimary, borderColor: theme.textPrimary },
    segmentLabel: { fontSize: 12, color: theme.textPrimary },
    segmentLabelActive: { color: theme.bg, fontWeight: "600" },
    delayRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    delayInput: { flex: 1, borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.textPrimary },
    smallButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.border },
    smallButtonLabel: { fontSize: 13, fontWeight: "600", color: theme.textPrimary },
    linkButton: { marginTop: 12, alignSelf: "flex-start" },
    linkLabel: { fontSize: 13, color: theme.accentWalk, fontWeight: "600" },
    journeyRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
    journeyLabel: { fontSize: 14, fontWeight: "600", color: theme.textPrimary },
    journeyMeta: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    dangerButton: { marginTop: 8, paddingVertical: 12, alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: theme.danger },
    dangerButtonLabel: { color: theme.danger, fontWeight: "600", fontSize: 14 },
  });
}

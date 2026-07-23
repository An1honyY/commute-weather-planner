import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { listLocations } from "../../db/repositories/locations";
import { createSavedRoute, listSavedRoutes, touchSavedRoute } from "../../db/repositories/savedRoutes";
import { updateJourney } from "../../db/repositories/journeys";
import { planJourney, DEPART_TIME_LEAD_MS } from "../../lib/planJourney";
import { showAlert } from "../../lib/crossPlatformAlert";
import { findRainWindowNear } from "../../lib/weather";
import { getHourlyForecast } from "../../services/weatherService";
import { formatTime } from "../../lib/formatTime";
import { useTimeFormatStore } from "../../lib/useTimeFormatStore";
import SavedLocationPicker from "../../components/SavedLocationPicker";
import HourlyStrip from "../../components/HourlyStrip";
import FormRow from "../../components/FormRow";
import useTheme from "../../theme/useTheme";
import type { CarryPreference, SavedLocation, SavedRoute, TravelMode } from "../../types";

// Journey planner — docs/04-screens-navigation.md §4.3/§4.3.1, wired to the
// real Google Routes + Open-Meteo pipeline (docs/08-build-phases.md Phase 4,
// src/lib/planJourney.ts).
const MODES: TravelMode[] = ["walk", "drive", "bus", "train", "cycle"];
const MODE_LABEL: Record<TravelMode, string> = {
  walk: "Walk",
  drive: "Drive",
  bus: "Bus",
  train: "Train",
  cycle: "Cycle",
  hike: "Hike",
};
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Same relabelling and reasoning as SettingsScreen.tsx's identical
// constant — the old chip showed the raw CarryPreference value name
// ("No preference"/"Avoid spares") with no label explaining what it even
// was, cycling silently on tap. This is the per-trip override of the
// Settings-level default (§7.9).
const CARRY_PREFERENCE_OPTIONS: { value: CarryPreference; label: string }[] = [
  { value: "no-preference", label: "Pack a spare" },
  { value: "avoid-spares", label: "Skip it" },
];

// A default return time needs *some* starting point before the user edits
// it — 8h after the outbound leave time approximates a typical workday,
// same as the placeholder value Phase 3 originally hardcoded (now
// user-editable rather than fixed).
const DEFAULT_RETURN_GAP_MS = 8 * 60 * 60_000;
// How far around the chosen return time to look for a nearby rain window —
// wide enough to catch "just missed it by 45 minutes," narrow enough that
// the suggestion still reads as "near your time," not "sometime today."
const RETURN_RAIN_LOOKAROUND_HOURS = 2;
// findRainWindowNear() only suggests a shift when the rain run has a dry
// reading immediately before and after it — a genuine isolated shower, not
// just the edge of a longer spell. Fetching this much extra padding beyond
// the lookaround window means a shower sitting right at that boundary
// still has a real reading past it to confirm dryness against, rather than
// silently failing the isolation check for lack of data.
const RETURN_RAIN_FETCH_PADDING_HOURS = 2;

type TimeMode = "leave-now" | "leave-by" | "arrive-by";
const TIME_MODE_LABEL: Record<TimeMode, string> = {
  "leave-now": "Leave now",
  "leave-by": "Leave by",
  "arrive-by": "Arrive by",
};
const TIME_MODES: TimeMode[] = ["leave-now", "leave-by", "arrive-by"];

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function nowDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nowTimeStr(): string {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function PlanScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [origin, setOrigin] = useState<SavedLocation | undefined>(undefined);
  const [destination, setDestination] = useState<SavedLocation | undefined>(undefined);
  const [waypoints, setWaypoints] = useState<SavedLocation[]>([]);
  const [timeMode, setTimeMode] = useState<TimeMode>("leave-now");
  const [dateStr, setDateStr] = useState(nowDateStr());
  const [timeStr, setTimeStr] = useState(nowTimeStr());
  const [mode, setMode] = useState<TravelMode>("walk");
  const [repeatsEnabled, setRepeatsEnabled] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [planReturnTrip, setPlanReturnTrip] = useState(false);
  const [returnDateStr, setReturnDateStr] = useState("");
  const [returnTimeStr, setReturnTimeStr] = useState("");
  const [returnRainWindow, setReturnRainWindow] = useState<{ startIso: string; endIso: string } | null>(null);
  const hour12 = useTimeFormatStore((s) => s.timeFormatPreference !== "24h");
  const [saveThisRoute, setSaveThisRoute] = useState(false);
  const [formal, setFormal] = useState(false);
  const [moreModesOpen, setMoreModesOpen] = useState(false);
  const [carryPreference, setCarryPreference] = useState<CarryPreference>("no-preference");
  const [planning, setPlanning] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listLocations().then((rows) => {
        setLocations(rows);
        // Origin defaults to Home (if set) whenever Plan is opened fresh —
        // docs/04-screens-navigation.md §4.3, "the most common case is
        // planning from home right now." The functional setState form
        // reads the *current* origin at update time rather than a
        // potentially-stale closure, so this stays correct without
        // needing `origin` in a dependency list — and only ever overrides
        // an unset origin, never one the user already picked.
        const home = rows.find((l) => l.label.trim().toLowerCase() === "home");
        if (home) setOrigin((prev) => prev ?? home);
      });
      listSavedRoutes().then(setSavedRoutes);
    }, [])
  );

  function applySavedRoute(route: SavedRoute) {
    const routeOrigin = locations.find((l) => l.id === route.originId);
    const routeDestination = locations.find((l) => l.id === route.destinationId);
    if (routeOrigin) setOrigin(routeOrigin);
    if (routeDestination) setDestination(routeDestination);
    if (route.preferredMode) setMode(route.preferredMode);
    touchSavedRoute(route.id);
  }

  function addStop() {
    if (locations.length === 0) {
      showAlert("No locations yet", "Add a location in the Locations tab first — then you can pick it here.");
      return;
    }
    setWaypoints((current) => [...current, locations[0]]);
  }

  function toggleDay(day: number) {
    setSelectedDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()));
  }

  async function handlePlanJourney() {
    if (!origin || !destination) {
      showAlert("Pick a start location and destination", "Both are needed before this can be planned.");
      return;
    }

    // "Leave now" is a mode in its own right, not a correction — no notice
    // needed. "Leave by" is checked client-side since we already know the
    // clock time; "arrive by" is resolved server-side (planJourney doesn't
    // know the answer until it's solved the route), so its own
    // `timeAdjusted` flag is checked once the plan comes back instead.
    let departTime = new Date(Date.now() + DEPART_TIME_LEAD_MS).toISOString();
    let arriveByTime: string | undefined;
    let timeWasAdjustedLocally = false;
    if (timeMode === "leave-by") {
      departTime = new Date(`${dateStr}T${timeStr}:00`).toISOString();
      if (new Date(departTime).getTime() <= Date.now() + DEPART_TIME_LEAD_MS) {
        departTime = new Date(Date.now() + DEPART_TIME_LEAD_MS).toISOString();
        timeWasAdjustedLocally = true;
      }
    } else if (timeMode === "arrive-by") {
      arriveByTime = new Date(`${dateStr}T${timeStr}:00`).toISOString();
    }

    const recurrence =
      timeMode === "leave-by" && repeatsEnabled && selectedDays.length > 0
        ? { daysOfWeek: selectedDays, departTimeOfDay: timeStr, active: true }
        : undefined;

    setPlanning(true);
    try {
      const result = await planJourney({
        origin,
        destination,
        waypoints,
        departTime,
        arriveByTime,
        mode,
        formal,
        carryPreference,
        recurrence,
      });

      if (result.kind === "failed") {
        // §5.1 — no live route and no cached fallback to reuse.
        showAlert("Can't plan a new route right now", "Check your connection, then try again.", [
          { text: "Retry", onPress: handlePlanJourney },
          { text: "Cancel", style: "cancel" },
        ]);
        return;
      }

      if (timeWasAdjustedLocally || result.timeAdjusted) {
        showAlert(
          "Leaving now instead",
          "Your requested time had already passed by the time this was planned, so we're planning from right now."
        );
      }

      if (planReturnTrip) {
        // A user-picked return date/time (defaulted to +8h when the toggle
        // was switched on, editable from there) replaces the old fixed
        // +8h-no-matter-what mock. Falls back to that same +8h if the
        // fields are somehow still empty (e.g. toggled on and off fast
        // enough that the seeding effect never ran).
        const parsedReturn = returnDateStr && returnTimeStr ? new Date(`${returnDateStr}T${returnTimeStr}:00`) : null;
        const returnDepart = (
          parsedReturn && !isNaN(parsedReturn.getTime())
            ? parsedReturn
            : new Date(new Date(result.journey.departTime).getTime() + DEFAULT_RETURN_GAP_MS)
        ).toISOString();
        const returnResult = await planJourney({
          origin: destination,
          destination: origin,
          waypoints: [...waypoints].reverse(),
          departTime: returnDepart,
          mode,
          formal,
          carryPreference,
        });
        if (returnResult.kind !== "failed") {
          await Promise.all([
            updateJourney({ ...result.journey, linkedReturnJourneyId: returnResult.journey.id }),
            updateJourney({ ...returnResult.journey, linkedReturnJourneyId: result.journey.id }),
          ]);
        }
      }

      if (saveThisRoute) {
        await createSavedRoute({ label: `${origin.label} → ${destination.label}`, originId: origin.id, destinationId: destination.id, preferredMode: mode });
      }

      navigation.navigate("JourneyDetail", {
        journeyId: result.journey.id,
        cachedFromDate: result.kind === "success-cached" ? result.cachedFromDate : undefined,
      });
    } finally {
      setPlanning(false);
    }
  }

  // §9.5 — feeds the hourly rain strip below the date/time fields; invalid
  // in-progress typing (mid-edit date/time text) simply omits the strip
  // rather than crashing on an "Invalid Date" .toISOString() call. "Leave
  // now" has no typed time to parse — anchor the strip on the actual
  // current time instead.
  let selectedDepartTimeIso: string | undefined;
  if (timeMode === "leave-now") {
    selectedDepartTimeIso = new Date().toISOString();
  } else {
    const selectedDepartTime = new Date(`${dateStr}T${timeStr}:00`);
    selectedDepartTimeIso = isNaN(selectedDepartTime.getTime()) ? undefined : selectedDepartTime.toISOString();
  }

  // Same "omit rather than crash on invalid in-progress typing" pattern as
  // selectedDepartTimeIso above.
  let returnDepartTimeIso: string | undefined;
  if (returnDateStr && returnTimeStr) {
    const returnDepartTime = new Date(`${returnDateStr}T${returnTimeStr}:00`);
    returnDepartTimeIso = isNaN(returnDepartTime.getTime()) ? undefined : returnDepartTime.toISOString();
  }

  function seedReturnTimeIfUnset(enabling: boolean) {
    setPlanReturnTrip(enabling);
    if (enabling && !returnDateStr && !returnTimeStr) {
      const base = new Date((selectedDepartTimeIso ? new Date(selectedDepartTimeIso).getTime() : Date.now()) + DEFAULT_RETURN_GAP_MS);
      setReturnDateStr(`${base.getFullYear()}-${pad2(base.getMonth() + 1)}-${pad2(base.getDate())}`);
      setReturnTimeStr(`${pad2(base.getHours())}:${pad2(base.getMinutes())}`);
    }
  }

  // Scans a window centred on the chosen return time for a nearby rain
  // window (§7.14-adjacent, but purely informational — same non-blocking,
  // suggestion-only posture as the severe-weather advisory). Runs off the
  // *destination*'s coordinates, since that's where the return leg departs
  // from. Omits the suggestion entirely on a failed fetch, same "supplement,
  // not a blocker" degrade HourlyStrip already uses.
  useEffect(() => {
    if (!planReturnTrip || !destination || !returnDepartTimeIso) {
      Promise.resolve().then(() => setReturnRainWindow(null));
      return;
    }
    let cancelled = false;
    const lookAroundMs = (RETURN_RAIN_LOOKAROUND_HOURS + RETURN_RAIN_FETCH_PADDING_HOURS) * 3_600_000;
    const fetchFromIso = new Date(new Date(returnDepartTimeIso).getTime() - lookAroundMs).toISOString();
    const hoursToFetch = (RETURN_RAIN_LOOKAROUND_HOURS + RETURN_RAIN_FETCH_PADDING_HOURS) * 2 + 1;
    getHourlyForecast({ lat: destination.lat, lng: destination.lng }, fetchFromIso, hoursToFetch).then((result) => {
      if (cancelled) return;
      setReturnRainWindow("data" in result ? findRainWindowNear(result.data, returnDepartTimeIso!, RETURN_RAIN_LOOKAROUND_HOURS) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [planReturnTrip, destination, returnDepartTimeIso]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {savedRoutes.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {savedRoutes.map((route) => (
            <Pressable key={route.id} onPress={() => applySavedRoute(route)} style={styles.routeChip}>
              <Text style={styles.routeChipLabel}>{route.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <SavedLocationPicker label="Start Location" value={origin} onChange={setOrigin} placeholder="Choose a start location" />
      <SavedLocationPicker label="Destination" value={destination} onChange={setDestination} placeholder="Choose a destination" />

      {waypoints.map((stop, index) => (
        <View key={`${stop.id}-${index}`} style={styles.waypointRow}>
          <View style={styles.waypointPicker}>
            <SavedLocationPicker
              label={`Stop ${index + 1}`}
              value={stop}
              onChange={(location) =>
                setWaypoints((current) => current.map((w, i) => (i === index ? location : w)))
              }
              placeholder="Choose a stop"
            />
          </View>
          <Pressable
            onPress={() => setWaypoints((current) => current.filter((_, i) => i !== index))}
            hitSlop={8}
            style={styles.removeStop}
          >
            <Text style={styles.removeStopLabel}>×</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={addStop}>
        <Text style={styles.addStopLabel}>+ Add a stop</Text>
      </Pressable>

      <Text style={styles.label}>When</Text>
      <View style={styles.row}>
        {TIME_MODES.map((tm) => (
          <Pressable key={tm} onPress={() => setTimeMode(tm)} style={[styles.modeChip, timeMode === tm && styles.modeChipActive]}>
            <Text style={[styles.modeChipLabel, timeMode === tm && styles.modeChipLabelActive]}>{TIME_MODE_LABEL[tm]}</Text>
          </Pressable>
        ))}
      </View>
      {timeMode !== "leave-now" && (
        <View style={styles.row}>
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholderTextColor={theme.textSecondary}
            value={dateStr}
            onChangeText={setDateStr}
            placeholder="YYYY-MM-DD"
          />
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholderTextColor={theme.textSecondary}
            value={timeStr}
            onChangeText={setTimeStr}
            placeholder="HH:mm"
          />
        </View>
      )}
      {origin && selectedDepartTimeIso && (
        <HourlyStrip origin={{ lat: origin.lat, lng: origin.lng }} fromIso={selectedDepartTimeIso} />
      )}

      <Text style={styles.label}>Mode</Text>
      <View style={styles.row}>
        {MODES.map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} style={[styles.modeChip, mode === m && styles.modeChipActive]}>
            <Text style={[styles.modeChipLabel, mode === m && styles.modeChipLabelActive]}>{MODE_LABEL[m]}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => setMoreModesOpen((v) => !v)} accessibilityRole="button" accessibilityLabel="More modes">
        <Text style={styles.moreModesLabel}>{moreModesOpen ? "▾" : "▸"} More modes</Text>
      </Pressable>
      {moreModesOpen && (
        <Text style={styles.moreModesNote}>
          Hike mode isn&apos;t available yet — walking, driving, bus, train, and cycling are ready to plan.
        </Text>
      )}

      <FormRow label="Formal occasion" style={styles.formRowSpaced}>
        <Switch value={formal} onValueChange={setFormal} />
      </FormRow>

      <Text style={styles.label}>Spare layer</Text>
      <Text style={styles.hint}>Whether to suggest packing a removable layer for this trip.</Text>
      <View style={styles.segmentRow}>
        {CARRY_PREFERENCE_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setCarryPreference(option.value)}
            style={[styles.segment, carryPreference === option.value && styles.segmentActive]}
          >
            <Text style={[styles.segmentLabel, carryPreference === option.value && styles.segmentLabelActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      {timeMode === "leave-by" && (
        <FormRow label="Repeats" style={styles.formRowSpaced}>
          <Switch value={repeatsEnabled} onValueChange={setRepeatsEnabled} />
        </FormRow>
      )}
      {timeMode === "leave-by" && repeatsEnabled && (
        <View style={styles.row}>
          {DAY_LABELS.map((dayLabel, day) => (
            <Pressable
              key={day}
              onPress={() => toggleDay(day)}
              style={[styles.dayChip, selectedDays.includes(day) && styles.dayChipActive]}
            >
              <Text style={[styles.dayChipLabel, selectedDays.includes(day) && styles.dayChipLabelActive]}>{dayLabel}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* One card holds both the toggle and (when on) the time picker below
          it, rather than a switch with a separately-styled block floating
          underneath — the shared card boundary is what reads as "this
          content belongs to this toggle," the same way the Settings
          screen's Advanced disclosure keeps its body inside its own
          section. */}
      <View style={styles.returnCard}>
        <FormRow label="Plan return trip too">
          <Switch value={planReturnTrip} onValueChange={seedReturnTimeIfUnset} />
        </FormRow>
        {planReturnTrip && (
          <View style={styles.returnCardBody}>
            <View style={styles.returnCardDivider} />
            <Text style={styles.label}>Return time</Text>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex1]}
                placeholderTextColor={theme.textSecondary}
                value={returnDateStr}
                onChangeText={setReturnDateStr}
                placeholder="YYYY-MM-DD"
              />
              <TextInput
                style={[styles.input, styles.flex1]}
                placeholderTextColor={theme.textSecondary}
                value={returnTimeStr}
                onChangeText={setReturnTimeStr}
                placeholder="HH:mm"
              />
            </View>
            {destination && returnDepartTimeIso && (
              <HourlyStrip origin={{ lat: destination.lat, lng: destination.lng }} fromIso={returnDepartTimeIso} />
            )}
            {returnRainWindow && (
              <View style={styles.rainSuggestion}>
                <Text style={styles.rainSuggestionText}>
                  Rain expected {formatTime(returnRainWindow.startIso, hour12)}–{formatTime(returnRainWindow.endIso, hour12)} near your
                  return time — consider leaving before {formatTime(returnRainWindow.startIso, hour12)} or after{" "}
                  {formatTime(returnRainWindow.endIso, hour12)} to dodge the shower.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
      <FormRow label="Save this route" style={styles.formRowSpaced}>
        <Switch value={saveThisRoute} onValueChange={setSaveThisRoute} />
      </FormRow>

      <Pressable onPress={handlePlanJourney} disabled={planning} style={[styles.planButton, planning && styles.planButtonDisabled]}>
        {planning ? <ActivityIndicator color={theme.bg} /> : <Text style={styles.planButtonLabel}>Plan journey</Text>}
      </Pressable>
    </ScrollView>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { padding: 20, gap: 4, backgroundColor: theme.bg },
    chipRow: { marginBottom: 8 },
    routeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.surface, marginRight: 8 },
    routeChipLabel: { fontSize: 13, fontWeight: "600", color: theme.textPrimary },
    waypointRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    waypointPicker: { flex: 1 },
    removeStop: { width: 32, height: 44, alignItems: "center", justifyContent: "center" },
    removeStopLabel: { fontSize: 18, color: theme.textSecondary },
    addStopLabel: { color: theme.textSecondary, fontSize: 13, marginTop: 8, marginBottom: 8 },
    label: { fontSize: 13, color: theme.textSecondary, marginTop: 16, marginBottom: 4 },
    row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    flex1: { flex: 1 },
    input: { borderWidth: 1, borderColor: theme.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.textPrimary },
    modeChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.border },
    modeChipActive: { backgroundColor: theme.accentWalk, borderColor: theme.accentWalk },
    modeChipLabel: { fontSize: 13, color: theme.textPrimary },
    modeChipLabelActive: { color: "#FFFFFF", fontWeight: "600" },
    moreModesLabel: { color: theme.textSecondary, fontSize: 12, marginTop: 8 },
    moreModesNote: { color: theme.textSecondary, fontSize: 12, marginTop: 4 },
    formRowSpaced: { marginTop: 16 },
    returnCard: {
      marginTop: 16,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.surface,
    },
    returnCardBody: { marginTop: 4 },
    returnCardDivider: { height: 1, backgroundColor: theme.border, marginTop: 12, marginBottom: 4 },
    rainSuggestion: {
      flexDirection: "row",
      marginTop: 8,
      padding: 10,
      borderRadius: 8,
      backgroundColor: theme.conditionRain,
    },
    rainSuggestionText: { flex: 1, fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
    hint: { fontSize: 12, color: theme.textSecondary, marginBottom: 8 },
    segmentRow: { flexDirection: "row", gap: 8 },
    segment: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.border, alignItems: "center" },
    segmentActive: { backgroundColor: theme.accentWalk, borderColor: theme.accentWalk },
    segmentLabel: { fontSize: 13, color: theme.textPrimary },
    segmentLabelActive: { color: "#FFFFFF", fontWeight: "600" },
    dayChip: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.border },
    dayChipActive: { backgroundColor: theme.accentWalk, borderColor: theme.accentWalk },
    dayChipLabel: { fontSize: 11, color: theme.textPrimary },
    dayChipLabelActive: { color: "#FFFFFF", fontWeight: "600" },
    planButton: { marginTop: 24, marginBottom: 40, paddingVertical: 14, alignItems: "center", borderRadius: 8, backgroundColor: theme.accentWalk },
    planButtonDisabled: { opacity: 0.6 },
    planButtonLabel: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
  });
}

import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { listLocations } from "../../db/repositories/locations";
import { createSavedRoute, listSavedRoutes, touchSavedRoute } from "../../db/repositories/savedRoutes";
import { updateJourney } from "../../db/repositories/journeys";
import { planJourney, DEPART_TIME_LEAD_MS } from "../../lib/planJourney";
import { showAlert } from "../../lib/crossPlatformAlert";
import SavedLocationPicker from "../../components/SavedLocationPicker";
import HourlyStrip from "../../components/HourlyStrip";
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
  const [saveThisRoute, setSaveThisRoute] = useState(false);
  const [formal, setFormal] = useState(false);
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
        const returnDepart = new Date(new Date(result.journey.departTime).getTime() + 8 * 60 * 60_000).toISOString(); // mock: +8h, same as Phase 3
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
          <TextInput style={[styles.input, styles.flex1]} value={dateStr} onChangeText={setDateStr} placeholder="YYYY-MM-DD" />
          <TextInput style={[styles.input, styles.flex1]} value={timeStr} onChangeText={setTimeStr} placeholder="HH:mm" />
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
      <Pressable
        onPress={() =>
          showAlert("More modes", "Hike mode isn't available yet — walking, driving, bus, train, and cycling are ready to plan.")
        }
      >
        <Text style={styles.moreModesLabel}>More modes</Text>
      </Pressable>

      <View style={styles.switchRow}>
        <Text style={styles.label}>Formal occasion</Text>
        <Switch value={formal} onValueChange={setFormal} />
      </View>

      <Pressable
        onPress={() => setCarryPreference((p) => (p === "no-preference" ? "avoid-spares" : "no-preference"))}
        style={styles.carryChip}
      >
        <Text style={styles.carryChipLabel}>{carryPreference === "no-preference" ? "No preference" : "Avoid spares"}</Text>
      </Pressable>

      {timeMode === "leave-by" && (
        <View style={styles.switchRow}>
          <Text style={styles.label}>Repeats</Text>
          <Switch value={repeatsEnabled} onValueChange={setRepeatsEnabled} />
        </View>
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

      <View style={styles.switchRow}>
        <Text style={styles.label}>Plan return trip too</Text>
        <Switch value={planReturnTrip} onValueChange={setPlanReturnTrip} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.label}>Save this route</Text>
        <Switch value={saveThisRoute} onValueChange={setSaveThisRoute} />
      </View>

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
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, minHeight: 44 },
    carryChip: { alignSelf: "flex-start", marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.border },
    carryChipLabel: { fontSize: 13, color: theme.textPrimary },
    dayChip: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.border },
    dayChipActive: { backgroundColor: theme.accentWalk, borderColor: theme.accentWalk },
    dayChipLabel: { fontSize: 11, color: theme.textPrimary },
    dayChipLabelActive: { color: "#FFFFFF", fontWeight: "600" },
    planButton: { marginTop: 24, marginBottom: 40, paddingVertical: 14, alignItems: "center", borderRadius: 8, backgroundColor: theme.accentWalk },
    planButtonDisabled: { opacity: 0.6 },
    planButtonLabel: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
  });
}

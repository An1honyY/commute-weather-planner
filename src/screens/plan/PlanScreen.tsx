import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { listLocations } from "../../db/repositories/locations";
import { createSavedRoute, listSavedRoutes, touchSavedRoute } from "../../db/repositories/savedRoutes";
import { buildMockJourney } from "../../lib/mockJourney";
import { useJourneyStore } from "../../store/journeyStore";
import SavedLocationPicker from "../../components/SavedLocationPicker";
import type { CarryPreference, SavedLocation, SavedRoute, TravelMode } from "../../types";

// Journey planner — docs/04-screens-navigation.md §4.3/§4.3.1. Wired to a
// mocked Journey object per docs/08-build-phases.md Phase 3 (no live
// Google Routes/Open-Meteo yet — that's Phase 4).
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const addJourney = useJourneyStore((state) => state.addJourney);

  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [origin, setOrigin] = useState<SavedLocation | undefined>(undefined);
  const [destination, setDestination] = useState<SavedLocation | undefined>(undefined);
  const [waypoints, setWaypoints] = useState<SavedLocation[]>([]);
  const [dateStr, setDateStr] = useState(nowDateStr());
  const [timeStr, setTimeStr] = useState(nowTimeStr());
  const [mode, setMode] = useState<TravelMode>("walk");
  const [repeatsEnabled, setRepeatsEnabled] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [planReturnTrip, setPlanReturnTrip] = useState(false);
  const [saveThisRoute, setSaveThisRoute] = useState(false);
  const [formal, setFormal] = useState(false);
  const [carryPreference, setCarryPreference] = useState<CarryPreference>("no-preference");

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
      Alert.alert("No locations yet", "Add some in the Locations tab first.");
      return;
    }
    setWaypoints((current) => [...current, locations[0]]);
  }

  function toggleDay(day: number) {
    setSelectedDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()));
  }

  async function planJourney() {
    if (!origin || !destination) {
      Alert.alert("Pick an origin and destination", "Both are needed to plan a journey.");
      return;
    }
    const departTime = new Date(`${dateStr}T${timeStr}:00`).toISOString();

    const recurrence =
      repeatsEnabled && selectedDays.length > 0
        ? { daysOfWeek: selectedDays, departTimeOfDay: timeStr, active: true }
        : undefined;

    const journey = buildMockJourney({
      origin,
      destination,
      waypoints,
      departTime,
      mode,
      formal,
      carryPreference,
      recurrence,
    });
    addJourney(journey);

    if (planReturnTrip) {
      const returnDepart = new Date(new Date(departTime).getTime() + 8 * 60 * 60_000).toISOString(); // mock: +8h
      const returnJourney = buildMockJourney({
        origin: destination,
        destination: origin,
        waypoints: [...waypoints].reverse(),
        departTime: returnDepart,
        mode,
        formal,
        carryPreference,
      });
      journey.linkedReturnJourneyId = returnJourney.id;
      returnJourney.linkedReturnJourneyId = journey.id;
      addJourney(journey); // re-add with linkedReturnJourneyId now set
      addJourney(returnJourney);
    }

    if (saveThisRoute) {
      await createSavedRoute({ label: `${origin.label} → ${destination.label}`, originId: origin.id, destinationId: destination.id, preferredMode: mode });
    }

    navigation.navigate("JourneyDetail", { journeyId: journey.id });
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

      <SavedLocationPicker label="Origin" value={origin} onChange={setOrigin} placeholder="Choose an origin" />
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
        <TextInput style={[styles.input, styles.flex1]} value={dateStr} onChangeText={setDateStr} placeholder="YYYY-MM-DD" />
        <TextInput style={[styles.input, styles.flex1]} value={timeStr} onChangeText={setTimeStr} placeholder="HH:mm" />
      </View>

      <Text style={styles.label}>Mode</Text>
      <View style={styles.row}>
        {MODES.map((m) => (
          <Pressable key={m} onPress={() => setMode(m)} style={[styles.modeChip, mode === m && styles.modeChipActive]}>
            <Text style={[styles.modeChipLabel, mode === m && styles.modeChipLabelActive]}>{MODE_LABEL[m]}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => Alert.alert("More modes", "Hike mode is coming in a later update.")}>
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

      <View style={styles.switchRow}>
        <Text style={styles.label}>Repeats</Text>
        <Switch value={repeatsEnabled} onValueChange={setRepeatsEnabled} />
      </View>
      {repeatsEnabled && (
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

      <Pressable onPress={planJourney} style={styles.planButton}>
        <Text style={styles.planButtonLabel}>Plan journey</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 4 },
  chipRow: { marginBottom: 8 },
  routeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: "#F6F7FA", marginRight: 8 },
  routeChipLabel: { fontSize: 13, fontWeight: "600" },
  waypointRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  waypointPicker: { flex: 1 },
  removeStop: { width: 32, height: 44, alignItems: "center", justifyContent: "center" },
  removeStopLabel: { fontSize: 18, color: "#5C6478" },
  addStopLabel: { color: "#5C6478", fontSize: 13, marginTop: 8, marginBottom: 8 },
  label: { fontSize: 13, color: "#5C6478", marginTop: 16, marginBottom: 4 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  flex1: { flex: 1 },
  input: { borderWidth: 1, borderColor: "#DDE1EA", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  modeChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#DDE1EA" },
  modeChipActive: { backgroundColor: "#1A1E29", borderColor: "#1A1E29" },
  modeChipLabel: { fontSize: 13 },
  modeChipLabelActive: { color: "#FFFFFF", fontWeight: "600" },
  moreModesLabel: { color: "#5C6478", fontSize: 12, marginTop: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, minHeight: 44 },
  carryChip: { alignSelf: "flex-start", marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#DDE1EA" },
  carryChipLabel: { fontSize: 13 },
  dayChip: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#DDE1EA" },
  dayChipActive: { backgroundColor: "#1A1E29", borderColor: "#1A1E29" },
  dayChipLabel: { fontSize: 11 },
  dayChipLabelActive: { color: "#FFFFFF", fontWeight: "600" },
  planButton: { marginTop: 24, marginBottom: 40, paddingVertical: 14, alignItems: "center", borderRadius: 8, backgroundColor: "#1A1E29" },
  planButtonLabel: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
});

import { useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { getHourlyForecast, type HourlyReading } from "../services/weatherService";
import RainGauge from "./RainGauge";

// docs/09-design-system.md §9.5 — "used in the hourly strip on Plan/Today."
// Placement decision logged in DECISIONS.md: Plan screen only, under the
// "When" section, since the whole point of showing hourly rain is to help
// pick a departure time — Today's "Right now" card stays a single-point
// snapshot per its own §9.3.1 spec ("no map, no leg list... just current
// conditions"), which an hourly row would be inconsistent with.
const HOURS_SHOWN = 12;

interface Props {
  origin?: { lat: number; lng: number };
  fromIso: string; // the Plan screen's currently-selected departure time
}

function formatHourLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric" }).replace(" ", "").toLowerCase();
}

export default function HourlyStrip({ origin, fromIso }: Props) {
  const [readings, setReadings] = useState<HourlyReading[]>([]);
  const lat = origin?.lat;
  const lng = origin?.lng;

  // "Adjusting state when a prop changes" (render-time, not an effect) —
  // clearing readings when origin is unset (or swapped) is a pure local
  // reset, not a fetch; only the actual network fetch below belongs in an
  // effect. Keyed on the primitives, not the origin object itself, since
  // callers pass a fresh object literal every render.
  const originKey = lat !== undefined && lng !== undefined ? `${lat},${lng}` : undefined;
  const [consumedOriginKey, setConsumedOriginKey] = useState(originKey);
  if (originKey !== consumedOriginKey) {
    setConsumedOriginKey(originKey);
    if (!originKey) setReadings([]);
  }

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    let cancelled = false;
    getHourlyForecast({ lat, lng }, fromIso, HOURS_SHOWN).then((result) => {
      if (!cancelled && "data" in result) setReadings(result.data);
      // §5.1-style degrade — a failed hourly fetch just means no strip
      // renders (see the omit-entirely branch below), not an error banner;
      // it's a supplementary convenience, not something Plan blocks on.
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lng, fromIso]);

  if (readings.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.rowContent}>
      {readings.map((reading) => (
        <RainGauge key={reading.time} hour={formatHourLabel(reading.time)} rainIntensity={reading.rainIntensity} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 8, marginBottom: 4 },
  rowContent: { gap: 12, paddingRight: 16 },
});

import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { getHourlyForecast, type HourlyReading } from "../services/weatherService";
import { classifyWeather } from "../lib/weather";
import { useTimeFormatStore } from "../lib/useTimeFormatStore";
import useTheme from "../theme/useTheme";
import { cardElevationStyle } from "../theme/tokens";
import { RADIUS, SPACING } from "../theme/typography";
import RainGauge from "./RainGauge";
import WeatherIcon, { weatherIconKindFor } from "./WeatherIcon";

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

function formatHourLabel(iso: string, hour12: boolean): string {
  return new Date(iso)
    .toLocaleTimeString(undefined, { hour: "numeric", minute: undefined, hour12 })
    .replace(" ", "")
    .toLowerCase();
}

// A compact key explaining the strip's two signals — the droplet fill
// level (rain intensity) and the small condition icon above it — since
// neither is self-explanatory the first time someone sees this strip.
// Deliberately rendered outside the outlook card (below it, own "Key"
// heading) rather than inside — it's reference material for reading the
// card above, not more of the card's own content, and blending the two
// together made it easy to mistake one for the other.
function Legend() {
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={styles.legend}>
      <Text style={styles.legendHeading}>Key</Text>
      <View style={styles.legendRow}>
        <Text style={styles.legendLabel}>Rain:</Text>
        {(["none", "low", "med", "high"] as const).map((bucket) => (
          <View key={bucket} style={styles.legendItem}>
            <RainGauge hour="" rainIntensity={bucket} />
            <Text style={styles.legendItemLabel}>
              {bucket === "none" ? "Dry" : bucket === "low" ? "Light" : bucket === "med" ? "Moderate" : "Heavy"}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.legendRow}>
        <Text style={styles.legendLabel}>Sky:</Text>
        {(
          [
            { kind: "sun", label: "Sunny" },
            { kind: "cloud", label: "Cloudy" },
            { kind: "wind", label: "Windy" },
            { kind: "storm", label: "Storm" },
          ] as const
        ).map(({ kind, label }) => (
          <View key={kind} style={styles.legendItem}>
            <WeatherIcon kind={kind} size={16} color={theme.textSecondary} />
            <Text style={styles.legendItemLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function HourlyStrip({ origin, fromIso }: Props) {
  const [readings, setReadings] = useState<HourlyReading[]>([]);
  const theme = useTheme();
  const styles = getStyles(theme);
  const hour12 = useTimeFormatStore((s) => s.timeFormatPreference !== "24h");
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
    <View>
      <View style={styles.card}>
        <Text style={styles.title}>Hourly outlook</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowContent}>
          {readings.map((reading) => {
            const condition = classifyWeather(reading.weatherCode, reading.precipMm, reading.windKph);
            return (
              <RainGauge
                key={reading.time}
                hour={formatHourLabel(reading.time, hour12)}
                rainIntensity={reading.rainIntensity}
                tempC={reading.tempC}
                conditionKind={weatherIconKindFor(condition)}
                conditionLabel={condition.label}
              />
            );
          })}
        </ScrollView>
      </View>
      <Legend />
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      marginTop: SPACING.md,
      padding: SPACING.md,
      borderRadius: RADIUS.card,
      backgroundColor: theme.surfaceRaised,
      ...cardElevationStyle(theme),
    },
    title: { fontSize: 13, fontWeight: "600", color: theme.textPrimary, marginBottom: SPACING.sm },
    rowContent: { gap: 12, paddingRight: 4 },
    legend: { marginTop: SPACING.md, gap: 6 },
    legendHeading: { fontSize: 11, fontWeight: "700", color: theme.textSecondary, textTransform: "uppercase", marginBottom: 2 },
    legendRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
    legendLabel: { fontSize: 11, fontWeight: "600", color: theme.textSecondary, width: 34 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    legendItemLabel: { fontSize: 11, color: theme.textSecondary },
  });
}

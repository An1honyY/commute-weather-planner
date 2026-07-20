import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useRightNow } from "../../lib/useRightNow";
import { classifyWeather } from "../../lib/weather";

// "Right now" card — docs/09-design-system.md §9.3.1, docs/04-screens-
// navigation.md §4.2. A smaller self-contained version of the gear
// recommendation card: current conditions + the reduced recommendation,
// no map, no leg list, no journey label.
function pickLabel(pick: { name: string } | { fallbackText: string }): { text: string; isFallback: boolean } {
  return "name" in pick ? { text: pick.name, isFallback: false } : { text: pick.fallbackText, isFallback: true };
}

export default function RightNowCard() {
  const { loading, weather, recommendation, isFallbackLocation } = useRightNow();

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!weather || !recommendation) {
    return (
      <View style={styles.card}>
        <Text style={styles.fallback}>Couldn&apos;t fetch current conditions right now.</Text>
      </View>
    );
  }

  const condition = classifyWeather(weather.weatherCode, weather.precipMm, weather.windKph);
  const asOf = new Date(weather.time).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const picks: ({ name: string } | { fallbackText: string })[] = [...recommendation.layers, ...recommendation.accessories];
  if (recommendation.shoes) picks.push(recommendation.shoes);
  if (recommendation.umbrella) picks.push(recommendation.umbrella);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Right now</Text>
      {isFallbackLocation && <Text style={styles.fallbackLocationLabel}>Example — Auckland</Text>}
      <View style={styles.conditionRow}>
        <Text style={styles.conditionIcon}>{condition.icon}</Text>
        <Text style={styles.temp}>{Math.round(weather.apparentTempC)}°C</Text>
        <Text style={styles.conditionLabel}>{condition.label}</Text>
        {weather.uvIndex >= 6 && (
          <View style={styles.uvBadge}>
            <Text style={styles.uvBadgeText}>UV {Math.round(weather.uvIndex)}</Text>
          </View>
        )}
      </View>

      {picks.length > 0 && (
        <View style={styles.picksRow}>
          {picks.map((pick, i) => {
            const { text, isFallback } = pickLabel(pick);
            return (
              <Text key={i} style={isFallback ? styles.fallback : styles.pickText}>
                {text}
              </Text>
            );
          })}
        </View>
      )}

      <Text style={styles.asOf}>as of {asOf}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDE1EA", gap: 8, marginBottom: 16 },
  title: { fontSize: 15, fontWeight: "600" },
  fallbackLocationLabel: { fontSize: 12, color: "#5C6478" },
  conditionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  conditionIcon: { fontSize: 20 },
  temp: { fontSize: 24, fontWeight: "700" },
  conditionLabel: { fontSize: 14, color: "#5C6478" },
  uvBadge: { marginLeft: "auto", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#C97327" },
  uvBadgeText: { fontSize: 11, color: "#FFFFFF", fontWeight: "600" },
  picksRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  pickText: { fontSize: 13, fontWeight: "600" },
  fallback: { fontSize: 13, fontStyle: "italic", color: "#5C6478" },
  asOf: { fontSize: 11, color: "#9AA3B8" },
});

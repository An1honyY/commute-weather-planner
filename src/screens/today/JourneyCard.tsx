import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRecommendation } from "../../lib/useRecommendation";
import { classifyWeather } from "../../lib/weather";
import type { Journey } from "../../types";

// Today-tab compact journey card — docs/09-design-system.md §9.4.
const SEVERITY_COLOR = ["#7B8499", "#B8860B", "#2E7CC4", "#2953A8", "#8C3AB0"];

interface Props {
  journey: Journey;
  isNextUp: boolean;
  onPress: () => void;
  onLeavingNow: () => void;
}

export default function JourneyCard({ journey, isNextUp, onPress, onLeavingNow }: Props) {
  const recommendation = useRecommendation(journey);
  const topLayer = recommendation?.layers[recommendation.layers.length - 1];
  const topLabel = topLayer ? ("id" in topLayer ? topLayer.name : topLayer.fallbackText) : "No extra layers needed";

  const outdoorLegs = journey.legs.filter((l) => l.outdoor && l.weather);
  const departTime = new Date(journey.departTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.route}>
          {journey.origin.label} → {journey.destination.label}
          {journey.recurrence && " ↻"}
          {journey.linkedReturnJourneyId && " ⇄"}
        </Text>
        <Text style={styles.time}>{departTime}</Text>
      </View>

      {outdoorLegs.length > 0 && (
        <View style={styles.dotsRow}>
          {outdoorLegs.map((leg) => {
            const severity = classifyWeather(leg.weather!.weatherCode, leg.weather!.precipMm, leg.weather!.windKph).severity;
            return <View key={leg.id} style={[styles.dot, { backgroundColor: SEVERITY_COLOR[severity] }]} />;
          })}
        </View>
      )}

      <Text style={styles.topRecommendation}>{topLabel}</Text>

      {isNextUp && (
        <Pressable onPress={onLeavingNow} style={styles.leavingNowButton}>
          <Text style={styles.leavingNowLabel}>Leaving now</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, borderRadius: 12, backgroundColor: "#F6F7FA", marginBottom: 12, gap: 6 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  route: { fontSize: 15, fontWeight: "600" },
  time: { fontSize: 12, color: "#5C6478" },
  dotsRow: { flexDirection: "row", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  topRecommendation: { fontSize: 13, color: "#1A1E29" },
  leavingNowButton: { marginTop: 4, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#1A1E29" },
  leavingNowLabel: { color: "#FFFFFF", fontWeight: "600", fontSize: 12 },
});

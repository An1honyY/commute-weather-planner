import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRecommendation } from "../../lib/useRecommendation";
import { classifyWeather } from "../../lib/weather";
import useTheme from "../../theme/useTheme";
import { conditionColorForSeverity } from "../../theme/tokens";
import type { Journey } from "../../types";

// Today-tab compact journey card — docs/09-design-system.md §9.4.

interface Props {
  journey: Journey;
  isNextUp: boolean;
  onPress: () => void;
  onLeavingNow: () => void;
}

export default function JourneyCard({ journey, isNextUp, onPress, onLeavingNow }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const recommendation = useRecommendation(journey);
  const topLayer = recommendation?.layers[recommendation.layers.length - 1];
  const topLabel = topLayer ? ("id" in topLayer ? topLayer.name : topLayer.fallbackText) : "No extra layers needed";

  const outdoorLegs = journey.legs.filter((l) => l.outdoor && l.weather);
  const departTime = new Date(journey.departTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  // §9.6 — the condition dots below are color-only (per §9.4's own spec for
  // this compact card), so the card's accessibilityLabel carries the same
  // information in words rather than relying on the dots for a screen-reader
  // user; the full per-leg icon+text detail is one tap away on Journey Detail.
  const accessibilityLabel = [
    `${journey.origin.label} to ${journey.destination.label}`,
    `departs ${departTime}`,
    journey.recurrence ? "repeats" : undefined,
    journey.linkedReturnJourneyId ? "has a return trip" : undefined,
    topLabel,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable onPress={onPress} style={styles.card} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
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
            return <View key={leg.id} style={[styles.dot, { backgroundColor: conditionColorForSeverity(theme, severity) }]} />;
          })}
        </View>
      )}

      <Text style={styles.topRecommendation}>{topLabel}</Text>

      {isNextUp && (
        <Pressable
          onPress={onLeavingNow}
          style={styles.leavingNowButton}
          accessibilityRole="button"
          accessibilityLabel="Leaving now — show the reduced gear check"
        >
          <Text style={styles.leavingNowLabel}>Leaving now</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: { padding: 12, borderRadius: 12, backgroundColor: theme.surface, marginBottom: 12, gap: 6 },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    route: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    time: { fontSize: 12, color: theme.textSecondary },
    dotsRow: { flexDirection: "row", gap: 4 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    topRecommendation: { fontSize: 13, color: theme.textPrimary },
    leavingNowButton: { marginTop: 4, alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.textPrimary },
    leavingNowLabel: { color: theme.bg, fontWeight: "600", fontSize: 12 },
  });
}

import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRecommendation } from "../../lib/useRecommendation";
import { classifyWeather } from "../../lib/weather";
import useTheme from "../../theme/useTheme";
import { cardElevationStyle, type ThemeTokens } from "../../theme/tokens";
import type { Journey } from "../../types";

// Today-tab compact journey card — docs/09-design-system.md §9.4.

interface Props {
  journey: Journey;
  isNextUp: boolean;
  onPress: () => void;
  onLeavingNow: () => void;
  // §9.1 (2026-07-21) — TodayScreen passes down the same weather-reactive
  // tokens RightNowCard is using, so the whole screen shares one mood
  // rather than each card resolving its own; falls back to the plain base
  // theme for any other caller that renders this card standalone.
  theme?: ThemeTokens;
}

export default function JourneyCard({ journey, isNextUp, onPress, onLeavingNow, theme: themeProp }: Props) {
  const baseTheme = useTheme();
  const theme = themeProp ?? baseTheme;
  const styles = getStyles(theme);
  const recommendation = useRecommendation(journey);
  const topLayer = recommendation?.layers[recommendation.layers.length - 1];
  const topLabel = topLayer ? ("id" in topLayer ? topLayer.name : topLayer.fallbackText) : "Nothing extra needed — you're set";

  const departTime = new Date(journey.departTime).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  // §9.1 (2026-07-21) — per-leg chips (icon + temperature, or an "AC" pill
  // for indoor legs) replace the old color-only dot strip, in the leg
  // order they actually occur so the sequence reads as a mini timeline of
  // the trip, not just an unordered condition summary.
  const stages = journey.legs
    .filter((l) => (l.outdoor && l.weather) || (!l.outdoor && l.climate))
    .map((leg) =>
      leg.outdoor && leg.weather
        ? { key: leg.id, indoor: false as const, icon: classifyWeather(leg.weather.weatherCode, leg.weather.precipMm, leg.weather.windKph).icon, tempC: Math.round(leg.weather.apparentTempC) }
        : { key: leg.id, indoor: true as const }
    );

  // §9.6 — the per-leg chips below are still color-plus-icon-plus-number,
  // not color alone, but the full detail is also carried in words here so
  // a screen-reader user gets the same "what changes leg to leg" summary a
  // sighted user gets by scanning the chip row, without needing to open
  // Journey Detail first.
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

      {stages.length > 0 && (
        <View style={styles.stagesRow}>
          {stages.map((stage, i) => (
            <View key={stage.key} style={styles.stageWrap}>
              {i > 0 && <Text style={styles.stageSep}>→</Text>}
              <View style={styles.stage}>
                {stage.indoor ? (
                  <Text style={styles.stageText}>AC</Text>
                ) : (
                  <>
                    <Text style={styles.stageIcon}>{stage.icon}</Text>
                    <Text style={styles.stageText}>{stage.tempC}°</Text>
                  </>
                )}
              </View>
            </View>
          ))}
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

function getStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    card: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.surface,
      marginBottom: 12,
      gap: 6,
      ...cardElevationStyle(theme),
    },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    route: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    time: { fontSize: 12, fontWeight: "700", color: theme.accentWalk },
    stagesRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
    stageWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
    stageSep: { fontSize: 11, color: theme.textSecondary, opacity: 0.5 },
    stage: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: theme.bg, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
    stageIcon: { fontSize: 11 },
    stageText: { fontSize: 11, fontWeight: "700", color: theme.textSecondary },
    topRecommendation: { fontSize: 13, color: theme.textPrimary },
    leavingNowButton: { marginTop: 4, alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.textPrimary },
    leavingNowLabel: { color: theme.bg, fontWeight: "600", fontSize: 12 },
  });
}

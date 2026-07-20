import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { getJourney, updateJourney } from "../../db/repositories/journeys";
import JourneyMap from "../../components/JourneyMap";
import GearRecommendationCard from "./GearRecommendationCard";
import LegRow from "./LegRow";
import type { GearFeedback, Journey } from "../../types";

// Core screen — docs/09-design-system.md §9.3, reading a real persisted
// Journey (docs/08-build-phases.md Phase 4, src/db/repositories/journeys.ts)
// built by src/lib/planJourney.ts. The severe-weather advisory banner still
// stays unrendered — that needs Recommendation.severeWeatherAdvisory from
// the recommendation engine, which is Phase 5.
type Props = NativeStackScreenProps<RootStackParamList, "JourneyDetail">;

const MODE_ACCENT: Record<string, string> = {
  walk: "#C97F2E",
  cycle: "#C97F2E",
  drive: "#5B63C9",
  bus: "#2C8F86",
  train: "#2C8F86",
};
// Transit/drive legs outrank the walk-to-stop connector legs
// planJourney.ts inserts around them when picking the map's overall accent.
const MODE_PRIORITY = ["bus", "train", "drive", "cycle", "walk"] as const;

const FEEDBACK_OPTIONS: { value: GearFeedback; label: string }[] = [
  { value: "much_too_cold", label: "Much too cold" },
  { value: "too_cold", label: "Too cold" },
  { value: "just_right", label: "Just right" },
  { value: "too_warm", label: "Too warm" },
  { value: "much_too_warm", label: "Much too warm" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function JourneyDetailScreen({ route, navigation }: Props) {
  const [journey, setJourney] = useState<Journey | undefined | null>(undefined); // undefined = loading, null = not found
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  // Date.now() is impure to call during render — a useState lazy
  // initializer (react-hooks/purity) only runs once at mount.
  const [nowMs] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      getJourney(route.params.journeyId).then((result) => setJourney(result ?? null));
    }, [route.params.journeyId])
  );

  if (journey === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (!journey) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.empty}>This journey is no longer available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stops = [
    { lat: journey.origin.lat, lng: journey.origin.lng },
    ...(journey.waypoints?.map((w) => ({ lat: w.lat, lng: w.lng })) ?? []),
    { lat: journey.destination.lat, lng: journey.destination.lng },
  ];
  // The journey's dominant mode, not just the first leg — a bus/train trip's
  // first leg is usually a short walk-to-stop connector, which shouldn't
  // paint the whole map walk-colored.
  const primaryMode = MODE_PRIORITY.find((mode) => journey.legs.some((l) => l.mode === mode)) ?? "walk";
  const accentColor = MODE_ACCENT[primaryMode] ?? "#1A1E29";

  const totalDurationMin = journey.legs.reduce((sum, leg) => sum + leg.durationMin, 0);
  const journeyEndMs = new Date(journey.departTime).getTime() + totalDurationMin * 60_000;
  const showFeedbackStrip = !feedbackGiven && !journey.feedback && journeyEndMs < nowMs;

  // §5.3 — only medium/low confidence gets a banner; high is the common
  // case and stays silent. Worst (lowest-confidence) outdoor leg wins,
  // same "one summary, not one per leg" pattern as the severe-weather
  // advisory will use once Phase 5 adds it.
  const confidenceRank = { high: 0, medium: 1, low: 2 } as const;
  const worstConfidence = journey.legs
    .filter((l) => l.outdoor && l.weather)
    .reduce<"high" | "medium" | "low">((worst, l) => {
      const legConfidence = l.weather!.forecastConfidence;
      return confidenceRank[legConfidence] > confidenceRank[worst] ? legConfidence : worst;
    }, "high");

  async function giveFeedback(feedback: GearFeedback) {
    const updated = { ...journey!, feedback };
    await updateJourney(updated);
    setJourney(updated);
    setFeedbackGiven(true);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.mapContainer}>
          <JourneyMap stops={stops} accentColor={accentColor} />
        </View>

        {route.params.cachedFromDate && (
          <View style={styles.cachedBanner}>
            <Text style={styles.cachedBannerText}>
              Using a saved route from {formatDate(route.params.cachedFromDate)} — may not reflect current conditions
            </Text>
          </View>
        )}

        {worstConfidence !== "high" && (
          <View style={styles.confidenceBanner}>
            <Text style={styles.confidenceBannerText}>Forecast may still change — we&apos;ll update this closer to departure.</Text>
          </View>
        )}

        <GearRecommendationCard />

        <View style={styles.legList}>
          {journey.legs.map((leg) => (
            <LegRow key={leg.id} leg={leg} />
          ))}
        </View>

        {journey.linkedReturnJourneyId && (
          <Pressable
            onPress={() => navigation.push("JourneyDetail", { journeyId: journey.linkedReturnJourneyId! })}
            style={styles.returnLink}
          >
            <Text style={styles.returnLinkLabel}>⇄ Return trip</Text>
          </Pressable>
        )}

        {showFeedbackStrip && (
          <View style={styles.feedbackContainer}>
            <Text style={styles.feedbackPrompt}>How was the gear call for your commute today?</Text>
            <View style={styles.feedbackRow}>
              {FEEDBACK_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => giveFeedback(option.value)}
                  style={[styles.feedbackButton, option.value === "just_right" && styles.feedbackButtonPositive]}
                >
                  <Text style={styles.feedbackLabel}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  empty: { color: "#666" },
  mapContainer: { height: 280, backgroundColor: "#F6F7FA" },
  cachedBanner: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#F2C94C" },
  cachedBannerText: { fontSize: 12, color: "#1A1E29" },
  confidenceBanner: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#F6F7FA" },
  confidenceBannerText: { fontSize: 12, color: "#5C6478" },
  legList: { paddingHorizontal: 16, paddingTop: 12 },
  returnLink: { margin: 16, alignItems: "center", paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: "#DDE1EA" },
  returnLinkLabel: { fontWeight: "600" },
  feedbackContainer: { margin: 16, gap: 8 },
  feedbackPrompt: { fontSize: 13, color: "#5C6478" },
  feedbackRow: { flexDirection: "row", gap: 4 },
  feedbackButton: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8, backgroundColor: "#F6F7FA" },
  feedbackButtonPositive: { backgroundColor: "#3F9A5C" },
  feedbackLabel: { fontSize: 10, textAlign: "center" },
});

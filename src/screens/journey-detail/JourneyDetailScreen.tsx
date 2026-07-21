import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { deleteJourney, getJourney, updateJourney } from "../../db/repositories/journeys";
import { createAnnotation, listAnnotations } from "../../db/repositories/annotations";
import { applyAnnotationsToLegs } from "../../lib/annotations";
import { useRecommendation } from "../../lib/useRecommendation";
import { freezeIfDue } from "../../lib/leaveBy";
import { cancelLeaveByNotification } from "../../lib/notifications";
import { dominantMode } from "../../lib/journeyMode";
import JourneyMap, { type MapCircle } from "../../components/JourneyMap";
import AnnotationForm, { type AnnotationFormValues } from "../local-knowledge/AnnotationForm";
import GearRecommendationCard from "./GearRecommendationCard";
import LegRow from "./LegRow";
import type { GearFeedback, Journey } from "../../types";

// Core screen — docs/09-design-system.md §9.3, reading a real persisted
// Journey (docs/08-build-phases.md Phase 4, src/db/repositories/journeys.ts)
// built by src/lib/planJourney.ts, with gear recommendations from the real
// engine (Phase 5, src/lib/recommend.ts).
type Props = NativeStackScreenProps<RootStackParamList, "JourneyDetail">;

const MODE_ACCENT: Record<string, string> = {
  walk: "#C97F2E",
  cycle: "#C97F2E",
  drive: "#5B63C9",
  bus: "#2C8F86",
  train: "#2C8F86",
};
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
  // §4.5 — the in-context annotation add flow: a long-press on the map
  // opens a bottom sheet pre-filled with the tapped coordinates, with the
  // affected radius previewed live on the map underneath.
  const [annotationCoordinate, setAnnotationCoordinate] = useState<{ lat: number; lng: number } | null>(null);
  const [previewCircle, setPreviewCircle] = useState<MapCircle | null>(null);
  const recommendation = useRecommendation(journey);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // §7.3/§3 — fallback freeze: if the scheduled leave-by notification
      // never actually fired (app killed, permission revoked), viewing a
      // journey whose leave-by time has already passed freezes the
      // RecommendationSnapshot and records wear here instead. Idempotent —
      // freezeIfDue() is a no-op once a snapshot already exists.
      getJourney(route.params.journeyId).then(async (result) => {
        if (!result) {
          if (!cancelled) setJourney(null);
          return;
        }
        const frozen = await freezeIfDue(result);
        if (!cancelled) setJourney(frozen);
      });
      return () => {
        cancelled = true;
      };
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
  const accentColor = MODE_ACCENT[dominantMode(journey.legs)] ?? "#1A1E29";

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

  function openAnnotationSheet(coordinate: { lat: number; lng: number }) {
    setAnnotationCoordinate(coordinate);
    setPreviewCircle({ ...coordinate, radiusM: 100 });
  }

  function closeAnnotationSheet() {
    setAnnotationCoordinate(null);
    setPreviewCircle(null);
  }

  // §4.5 — save, then immediately re-run annotation matching for this
  // journey's legs so the effect is visible here without navigating away.
  async function saveAnnotation(values: AnnotationFormValues) {
    await createAnnotation(values);
    const annotations = await listAnnotations();
    const updated = { ...journey!, legs: applyAnnotationsToLegs(journey!.legs, annotations) };
    await updateJourney(updated);
    setJourney(updated);
    closeAnnotationSheet();
  }

  async function giveFeedback(feedback: GearFeedback) {
    const updated = { ...journey!, feedback };
    await updateJourney(updated);
    setJourney(updated);
    setFeedbackGiven(true);
  }

  // §7.3 — "cancel with cancelScheduledNotificationAsync if the user
  // deletes the journey." No delete-journey UI existed anywhere in the app
  // before this phase (see DECISIONS.md) — a single confirm-then-delete
  // action here is the minimal affordance that makes the cancellation path
  // reachable, not a full journey-management screen.
  function confirmDelete() {
    Alert.alert("Delete this journey?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: doDelete },
    ]);
  }

  async function doDelete() {
    await cancelLeaveByNotification(journey!.id);
    await deleteJourney(journey!.id);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.mapContainer}>
          <JourneyMap
            stops={stops}
            accentColor={accentColor}
            onLongPress={openAnnotationSheet}
            previewCircle={previewCircle}
          />
        </View>

        {route.params.cachedFromDate && (
          <View style={styles.cachedBanner}>
            <Text style={styles.cachedBannerText}>
              Using a saved route from {formatDate(route.params.cachedFromDate)} — may not reflect current conditions
            </Text>
          </View>
        )}

        {recommendation?.severeWeatherAdvisory && (
          <View style={styles.severeBanner}>
            <Text style={styles.severeBannerText}>⚠ {recommendation.severeWeatherAdvisory}</Text>
          </View>
        )}

        {worstConfidence !== "high" && (
          <View style={styles.confidenceBanner}>
            <Text style={styles.confidenceBannerText}>Forecast may still change — we&apos;ll update this closer to departure.</Text>
          </View>
        )}

        {journey.recommendationSnapshot ? (
          <GearRecommendationCard snapshot={journey.recommendationSnapshot} />
        ) : (
          recommendation && <GearRecommendationCard recommendation={recommendation} />
        )}

        <View style={styles.legList}>
          {journey.legs.map((leg) => (
            <LegRow key={leg.id} leg={leg} />
          ))}
        </View>

        {/* §4.4/§9.4.2 — the return-trip toggle doesn't apply to something
            already past, so History's read-only view hides it. */}
        {!route.params.readOnly && journey.linkedReturnJourneyId && (
          <Pressable
            onPress={() => navigation.push("JourneyDetail", { journeyId: journey.linkedReturnJourneyId! })}
            style={styles.returnLink}
          >
            <Text style={styles.returnLinkLabel}>⇄ Return trip</Text>
          </Pressable>
        )}

        <Pressable onPress={confirmDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonLabel}>Delete journey</Text>
        </Pressable>

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

      <Modal
        visible={annotationCoordinate !== null}
        transparent
        animationType="slide"
        onRequestClose={closeAnnotationSheet}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={styles.sheetDismissArea} onPress={closeAnnotationSheet} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Mark this spot</Text>
            {annotationCoordinate && (
              <AnnotationForm
                initialCoordinate={annotationCoordinate}
                onSave={saveAnnotation}
                onCancel={closeAnnotationSheet}
                onPreviewChange={setPreviewCircle}
              />
            )}
          </View>
        </View>
      </Modal>
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
  severeBanner: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#8C3AB0" },
  severeBannerText: { fontSize: 13, color: "#FFFFFF", fontWeight: "600" },
  confidenceBanner: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#F6F7FA" },
  confidenceBannerText: { fontSize: 12, color: "#5C6478" },
  legList: { paddingHorizontal: 16, paddingTop: 12 },
  returnLink: { margin: 16, alignItems: "center", paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: "#DDE1EA" },
  returnLinkLabel: { fontWeight: "600" },
  deleteButton: { marginHorizontal: 16, marginTop: 16, alignItems: "center", paddingVertical: 12 },
  deleteButtonLabel: { color: "#C0392B", fontWeight: "600", fontSize: 13 },
  feedbackContainer: { margin: 16, gap: 8 },
  feedbackPrompt: { fontSize: 13, color: "#5C6478" },
  feedbackRow: { flexDirection: "row", gap: 4 },
  feedbackButton: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8, backgroundColor: "#F6F7FA" },
  feedbackButtonPositive: { backgroundColor: "#3F9A5C" },
  feedbackLabel: { fontSize: 10, textAlign: "center" },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.35)" },
  sheetDismissArea: { flex: 1 },
  sheet: {
    maxHeight: "75%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
  },
  sheetTitle: { fontSize: 17, fontWeight: "600", textAlign: "center" },
});

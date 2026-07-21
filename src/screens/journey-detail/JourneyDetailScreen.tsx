import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { deleteJourney, getJourney, updateJourney } from "../../db/repositories/journeys";
import { createAnnotation, listAnnotations } from "../../db/repositories/annotations";
import { applyAnnotationsToLegs, decodePolyline } from "../../lib/annotations";
import { useRecommendation } from "../../lib/useRecommendation";
import { freezeIfDue } from "../../lib/leaveBy";
import { cancelLeaveByNotification } from "../../lib/notifications";
import { recordGearFeedback } from "../../lib/calibration";
import { checkForecastDrift } from "../../lib/forecastDrift";
import { dominantMode } from "../../lib/journeyMode";
import { classifyWeather } from "../../lib/weather";
import JourneyMap, { type ConditionMarker, type MapCircle } from "../../components/JourneyMap";
import AnnotationForm, { type AnnotationFormValues } from "../local-knowledge/AnnotationForm";
import GearRecommendationCard from "./GearRecommendationCard";
import LegRow from "./LegRow";
import useTheme from "../../theme/useTheme";
import { conditionColorForSeverity } from "../../theme/tokens";
import type { GearFeedback, Journey, JourneyLeg } from "../../types";

// Core screen — docs/09-design-system.md §9.3, reading a real persisted
// Journey (docs/08-build-phases.md Phase 4, src/db/repositories/journeys.ts)
// built by src/lib/planJourney.ts, with gear recommendations from the real
// engine (Phase 5, src/lib/recommend.ts).
type Props = NativeStackScreenProps<RootStackParamList, "JourneyDetail">;

function modeAccent(mode: string, theme: ReturnType<typeof useTheme>): string {
  if (mode === "drive") return theme.accentDrive;
  if (mode === "bus" || mode === "train") return theme.accentTransit;
  return theme.accentWalk; // walk/cycle/hike (§9.1)
}
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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// §9.3 item 1 — one marker per outdoor leg with weather, at its polyline's
// midpoint, colored/labeled from classifyWeather() via the active theme's
// condition* tokens (§9.1). Legs without a polyline (or without weather —
// Section 5.1's "conditions unknown" degrade) simply contribute no marker,
// same "omit, don't placeholder" pattern used elsewhere in this screen.
function conditionMarkersFor(legs: JourneyLeg[], theme: ReturnType<typeof useTheme>): ConditionMarker[] {
  return legs.flatMap((leg) => {
    if (!leg.outdoor || !leg.weather || !leg.polyline) return [];
    const points = decodePolyline(leg.polyline);
    if (points.length === 0) return [];
    const mid = points[Math.floor(points.length / 2)];
    const condition = classifyWeather(leg.weather.weatherCode, leg.weather.precipMm, leg.weather.windKph);
    return [
      {
        lat: mid.lat,
        lng: mid.lng,
        color: conditionColorForSeverity(theme, condition.severity),
        emoji: condition.icon,
        label: `${leg.label}, ${condition.label}, ${Math.round(leg.weather.tempC)} degrees`,
      },
    ];
  });
}

export default function JourneyDetailScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
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
  const [calibrationToast, setCalibrationToast] = useState<string | null>(null);
  // §7.3 — the pause/resume control (below) always operates on the
  // *template* Journey (the one row with `recurrence` actually set), not
  // whichever occurrence happens to be open — materializeToday.ts never
  // copies `recurrence` onto the daily occurrences it creates, only
  // `templateId` pointing back at the template. undefined = not checked
  // yet, null = this journey isn't part of a recurring series at all.
  const [recurrenceTemplate, setRecurrenceTemplate] = useState<Journey | undefined | null>(undefined);
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
        // §5.2 — a foreground re-check of a still-upcoming journey's
        // weather; a no-op for a past journey (freezeIfDue already handled
        // that) or one whose forecast hasn't drifted enough to matter.
        const drift = await checkForecastDrift(frozen);
        const final = drift.changed ? drift.journey : frozen;
        if (!cancelled && drift.changed) setJourney(drift.journey);

        if (final.recurrence) {
          if (!cancelled) setRecurrenceTemplate(final);
        } else if (final.templateId) {
          const template = await getJourney(final.templateId);
          if (!cancelled) setRecurrenceTemplate(template ?? null);
        } else if (!cancelled) {
          setRecurrenceTemplate(null);
        }
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
  const accentColor = modeAccent(dominantMode(journey.legs), theme);
  const conditionMarkers = conditionMarkersFor(journey.legs, theme);

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

  // §4.2/§7.5 — writes Journey.feedback for History's display, then feeds
  // the calibration loop; the loop's own "we noticed" toast (§9.1.1) is
  // shown here, non-blocking, and auto-dismisses on its own.
  async function giveFeedback(feedback: GearFeedback) {
    const updated = { ...journey!, feedback };
    await updateJourney(updated);
    setJourney(updated);
    setFeedbackGiven(true);
    const { toast } = await recordGearFeedback(feedback, journey!.departTime);
    if (toast) {
      setCalibrationToast(
        toast.direction === "warmer"
          ? "Noticed you run warm — dialing back a layer next time"
          : "Noticed you run cold — bringing an extra layer next time"
      );
      setTimeout(() => setCalibrationToast(null), 4000);
    }
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

  // §7.3 — "cancel [the scheduled notification] if the user... turns off a
  // recurrence's `active` flag." No screen exposed that flag at all before
  // this (see DECISIONS.md, Phase 8 entry: "no UI trigger to attach a
  // cancellation call to") — a pause/resume toggle here, rather than a full
  // recurring-journey editing screen, is the minimal fix that makes the
  // cancellation path reachable. Pausing only cancels *this* instance's own
  // scheduled notification; future occurrences simply never materialize
  // (and so never get one scheduled) while paused, so there's nothing else
  // to cancel.
  async function toggleRecurrenceActive() {
    if (!recurrenceTemplate?.recurrence) return;
    const nextActive = !recurrenceTemplate.recurrence.active;
    const updatedTemplate = { ...recurrenceTemplate, recurrence: { ...recurrenceTemplate.recurrence, active: nextActive } };
    await updateJourney(updatedTemplate);
    setRecurrenceTemplate(updatedTemplate);
    if (!nextActive) {
      await cancelLeaveByNotification(journey!.id);
    }
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
            conditionMarkers={conditionMarkers}
            previewColor={theme.annotationPin}
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

        {!route.params.readOnly && recurrenceTemplate?.recurrence && (
          <View style={styles.recurrenceRow}>
            <Text style={styles.recurrenceLabel}>
              Repeats {recurrenceTemplate.recurrence.daysOfWeek.map((d) => DAY_LABELS[d]).join(", ")}
              {!recurrenceTemplate.recurrence.active && " — paused"}
            </Text>
            <Pressable
              onPress={toggleRecurrenceActive}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={recurrenceTemplate.recurrence.active ? "Pause this recurring journey" : "Resume this recurring journey"}
            >
              <Text style={styles.recurrenceToggleLabel}>{recurrenceTemplate.recurrence.active ? "Pause" : "Resume"}</Text>
            </Pressable>
          </View>
        )}

        {journey.recommendationSnapshot ? (
          <GearRecommendationCard snapshot={journey.recommendationSnapshot} />
        ) : (
          recommendation && (
            <GearRecommendationCard
              recommendation={recommendation}
              onAddGear={(target) => navigation.navigate("Main", { screen: "Gear", params: { openAdd: target } })}
            />
          )
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
            accessibilityRole="button"
            accessibilityLabel="View return trip"
          >
            <Text style={styles.returnLinkLabel}>⇄ Return trip</Text>
          </Pressable>
        )}

        <Pressable
          onPress={confirmDelete}
          style={styles.deleteButton}
          accessibilityRole="button"
          accessibilityLabel="Delete this journey"
        >
          <Text style={styles.deleteButtonLabel}>Delete journey</Text>
        </Pressable>

        {calibrationToast && (
          <View style={styles.calibrationToast}>
            <Text style={styles.calibrationToastText}>{calibrationToast}</Text>
          </View>
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
                  // §9.6 — 44×44pt minimum; invisible hitSlop padding keeps
                  // the visible micro-text row at its speced size (§9.3 item 6).
                  hitSlop={{ top: 10, bottom: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Gear was ${option.label.toLowerCase()}`}
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

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    empty: { color: theme.textSecondary },
    mapContainer: { height: 280, backgroundColor: theme.surface },
    cachedBanner: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.conditionLight },
    cachedBannerText: { fontSize: 12, color: theme.textPrimary },
    severeBanner: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.conditionStorm },
    severeBannerText: { fontSize: 13, color: "#FFFFFF", fontWeight: "600" },
    confidenceBanner: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: theme.surface },
    confidenceBannerText: { fontSize: 12, color: theme.confidenceLow },
    recurrenceRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: theme.surface,
    },
    recurrenceLabel: { fontSize: 12, color: theme.textSecondary, flex: 1 },
    recurrenceToggleLabel: { fontSize: 13, fontWeight: "600", color: theme.accentWalk, minHeight: 30, textAlignVertical: "center" },
    legList: { paddingHorizontal: 16, paddingTop: 12 },
    returnLink: { margin: 16, alignItems: "center", paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.border },
    returnLinkLabel: { fontWeight: "600", color: theme.textPrimary },
    deleteButton: { marginHorizontal: 16, marginTop: 16, alignItems: "center", paddingVertical: 12 },
    deleteButtonLabel: { color: theme.danger, fontWeight: "600", fontSize: 13 },
    feedbackContainer: { margin: 16, gap: 8 },
    feedbackPrompt: { fontSize: 13, color: theme.textSecondary },
    feedbackRow: { flexDirection: "row", gap: 4 },
    feedbackButton: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8, backgroundColor: theme.surface },
    feedbackButtonPositive: { backgroundColor: theme.feedbackPositive },
    feedbackLabel: { fontSize: 10, textAlign: "center", color: theme.textPrimary },
    calibrationToast: { marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: theme.surfaceRaised },
    calibrationToastText: { color: theme.textPrimary, fontSize: 12 },
    sheetBackdrop: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.35)" },
    sheetDismissArea: { flex: 1 },
    sheet: {
      maxHeight: "75%",
      backgroundColor: theme.surfaceRaised,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 12,
      borderWidth: theme.surfaceRaisedBorder === "transparent" ? 0 : 1,
      borderColor: theme.surfaceRaisedBorder,
    },
    sheetTitle: { fontSize: 17, fontWeight: "600", textAlign: "center", color: theme.textPrimary },
  });
}

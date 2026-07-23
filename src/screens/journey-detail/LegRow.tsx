import { StyleSheet, Text, View } from "react-native";
import useTheme from "../../theme/useTheme";
import { conditionColorForSeverity } from "../../theme/tokens";
import { classifyWeather } from "../../lib/weather";
import { HIGH_WIND_KPH } from "../../lib/recommend";
import type { EnvironmentEffectType, JourneyLeg } from "../../types";
import ModeIcon from "../../components/ModeIcon";
import WeatherIcon, { weatherIconKindFor } from "../../components/WeatherIcon";
import EffectIcon from "../../components/EffectIcon";
import { EFFECT_META } from "../local-knowledge/effectMeta";
import { formatTime } from "../../lib/formatTime";
import { useTimeFormatStore } from "../../lib/useTimeFormatStore";

function formatTimeRange(startTime: string, durationMin: number, hour12: boolean): string {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMin * 60_000);
  return `${formatTime(start.toISOString(), hour12)} – ${formatTime(end.toISOString(), hour12)}`;
}

// §3.4/§9.3 — the leg-level "why" line when saved EnvironmentAnnotations
// (Phase 6) apply to this stretch. Labels mirror effectMeta.ts's picker
// copy so the leg note and the Local knowledge screen speak the same
// language. Returns structured entries (not a pre-joined string) so the
// row can render a real EffectIcon per entry instead of an emoji glyph.
function annotationEffects(leg: JourneyLeg): EnvironmentEffectType[] {
  const effects: EnvironmentEffectType[] = [];
  if (leg.windEffect === "amplified") effects.push("wind-tunnel");
  if (leg.windEffect === "sheltered") effects.push("wind-sheltered");
  if (leg.sunEffect === "exposed") effects.push("sun-exposed");
  if (leg.sunEffect === "shaded") effects.push("shaded");
  if (leg.highReflection) effects.push("high-reflection");
  if (leg.rainCovered) effects.push("rain-cover");
  return effects;
}

interface Props {
  leg: JourneyLeg;
}

export default function LegRow({ leg }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const hour12 = useTimeFormatStore((s) => s.timeFormatPreference !== "24h");
  const pillLabel = !leg.outdoor && !leg.isStationary ? (leg.climate === "ac" ? "AC" : leg.climate === "heated" ? "Heated" : undefined) : undefined;
  const isPill = pillLabel !== undefined;
  const modeIconKind = leg.isStationary ? "stationary" : !leg.outdoor ? "indoor" : leg.mode;
  const condition = leg.outdoor && leg.weather ? classifyWeather(leg.weather.weatherCode, leg.weather.precipMm, leg.weather.windKph) : undefined;
  const effects = annotationEffects(leg);
  // §9.6 — one coherent screen-reader label per row (icon + text + badge
  // read as a single stop) rather than three separate ones.
  const accessibilityLabel = [
    leg.label,
    `${leg.durationMin} minutes`,
    leg.weather ? `${Math.round(leg.weather.apparentTempC)} degrees` : undefined,
    condition?.label,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={styles.row} accessible accessibilityLabel={accessibilityLabel}>
      <View style={[styles.iconCircle, isPill && styles.pillCircle]}>
        {isPill ? <Text style={styles.pillLabel}>{pillLabel}</Text> : <ModeIcon kind={modeIconKind} size={16} color={theme.textPrimary} />}
      </View>
      <View style={styles.center}>
        <Text style={styles.label}>{leg.label}</Text>
        <Text style={styles.meta}>
          {leg.durationMin} min · {formatTimeRange(leg.startTime, leg.durationMin, hour12)}
        </Text>
        {effects.length > 0 && (
          <View style={styles.annotationRow}>
            {effects.map((effect) => (
              <View key={effect} style={styles.annotationChip}>
                <EffectIcon kind={effect} size={12} color={theme.accentWalk} />
                <Text style={styles.annotationChipText}>{EFFECT_META[effect].label}</Text>
              </View>
            ))}
            <Text style={styles.annotationLine}>— a spot you&apos;ve marked</Text>
          </View>
        )}
      </View>
      <View style={styles.badgeColumn}>
        {leg.outdoor && leg.weather && condition && (
          <View style={[styles.badge, { backgroundColor: conditionColorForSeverity(theme, condition.severity) }]}>
            <WeatherIcon kind={weatherIconKindFor(condition)} size={12} color="#FFFFFF" />
            <Text style={styles.badgeText}>
              {Math.round(leg.weather.apparentTempC)}°C
              {leg.weather.windKph > HIGH_WIND_KPH ? ` · ${Math.round(leg.weather.windKph)} km/h` : ""}
            </Text>
          </View>
        )}
        {(leg.mode === "bus" || leg.mode === "train") && leg.delayMinutes !== undefined && (
          <View style={[styles.delayPill, leg.delayMinutes > 0 ? styles.delayPillLate : styles.delayPillOnTime]}>
            <Text style={styles.delayPillText}>{leg.delayMinutes > 0 ? `+${leg.delayMinutes} min` : "On time"}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, backgroundColor: theme.surface, marginBottom: 12 },
    iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: theme.border },
    pillCircle: { width: "auto", paddingHorizontal: 8, borderRadius: 8, backgroundColor: theme.acBadge },
    pillLabel: { fontSize: 11, fontWeight: "600", color: "#FFFFFF" },
    center: { flex: 1 },
    label: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    meta: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    annotationRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 2 },
    annotationChip: { flexDirection: "row", alignItems: "center", gap: 3 },
    annotationChipText: { fontSize: 12, fontWeight: "600", color: theme.accentWalk },
    annotationLine: { fontSize: 12, color: theme.textSecondary },
    badgeColumn: { alignItems: "flex-end", gap: 4 },
    badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: theme.border },
    // White text on top of a condition* fill (§9.1) for contrast, matching
    // the severe-weather banner's same badge-on-condition-color pattern.
    badgeText: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
    delayPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    delayPillOnTime: { backgroundColor: theme.border },
    delayPillLate: { backgroundColor: theme.uvBadge },
    delayPillText: { fontSize: 11, fontWeight: "600", color: theme.textPrimary },
  });
}

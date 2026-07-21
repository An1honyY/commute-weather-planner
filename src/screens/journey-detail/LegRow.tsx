import { StyleSheet, Text, View } from "react-native";
import useTheme from "../../theme/useTheme";
import { conditionColorForSeverity } from "../../theme/tokens";
import { classifyWeather } from "../../lib/weather";
import { HIGH_WIND_KPH } from "../../lib/recommend";
import type { JourneyLeg } from "../../types";

// One row per JourneyLeg — docs/09-design-system.md §9.3 item 5.
const MODE_ICON: Record<string, string> = {
  walk: "🚶",
  cycle: "🚴",
  drive: "🚗",
  bus: "🚌",
  train: "🚆",
  hike: "🥾",
};

function formatTimeRange(startTime: string, durationMin: number): string {
  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMin * 60_000);
  const fmt = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

// §3.4/§9.3 — the leg-level "why" line when saved EnvironmentAnnotations
// (Phase 6) apply to this stretch. Labels mirror effectMeta.ts's picker
// copy so the leg note and the Local knowledge screen speak the same
// language.
function annotationEffectLine(leg: JourneyLeg): string | null {
  const parts: string[] = [];
  if (leg.windEffect === "amplified") parts.push("🌬️ Wind tunnel");
  if (leg.windEffect === "sheltered") parts.push("🏘️ Wind-sheltered");
  if (leg.sunEffect === "exposed") parts.push("☀️ Sun-exposed");
  if (leg.sunEffect === "shaded") parts.push("🌳 Shaded");
  if (leg.highReflection) parts.push("🏖️ High reflection");
  if (leg.rainCovered) parts.push("☂️ Covered from rain");
  return parts.length > 0 ? `${parts.join(" · ")} — a spot you've marked` : null;
}

interface Props {
  leg: JourneyLeg;
}

export default function LegRow({ leg }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const icon = leg.isStationary ? "🧍" : !leg.outdoor ? (leg.climate === "ac" ? "AC" : leg.climate === "heated" ? "Heated" : "🏢") : MODE_ICON[leg.mode] ?? "•";
  const isPill = !leg.outdoor && !leg.isStationary;
  const condition = leg.outdoor && leg.weather ? classifyWeather(leg.weather.weatherCode, leg.weather.precipMm, leg.weather.windKph) : undefined;
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
        <Text style={isPill ? styles.pillLabel : styles.iconGlyph}>{icon}</Text>
      </View>
      <View style={styles.center}>
        <Text style={styles.label}>{leg.label}</Text>
        <Text style={styles.meta}>
          {leg.durationMin} min · {formatTimeRange(leg.startTime, leg.durationMin)}
        </Text>
        {annotationEffectLine(leg) && <Text style={styles.annotationLine}>{annotationEffectLine(leg)}</Text>}
      </View>
      <View style={styles.badgeColumn}>
        {leg.outdoor && leg.weather && condition && (
          <View style={[styles.badge, { backgroundColor: conditionColorForSeverity(theme, condition.severity) }]}>
            <Text style={styles.badgeText}>
              {condition.icon} {Math.round(leg.weather.apparentTempC)}°C
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
    iconGlyph: { fontSize: 16 },
    pillLabel: { fontSize: 11, fontWeight: "600", color: "#FFFFFF" },
    center: { flex: 1 },
    label: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    meta: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
    annotationLine: { fontSize: 12, color: theme.accentWalk, marginTop: 2 },
    badgeColumn: { alignItems: "flex-end", gap: 4 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: theme.border },
    // White text on top of a condition* fill (§9.1) for contrast, matching
    // the severe-weather banner's same badge-on-condition-color pattern.
    badgeText: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
    delayPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    delayPillOnTime: { backgroundColor: theme.border },
    delayPillLate: { backgroundColor: theme.uvBadge },
    delayPillText: { fontSize: 11, fontWeight: "600", color: theme.textPrimary },
  });
}

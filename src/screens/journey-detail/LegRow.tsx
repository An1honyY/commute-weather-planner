import { StyleSheet, Text, View } from "react-native";
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
  const icon = leg.isStationary ? "🧍" : !leg.outdoor ? (leg.climate === "ac" ? "AC" : leg.climate === "heated" ? "Heated" : "🏢") : MODE_ICON[leg.mode] ?? "•";
  const isPill = !leg.outdoor && !leg.isStationary;

  return (
    <View style={styles.row}>
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
        {leg.outdoor && leg.weather && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{Math.round(leg.weather.apparentTempC)}°C</Text>
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

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, backgroundColor: "#F6F7FA", marginBottom: 12 },
  iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#DDE1EA" },
  pillCircle: { width: "auto", paddingHorizontal: 8, borderRadius: 8, backgroundColor: "#5CC8E8" },
  iconGlyph: { fontSize: 16 },
  pillLabel: { fontSize: 11, fontWeight: "600", color: "#FFFFFF" },
  center: { flex: 1 },
  label: { fontSize: 15, fontWeight: "600" },
  meta: { fontSize: 12, color: "#5C6478", marginTop: 2 },
  annotationLine: { fontSize: 12, color: "#C97F2E", marginTop: 2 },
  badgeColumn: { alignItems: "flex-end", gap: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#DDE1EA" },
  badgeText: { fontSize: 12, fontWeight: "600" },
  delayPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  delayPillOnTime: { backgroundColor: "#DDE1EA" },
  delayPillLate: { backgroundColor: "#F0B95C" },
  delayPillText: { fontSize: 11, fontWeight: "600" },
});

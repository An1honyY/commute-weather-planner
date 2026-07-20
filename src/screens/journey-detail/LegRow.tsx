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
      </View>
      {leg.outdoor && leg.weather && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{Math.round(leg.weather.apparentTempC)}°C</Text>
        </View>
      )}
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
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#DDE1EA" },
  badgeText: { fontSize: 12, fontWeight: "600" },
});

import { StyleSheet, Text, View } from "react-native";
import Svg, { ClipPath, Defs, Path, Rect } from "react-native-svg";
import useTheme from "../theme/useTheme";
import type { RainIntensity } from "../lib/weather";

// docs/09-design-system.md §9.5 — a vertical "droplet fill": a droplet-
// shaped SVG clipped so a solid fill rises from the bottom to a height
// proportional to the rain-intensity bucket (docs/06-weather-
// classification.md §6), one per hour in a horizontal ScrollView
// (src/components/HourlyStrip.tsx renders the row).
const BUCKET_FILL_PCT: Record<RainIntensity, number> = { none: 0, low: 0.33, med: 0.66, high: 1 };

// A simple teardrop path in a 28x28 box — round bottom, pointed top —
// good enough to read as "droplet" at this size without needing an SVG
// asset import.
const DROPLET_PATH = "M14 2 C14 2 24 14 24 20 A10 10 0 0 1 4 20 C4 14 14 2 14 2 Z";

interface Props {
  hour: string; // formatted label, e.g. "3pm"
  rainIntensity: RainIntensity;
  // "none"/"low" read as conditionRain, "med"/"high" as the deeper
  // conditionHeavy — matches the two-tier rain coloring used elsewhere
  // (leg badges, condition markers) rather than inventing a third hue.
}

export default function RainGauge({ hour, rainIntensity }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const fillPct = BUCKET_FILL_PCT[rainIntensity];
  const fillColor = rainIntensity === "high" ? theme.conditionHeavy : theme.conditionRain;
  const fillHeight = 28 * fillPct;
  const fillY = 28 - fillHeight;

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={`${hour}, ${rainIntensity === "none" ? "no rain expected" : `${rainIntensity} rain expected`}`}
    >
      <Svg width={28} height={28} viewBox="0 0 28 28">
        <Defs>
          <ClipPath id={`droplet-${hour}`}>
            <Path d={DROPLET_PATH} />
          </ClipPath>
        </Defs>
        <Path d={DROPLET_PATH} fill={theme.border} />
        {fillPct > 0 && (
          <Rect
            x={0}
            y={fillY}
            width={28}
            height={fillHeight}
            fill={fillColor}
            clipPath={`url(#droplet-${hour})`}
          />
        )}
      </Svg>
      <Text style={styles.label}>{hour}</Text>
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { width: 28, alignItems: "center", gap: 4 },
    label: { fontSize: 11, color: theme.textSecondary },
  });
}

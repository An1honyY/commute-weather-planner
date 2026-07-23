import { StyleSheet, Text, View } from "react-native";
import Svg, { ClipPath, Defs, Path, Rect } from "react-native-svg";
import useTheme from "../theme/useTheme";
import type { RainIntensity } from "../lib/weather";
import WeatherIcon, { type WeatherIconKind } from "./WeatherIcon";

// docs/09-design-system.md §9.5 — a vertical "droplet fill": a droplet-
// shaped SVG clipped so a solid fill rises from the bottom to a height
// proportional to the rain-intensity bucket (docs/06-weather-
// classification.md §6), one per hour in a horizontal ScrollView
// (src/components/HourlyStrip.tsx renders the row). Extended (this pass)
// with a condition icon + temperature above the droplet, so the strip
// carries the same "what's it actually like" detail the leg badges/Right
// now card already do, not just a rain-only reading.
const BUCKET_FILL_PCT: Record<RainIntensity, number> = { none: 0, low: 0.33, med: 0.66, high: 1 };

// A simple teardrop path in a 28x28 box — round bottom, pointed top —
// good enough to read as "droplet" at this size without needing an SVG
// asset import.
const DROPLET_PATH = "M14 2 C14 2 24 14 24 20 A10 10 0 0 1 4 20 C4 14 14 2 14 2 Z";

// "low" reads as a lightened tint of conditionRain (not a separate hue —
// still unmistakably "rain", just visibly less of it), "med" the full
// conditionRain, "high" the deeper conditionHeavy. A flat opacity on the
// fill (rather than a separate light/dark hex per theme) keeps this in
// sync with conditionRain automatically if that token ever changes.
const BUCKET_FILL_OPACITY: Record<RainIntensity, number> = { none: 1, low: 0.45, med: 1, high: 1 };

interface Props {
  hour: string; // formatted label, e.g. "3pm"
  rainIntensity: RainIntensity;
  tempC?: number;
  conditionKind?: WeatherIconKind;
  conditionLabel?: string;
}

export default function RainGauge({ hour, rainIntensity, tempC, conditionKind, conditionLabel }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const fillPct = BUCKET_FILL_PCT[rainIntensity];
  const fillColor = rainIntensity === "high" ? theme.conditionHeavy : theme.conditionRain;
  const fillOpacity = BUCKET_FILL_OPACITY[rainIntensity];
  const fillHeight = 28 * fillPct;
  const fillY = 28 - fillHeight;

  const rainDescription = rainIntensity === "none" ? "no rain expected" : `${rainIntensity} rain expected`;
  const accessibilityLabel = [hour, conditionLabel, tempC !== undefined ? `${Math.round(tempC)} degrees` : undefined, rainDescription]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={styles.container} accessible accessibilityLabel={accessibilityLabel}>
      {conditionKind && <WeatherIcon kind={conditionKind} size={14} color={theme.textSecondary} />}
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
            fillOpacity={fillOpacity}
            clipPath={`url(#droplet-${hour})`}
          />
        )}
      </Svg>
      {tempC !== undefined && <Text style={styles.temp}>{Math.round(tempC)}°</Text>}
      <Text style={styles.label}>{hour}</Text>
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { width: 32, alignItems: "center", gap: 3 },
    temp: { fontSize: 11, fontWeight: "600", color: theme.textPrimary },
    label: { fontSize: 11, color: theme.textSecondary },
  });
}

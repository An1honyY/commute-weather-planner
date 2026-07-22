import { useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import useTheme from "../theme/useTheme";

// A lightweight continuous drag/tap slider — no @react-native-community/slider
// dependency (still not in docs/01-tech-stack.md's table), built on React
// Native's built-in Responder props so it works identically on native and
// web (react-native-web maps them onto pointer events). Used for the
// EnvironmentAnnotation radius (§4.5), where the old stepped 50–300m chip
// row couldn't express the smaller ranges real spots need (a doorway awning,
// a bus shelter). trackWidth is plain state (not a ref), so the value-mapping
// closure always sees the current width without touching a ref during render.
interface Props {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
}

const THUMB = 24;

export default function RadiusSlider({ value, onChange, min, max, step }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [trackWidth, setTrackWidth] = useState(0);

  function valueForX(x: number): number {
    const usable = Math.max(1, trackWidth - THUMB);
    const clampedX = Math.min(usable, Math.max(0, x - THUMB / 2));
    const raw = min + (clampedX / usable) * (max - min);
    const stepped = Math.round(raw / step) * step;
    return Math.min(max, Math.max(min, stepped));
  }

  function onLayout(e: LayoutChangeEvent) {
    setTrackWidth(e.nativeEvent.layout.width);
  }

  const fraction = max > min ? (value - min) / (max - min) : 0;
  const usable = Math.max(0, trackWidth - THUMB);
  const thumbLeft = fraction * usable;

  return (
    <View
      style={styles.track}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => onChange(valueForX(e.nativeEvent.locationX))}
      onResponderMove={(e) => onChange(valueForX(e.nativeEvent.locationX))}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
      accessibilityLabel={`Radius ${value} metres`}
    >
      <View style={styles.rail} />
      <View style={[styles.railFilled, { width: thumbLeft + THUMB / 2 }]} />
      <View style={[styles.thumb, { left: thumbLeft }]} />
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    track: { height: 44, justifyContent: "center" },
    rail: { position: "absolute", left: 0, right: 0, height: 6, borderRadius: 3, backgroundColor: theme.border },
    railFilled: { position: "absolute", left: 0, height: 6, borderRadius: 3, backgroundColor: theme.accentWalk },
    thumb: {
      position: "absolute",
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB / 2,
      backgroundColor: theme.accentWalk,
      borderWidth: 2,
      borderColor: "#FFFFFF",
    },
  });
}

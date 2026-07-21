import { StyleSheet, Text, View } from "react-native";
import type { ConditionMarker, MapCircle, MapStop } from "./JourneyMap";

// Web fallback for Journey Detail's map. react-native-maps' own MapView.web.ts
// already resolves to an UnimplementedView, but its Marker/Polyline
// components aren't guaranteed equally web-safe — rather than audit every
// native-only code path, this file (picked up automatically by Metro's
// platform-extension resolution instead of JourneyMap.tsx on web builds)
// never imports react-native-maps at all, so the web dev-preview this
// project relies on for quick smoke-checks can't be broken by it. Real
// map rendering is a native-only feature for this app; see DECISIONS.md.
interface Props {
  stops: MapStop[];
  accentColor: string;
  // Phase 6's long-press annotation capture and radius preview are
  // native-only, like the map itself — accepted and ignored here.
  onLongPress?: (coordinate: { lat: number; lng: number }) => void;
  previewCircle?: MapCircle | null;
  conditionMarkers?: ConditionMarker[];
}

export default function JourneyMap({ accentColor }: Props) {
  return (
    <View style={[styles.container, { borderColor: accentColor }]}>
      <Text style={styles.text}>Map preview (native only)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F7FA",
  },
  text: { color: "#5C6478", fontSize: 13 },
});

import { StyleSheet, Text, View } from "react-native";
import MapView, { Circle, Marker, Polyline } from "react-native-maps";

// Journey Detail's map — docs/09-design-system.md §9.3 item 1. Native
// (iOS/Android) implementation; see JourneyMap.web.tsx for why web gets a
// separate file rather than importing react-native-maps directly (
// DECISIONS.md, "Locations CRUD uses text/number fields, not map pin-drop").
// Phase 6 adds the long-press entry point for EnvironmentAnnotation capture
// (§4.5) and the live radius-circle preview shown while the annotation
// sheet is open.
export interface MapStop {
  lat: number;
  lng: number;
}

export interface MapCircle {
  lat: number;
  lng: number;
  radiusM: number;
}

// §9.3 item 1 — one marker per outdoor leg's midpoint, filled with that
// leg's condition color (§9.1) and containing classifyWeather()'s emoji.
// Computed by the caller (JourneyDetailScreen), which has both the leg
// weather and the active useTheme() token object — JourneyMap itself stays
// a dumb renderer so the native/web split doesn't need its own theme read.
export interface ConditionMarker {
  lat: number;
  lng: number;
  color: string;
  emoji: string;
  label: string; // accessibilityLabel, §9.6 — never color alone
}

interface Props {
  stops: MapStop[];
  accentColor: string;
  onLongPress?: (coordinate: { lat: number; lng: number }) => void;
  previewCircle?: MapCircle | null;
  conditionMarkers?: ConditionMarker[];
  // §9.1 annotationPin token — the radius preview shown while adding an
  // EnvironmentAnnotation (§4.5) is themed distinctly from the route/mode
  // accent, since it isn't a mode color. Falls back to accentColor so
  // existing callers/tests that don't pass it keep working.
  previewColor?: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const int = parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function JourneyMap({ stops, accentColor, onLongPress, previewCircle, conditionMarkers, previewColor }: Props) {
  if (stops.length === 0) return <View style={styles.container} />;

  const coordinates = stops.map((s) => ({ latitude: s.lat, longitude: s.lng }));

  return (
    <MapView
      style={styles.container}
      initialRegion={{
        latitude: coordinates[0].latitude,
        longitude: coordinates[0].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
      onLongPress={(event) => {
        const { latitude, longitude } = event.nativeEvent.coordinate;
        onLongPress?.({ lat: latitude, lng: longitude });
      }}
    >
      <Polyline coordinates={coordinates} strokeColor={accentColor} strokeWidth={4} />
      {coordinates.map((coordinate, i) => (
        <Marker key={`stop-${i}`} coordinate={coordinate} pinColor={accentColor} />
      ))}
      {(conditionMarkers ?? []).map((marker, i) => (
        <Marker
          key={`condition-${i}`}
          coordinate={{ latitude: marker.lat, longitude: marker.lng }}
          accessibilityLabel={marker.label}
        >
          <View style={[styles.conditionMarker, { backgroundColor: marker.color }]}>
            <Text style={styles.conditionMarkerEmoji}>{marker.emoji}</Text>
          </View>
        </Marker>
      ))}
      {previewCircle && (
        <Circle
          center={{ latitude: previewCircle.lat, longitude: previewCircle.lng }}
          radius={previewCircle.radiusM}
          strokeColor={previewColor ?? accentColor}
          fillColor={hexToRgba(previewColor ?? accentColor, 0.15)}
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", height: "100%" },
  conditionMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  conditionMarkerEmoji: { fontSize: 12 },
});

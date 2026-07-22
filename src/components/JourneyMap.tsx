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

// §4.5 — a saved EnvironmentAnnotation shown on the map so the user can see
// their marked local-knowledge spots (windy corners, covered walkways, …)
// alongside the route, not only when actively adding one. Built by the
// caller from EFFECT_META + the annotationPin token, same dumb-renderer
// split as ConditionMarker.
export interface MapAnnotation {
  lat: number;
  lng: number;
  radiusM: number;
  icon: string;
  label: string;
  color: string;
}

interface Props {
  stops: MapStop[];
  // Decoded, concatenated polyline geometry from the real routed journey
  // (Google Routes' per-leg encoded polyline, already decoded by the
  // caller via annotations.ts's decodePolyline — JourneyMap stays a dumb
  // renderer, same reasoning as conditionMarkers below). Falls back to a
  // straight line through `stops` when absent/empty (e.g. no live route
  // data), which is a real degradation, not the normal case.
  routePath?: MapStop[];
  accentColor: string;
  onLongPress?: (coordinate: { lat: number; lng: number }) => void;
  previewCircle?: MapCircle | null;
  conditionMarkers?: ConditionMarker[];
  // Saved EnvironmentAnnotations to display (§4.5) — distinct from the
  // single transient `previewCircle` shown while adding a new one.
  annotations?: MapAnnotation[];
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

export default function JourneyMap({ stops, routePath, accentColor, onLongPress, previewCircle, conditionMarkers, annotations, previewColor }: Props) {
  if (stops.length === 0) return <View style={styles.container} />;

  const coordinates = stops.map((s) => ({ latitude: s.lat, longitude: s.lng }));
  const lineCoordinates =
    routePath && routePath.length > 0 ? routePath.map((p) => ({ latitude: p.lat, longitude: p.lng })) : coordinates;

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
      <Polyline coordinates={lineCoordinates} strokeColor={accentColor} strokeWidth={4} />
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
      {(annotations ?? []).map((annotation, i) => (
        <View key={`annotation-${i}`}>
          <Circle
            center={{ latitude: annotation.lat, longitude: annotation.lng }}
            radius={annotation.radiusM}
            strokeColor={annotation.color}
            fillColor={hexToRgba(annotation.color, 0.12)}
          />
          <Marker
            coordinate={{ latitude: annotation.lat, longitude: annotation.lng }}
            accessibilityLabel={annotation.label}
          >
            <View style={[styles.annotationMarker, { backgroundColor: annotation.color }]}>
              <Text style={styles.annotationMarkerIcon}>{annotation.icon}</Text>
            </View>
          </Marker>
        </View>
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
  annotationMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  annotationMarkerIcon: { fontSize: 13 },
});

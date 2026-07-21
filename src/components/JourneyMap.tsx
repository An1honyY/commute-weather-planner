import { StyleSheet, View } from "react-native";
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

interface Props {
  stops: MapStop[];
  accentColor: string;
  onLongPress?: (coordinate: { lat: number; lng: number }) => void;
  previewCircle?: MapCircle | null;
}

export default function JourneyMap({ stops, accentColor, onLongPress, previewCircle }: Props) {
  if (stops.length === 0) return <View style={styles.container} />;

  const coordinates = stops.map((s) => ({ latitude: s.lat, longitude: s.lng }));
  const midpoints = coordinates.slice(0, -1).map((point, i) => {
    const next = coordinates[i + 1];
    return { latitude: (point.latitude + next.latitude) / 2, longitude: (point.longitude + next.longitude) / 2 };
  });

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
      {midpoints.map((coordinate, i) => (
        <Marker key={`mid-${i}`} coordinate={coordinate}>
          <View style={[styles.conditionMarker, { backgroundColor: accentColor }]} />
        </Marker>
      ))}
      {previewCircle && (
        <Circle
          center={{ latitude: previewCircle.lat, longitude: previewCircle.lng }}
          radius={previewCircle.radiusM}
          strokeColor={accentColor}
          fillColor="rgba(201, 127, 46, 0.15)"
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", height: "100%" },
  conditionMarker: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#FFFFFF" },
});

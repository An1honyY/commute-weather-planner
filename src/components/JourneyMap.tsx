import { StyleSheet, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

// Journey Detail's map — docs/09-design-system.md §9.3 item 1. Native
// (iOS/Android) implementation; see JourneyMap.web.tsx for why web gets a
// separate file rather than importing react-native-maps directly (
// DECISIONS.md, "Locations CRUD uses text/number fields, not map pin-drop").
// Phase 3 has no real routed polyline yet (Phase 4) — a straight line
// through the ordered stops is the honest mock, and since the Plan screen
// only offers one mode per whole trip right now, a single accent color
// already matches §9.3's "per-segment matching each leg's mode" for this
// phase's actual data shape.
export interface MapStop {
  lat: number;
  lng: number;
}

interface Props {
  stops: MapStop[];
  accentColor: string;
}

export default function JourneyMap({ stops, accentColor }: Props) {
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
    </MapView>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", height: "100%" },
  conditionMarker: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#FFFFFF" },
});

import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap, useMapEvents } from "react-leaflet";
import type { LeafletMouseEvent } from "leaflet";
import { LEAFLET_CSS } from "./leafletCss";
import { pinDivIcon, conditionDivIcon } from "./leafletIcons";
import type { ConditionMarker, MapCircle, MapStop } from "./JourneyMap";

// Web implementation of the Journey Detail route map — same react-leaflet +
// OpenStreetMap approach LocationPickerMap.web.tsx already established for
// the identical "react-native-maps has no web target" gap (see that file's
// header comment and DECISIONS.md). This one renders a route polyline,
// per-stop pins, per-leg condition badges, and an optional annotation-radius
// preview circle instead of a single draggable pin.
const LEAFLET_STYLE_ID = "leaflet-vendored-css";

interface Props {
  stops: MapStop[];
  // Decoded, concatenated polyline geometry from the real routed journey —
  // see JourneyMap.tsx's Props for the full rationale. Falls back to a
  // straight line through `stops` when absent/empty.
  routePath?: MapStop[];
  accentColor: string;
  // No long-press gesture exists for a mouse — a plain click on the map
  // opens the same annotation-add sheet a native long-press would,
  // mirroring LocationPickerMap.web.tsx's click-to-move substitution for
  // the same touch-vs-mouse gap.
  onLongPress?: (coordinate: { lat: number; lng: number }) => void;
  previewCircle?: MapCircle | null;
  conditionMarkers?: ConditionMarker[];
  previewColor?: string;
}

function ClickToAnnotate({ onClick }: { onClick?: (coords: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// Frames the whole route rather than a fixed zoom around the first stop —
// a journey can span much further than a single picked pin, so a static
// zoom (the picker's approach) would crop longer commutes badly.
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 15);
    } else {
      map.fitBounds(positions, { padding: [24, 24] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(positions)]);
  return null;
}

export default function JourneyMap({ stops, routePath, accentColor, onLongPress, previewCircle, conditionMarkers, previewColor }: Props) {
  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById(LEAFLET_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = LEAFLET_STYLE_ID;
    style.textContent = LEAFLET_CSS;
    document.head.appendChild(style);
  }, []);

  if (stops.length === 0) return <View style={styles.container} />;

  const positions: [number, number][] = stops.map((s) => [s.lat, s.lng]);
  const linePositions: [number, number][] =
    routePath && routePath.length > 0 ? routePath.map((p) => [p.lat, p.lng]) : positions;

  return (
    <View style={styles.container}>
      <MapContainer center={positions[0]} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; <a href=&quot;https://www.openstreetmap.org/copyright&quot;>OpenStreetMap</a> contributors"
        />
        <FitBounds positions={linePositions} />
        <Polyline positions={linePositions} pathOptions={{ color: accentColor, weight: 4 }} />
        {positions.map((position, i) => (
          <Marker key={`stop-${i}`} position={position} icon={pinDivIcon(accentColor)} />
        ))}
        {(conditionMarkers ?? []).map((marker, i) => (
          <Marker
            key={`condition-${i}`}
            position={[marker.lat, marker.lng]}
            icon={conditionDivIcon(marker.color, marker.emoji)}
            alt={marker.label}
          />
        ))}
        {previewCircle && (
          <Circle
            center={[previewCircle.lat, previewCircle.lng]}
            radius={previewCircle.radiusM}
            pathOptions={{ color: previewColor ?? accentColor, fillColor: previewColor ?? accentColor, fillOpacity: 0.15 }}
          />
        )}
        <ClickToAnnotate onClick={onLongPress} />
      </MapContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", height: "100%" },
});

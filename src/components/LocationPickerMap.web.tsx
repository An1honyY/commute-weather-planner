import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L, { type LeafletMouseEvent } from "leaflet";
import { LEAFLET_CSS } from "./leafletCss";
import useTheme from "../theme/useTheme";

// Web implementation of the map-based location picker — react-leaflet +
// OpenStreetMap tiles, both free/keyless (matching this project's existing
// preference for free/keyless APIs where one exists, e.g. Open-Meteo over
// a paid weather API — docs/02-external-apis.md §2), rather than adding a
// second Google Maps Platform product (Maps JavaScript API) alongside
// Places/Routes/Geocoding just for this one screen. `react-native-maps`
// itself has no web target at all (see LocationPickerMap.tsx's header
// comment and JourneyMap.web.tsx's precedent for the same gap on a
// different screen) — this isn't a fallback/placeholder, it's a real,
// independently-implemented map for web specifically. No marker-image
// assets are loaded — the pin is an inline SVG L.divIcon, so LEAFLET_CSS
// (vendored, see that file's header) is the only extra asset this needs.
const AUCKLAND = { lat: -36.8485, lng: 174.7633 };
const LEAFLET_STYLE_ID = "leaflet-vendored-css";

function markerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: "cwp-location-marker",
    html: `<svg width="30" height="30" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C7.6 2 4 5.6 4 10c0 5.6 7 11.5 7.3 11.7a1 1 0 0 0 1.4 0C13 21.5 20 15.6 20 10c0-4.4-3.6-8-8-8Z" fill="${color}" stroke="#FFFFFF" stroke-width="1.2"/><circle cx="12" cy="10" r="2.6" fill="#FFFFFF"/></svg>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
  });
}

function ClickToMove({ onMove }: { onMove: (coords: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onMove({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

interface Props {
  visible: boolean;
  initialCoords?: { lat: number; lng: number };
  onConfirm: (coords: { lat: number; lng: number }) => void;
  onClose: () => void;
}

export default function LocationPickerMap({ visible, initialCoords, onConfirm, onClose }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const start = initialCoords ?? AUCKLAND;
  const [marker, setMarker] = useState(start);
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById(LEAFLET_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = LEAFLET_STYLE_ID;
    style.textContent = LEAFLET_CSS;
    document.head.appendChild(style);
  }, []);

  // Not rendered at all while closed (rather than hidden-but-mounted) so
  // MapContainer always initializes against a container that already has
  // its final on-screen size — Leaflet mis-sizes itself if it mounts while
  // its container is display:none/zero-size, which a hidden-but-mounted
  // Modal would otherwise risk.
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.headerButton}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Drop a pin</Text>
          <Pressable onPress={() => onConfirm(marker)} hitSlop={8}>
            <Text style={[styles.headerButton, styles.headerButtonPrimary]}>Use this</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>Click or drag the pin to the exact spot.</Text>
        <View style={styles.map}>
          <MapContainer center={[start.lat, start.lng]} zoom={13} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; <a href=&quot;https://www.openstreetmap.org/copyright&quot;>OpenStreetMap</a> contributors"
            />
            <Marker
              position={[marker.lat, marker.lng]}
              icon={markerIcon(theme.accentWalk)}
              draggable
              ref={markerRef}
              eventHandlers={{
                dragend: () => {
                  const position = markerRef.current?.getLatLng();
                  if (position) setMarker({ lat: position.lat, lng: position.lng });
                },
              }}
            />
            <ClickToMove onMove={setMarker} />
          </MapContainer>
        </View>
      </View>
    </Modal>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    headerTitle: { fontSize: 15, fontWeight: "600", color: theme.textPrimary },
    headerButton: { fontSize: 15, color: theme.textSecondary, minHeight: 44, textAlignVertical: "center" },
    headerButtonPrimary: { color: theme.accentWalk, fontWeight: "600" },
    hint: { fontSize: 12, color: theme.textSecondary, textAlign: "center", paddingBottom: 8 },
    map: { flex: 1 },
  });
}

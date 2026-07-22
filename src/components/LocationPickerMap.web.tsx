import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import type L from "leaflet";
import type { LeafletMouseEvent } from "leaflet";
import { LEAFLET_CSS } from "./leafletCss";
import { pinDivIcon } from "./leafletIcons";
import { basemapFor } from "./leafletBasemap";
import { resolveApproximateLocation } from "../lib/approximateLocation";
import { reverseGeocode } from "../services/placesService";
import useTheme from "../theme/useTheme";
import { darkTheme } from "../theme/tokens";

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
//
// When the caller doesn't already know real coordinates, the starting pin
// is seeded from approximateLocation.ts's GPS → saved-default → Auckland
// chain rather than always opening on a fixed Auckland fallback — see
// DECISIONS.md.
const LEAFLET_STYLE_ID = "leaflet-vendored-css";
const REVERSE_GEOCODE_DEBOUNCE_MS = 700; // reverseGeocode is a billable Google Geocoding call — wait for the pin to settle before firing, not on every drag/click

function ClickToMove({ onMove }: { onMove: (coords: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onMove({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

interface Seed {
  lat: number;
  lng: number;
  isFallback: boolean;
}

interface Props {
  visible: boolean;
  initialCoords?: { lat: number; lng: number };
  onConfirm: (coords: { lat: number; lng: number }, resolvedLabel?: string) => void;
  onClose: () => void;
}

export default function LocationPickerMap({ visible, initialCoords, onConfirm, onClose }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [seed, setSeed] = useState<Seed | null>(initialCoords ? { ...initialCoords, isFallback: false } : null);
  const [marker, setMarker] = useState<{ lat: number; lng: number } | null>(initialCoords ?? null);
  const [resolvedLabel, setResolvedLabel] = useState<string | undefined>();
  const [resolvingLabel, setResolvingLabel] = useState(false);
  const labelRequestIdRef = useRef(0);
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById(LEAFLET_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = LEAFLET_STYLE_ID;
    style.textContent = LEAFLET_CSS;
    document.head.appendChild(style);
  }, []);

  // Resolve a starting point each time the sheet opens, rather than
  // persisting whatever was last dragged to across opens/cancels.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    async function resolveStart() {
      if (initialCoords) {
        if (!cancelled) {
          setSeed({ ...initialCoords!, isFallback: false });
          setMarker(initialCoords!);
        }
        return;
      }
      setSeed(null);
      setMarker(null);
      const resolved = await resolveApproximateLocation();
      if (!cancelled) {
        setSeed(resolved);
        setMarker({ lat: resolved.lat, lng: resolved.lng });
      }
    }
    resolveStart();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!marker) return;
    const requestId = ++labelRequestIdRef.current;
    async function resolveLabel() {
      setResolvedLabel(undefined);
      setResolvingLabel(true);
      const result = await reverseGeocode(marker!.lat, marker!.lng);
      if (requestId !== labelRequestIdRef.current) return; // superseded by a newer move
      setResolvingLabel(false);
      if ("data" in result) setResolvedLabel(result.data.formattedAddress);
    }
    const timer = setTimeout(resolveLabel, REVERSE_GEOCODE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marker?.lat, marker?.lng]);

  // Not rendered at all while closed (rather than hidden-but-mounted) so
  // MapContainer always initializes against a container that already has
  // its final on-screen size — Leaflet mis-sizes itself if it mounts while
  // its container is display:none/zero-size, which a hidden-but-mounted
  // Modal would otherwise risk.
  if (!visible) return null;

  // A resolved GPS/saved-location start gets a bit more breathing room than
  // the tight fallback zoom — enough to click the pin to a nearby spot
  // without immediately panning off-screen. The Auckland fallback stays
  // tight since it's just a generic city center to start from, not "your
  // area."
  const zoom = seed?.isFallback === false ? 12 : 13;
  const basemap = basemapFor(theme === darkTheme);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.headerButton}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Drop a pin</Text>
          <Pressable onPress={() => marker && onConfirm(marker, resolvedLabel)} hitSlop={8} disabled={!marker}>
            <Text style={[styles.headerButton, styles.headerButtonPrimary, !marker && styles.headerButtonDisabled]}>Use this</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>Click or drag the pin to the exact spot.</Text>
        {resolvingLabel ? (
          <ActivityIndicator size="small" color={theme.textSecondary} style={styles.labelSpinner} />
        ) : resolvedLabel ? (
          <Text style={styles.resolvedLabel}>{resolvedLabel}</Text>
        ) : null}
        {!seed || !marker ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.accentWalk} />
          </View>
        ) : (
          <View style={styles.map}>
            <MapContainer
              center={[seed.lat, seed.lng]}
              zoom={zoom}
              style={{ height: "100%", width: "100%" }}
              className={basemap.isDark ? "cwp-dark-basemap" : undefined}
            >
              <TileLayer url={basemap.url} attribution={basemap.attribution} detectRetina />
              <Marker
                position={[marker.lat, marker.lng]}
                icon={pinDivIcon(theme.accentWalk)}
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
        )}
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
    headerButtonDisabled: { opacity: 0.4 },
    hint: { fontSize: 12, color: theme.textSecondary, textAlign: "center", paddingBottom: 4 },
    labelSpinner: { paddingBottom: 8 },
    resolvedLabel: { fontSize: 13, fontWeight: "600", color: theme.textPrimary, textAlign: "center", paddingBottom: 8 },
    loading: { flex: 1, alignItems: "center", justifyContent: "center" },
    map: { flex: 1 },
  });
}

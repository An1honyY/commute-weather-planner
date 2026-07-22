import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { resolveApproximateLocation } from "../lib/approximateLocation";
import { reverseGeocode } from "../services/placesService";
import useTheme from "../theme/useTheme";

// Map-based location picker — docs/04-screens-navigation.md §4 "Locations"
// bullet's "add via map pin drop," closing the deferral logged in
// DECISIONS.md ("Locations CRUD uses text/number fields, not map pin-drop
// or Places search"). Native (iOS/Android) implementation; see
// LocationPickerMap.web.tsx for the same web-target gap JourneyMap.tsx
// already established a pattern for. A friendlier alternative to typing
// raw coordinates for anyone who doesn't have (or trust) a street address
// for the spot they mean — tap or drag the pin, confirm, done.
//
// When the caller doesn't already know real coordinates (a brand-new
// location, or onboarding's map-pick path), the starting pin is seeded from
// approximateLocation.ts's GPS → saved-default → Auckland chain rather than
// always opening on a fixed Auckland fallback regardless of where the user
// actually is — see DECISIONS.md.
const REVERSE_GEOCODE_DEBOUNCE_MS = 700; // reverseGeocode is a billable Google Geocoding call — wait for the pin to settle before firing, not on every drag/tap

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

  // Reset to the caller's current value each time the sheet opens, rather
  // than persisting whatever was last dragged to across opens/cancels.
  async function handleShow() {
    if (initialCoords) {
      setSeed({ ...initialCoords, isFallback: false });
      setMarker(initialCoords);
      return;
    }
    setSeed(null);
    setMarker(null);
    const resolved = await resolveApproximateLocation();
    setSeed(resolved);
    setMarker({ lat: resolved.lat, lng: resolved.lng });
  }

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

  // A resolved GPS/saved-location start gets a bit more breathing room than
  // the tight fallback zoom — enough to drag the pin to a nearby spot
  // without immediately panning off-screen. The Auckland fallback stays
  // tight since it's just a generic city center to start from, not "your
  // area."
  const delta = seed?.isFallback === false ? 0.08 : 0.05;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={handleShow}>
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
        <Text style={styles.hint}>Tap or drag the pin to the exact spot.</Text>
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
          <MapView
            style={styles.map}
            initialRegion={{ latitude: seed.lat, longitude: seed.lng, latitudeDelta: delta, longitudeDelta: delta }}
            onPress={(event) => {
              const { latitude, longitude } = event.nativeEvent.coordinate;
              setMarker({ lat: latitude, lng: longitude });
            }}
          >
            <Marker
              coordinate={{ latitude: marker.lat, longitude: marker.lng }}
              draggable
              onDragEnd={(event) => {
                const { latitude, longitude } = event.nativeEvent.coordinate;
                setMarker({ lat: latitude, lng: longitude });
              }}
              pinColor={theme.accentWalk}
            />
          </MapView>
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

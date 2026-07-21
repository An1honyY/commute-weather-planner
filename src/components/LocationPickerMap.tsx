import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import useTheme from "../theme/useTheme";

// Map-based location picker — docs/04-screens-navigation.md §4 "Locations"
// bullet's "add via map pin drop," closing the deferral logged in
// DECISIONS.md ("Locations CRUD uses text/number fields, not map pin-drop
// or Places search"). Native (iOS/Android) implementation; see
// LocationPickerMap.web.tsx for the same web-target gap JourneyMap.tsx
// already established a pattern for. A friendlier alternative to typing
// raw coordinates for anyone who doesn't have (or trust) a street address
// for the spot they mean — tap or drag the pin, confirm, done.
const AUCKLAND = { lat: -36.8485, lng: 174.7633 };

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

  // Reset to the caller's current value each time the sheet opens, rather
  // than persisting whatever was last dragged to across opens/cancels.
  function handleShow() {
    setMarker(initialCoords ?? AUCKLAND);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={handleShow}>
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
        <Text style={styles.hint}>Tap or drag the pin to the exact spot.</Text>
        <MapView
          style={styles.map}
          initialRegion={{ latitude: start.lat, longitude: start.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
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
      paddingHorizontal: 16,
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

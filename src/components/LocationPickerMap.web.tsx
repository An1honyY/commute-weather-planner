import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import useTheme from "../theme/useTheme";

// Web fallback for the map-based location picker — same reasoning as
// JourneyMap.web.tsx: react-native-maps isn't guaranteed web-safe, so this
// file (picked up automatically by Metro's platform-extension resolution
// instead of LocationPickerMap.tsx on web builds) never imports it at all,
// keeping the web dev-preview smoke-check safe. There's no map to drop a
// pin on here, so this is close-only — AddressAutocomplete and the
// Advanced lat/lng fields remain the web-usable ways to set a location.
interface Props {
  visible: boolean;
  initialCoords?: { lat: number; lng: number };
  onConfirm: (coords: { lat: number; lng: number }) => void;
  onClose: () => void;
}

export default function LocationPickerMap({ visible, onClose }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Map picker unavailable</Text>
          <Text style={styles.body}>
            Dropping a pin on a map isn&apos;t available in this preview. Use the address search or the Advanced
            coordinates fields instead.
          </Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    sheet: { backgroundColor: theme.surfaceRaised, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, gap: 12 },
    title: { fontSize: 17, fontWeight: "600", color: theme.textPrimary },
    body: { fontSize: 14, color: theme.textSecondary, lineHeight: 20 },
    closeButton: { marginTop: 8, paddingVertical: 12, alignItems: "center", borderRadius: 8, backgroundColor: theme.textPrimary },
    closeLabel: { color: theme.bg, fontWeight: "600" },
  });
}

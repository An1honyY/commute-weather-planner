import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";

// docs/04-screens-navigation.md §4.1 step 1 — explain *why* before
// triggering the OS permission dialog, since a bare OS prompt with no
// context has a much higher deny rate.
interface Props {
  onNext: (coords: { lat: number; lng: number } | undefined) => void;
}

export default function Step1LocationPermission({ onNext }: Props) {
  const [requesting, setRequesting] = useState(false);

  async function allow() {
    setRequesting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        onNext(undefined);
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      onNext({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch {
      onNext(undefined);
    } finally {
      setRequesting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Use your location?</Text>
      <Text style={styles.body}>
        So we can use your current location as a starting point for planning journeys and showing
        today&apos;s conditions.
      </Text>
      <Pressable onPress={allow} disabled={requesting} style={styles.primaryButton}>
        <Text style={styles.primaryLabel}>{requesting ? "Requesting…" : "Allow location"}</Text>
      </Pressable>
      <Pressable onPress={() => onNext(undefined)} style={styles.skipButton}>
        <Text style={styles.skipLabel}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  body: { fontSize: 15, color: "#5C6478", lineHeight: 22 },
  primaryButton: { marginTop: 24, paddingVertical: 14, alignItems: "center", borderRadius: 8, backgroundColor: "#1A1E29" },
  primaryLabel: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
  skipButton: { marginTop: 12, alignItems: "center", paddingVertical: 10 },
  skipLabel: { color: "#5C6478" },
});

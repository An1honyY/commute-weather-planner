import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import AddressAutocomplete from "../../../components/AddressAutocomplete";
import useTheme from "../../../theme/useTheme";

// docs/04-screens-navigation.md §4.1 (2026-07-21 minimal-onboarding
// rework) — onboarding's only forced step. Everything the old 6-step
// wizard asked for beyond a general location (Home/Work, gear basics,
// notification permission, crash reporting) moved to the postponable
// setup checklist on Today (SetupChecklist.tsx) — see DECISIONS.md.
// Keeps the "explain why before the OS permission dialog" principle the
// old Step1LocationPermission established, just as one path among three
// rather than a forced first screen of its own.
interface Props {
  onDone: (location: { lat: number; lng: number; label: string } | undefined) => void;
}

export default function Step1Location({ onDone }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [requesting, setRequesting] = useState(false);
  const [typingAddress, setTypingAddress] = useState(false);
  const [addressText, setAddressText] = useState("");

  async function useCurrentLocation() {
    setRequesting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const position = await Location.getCurrentPositionAsync({});
      onDone({ lat: position.coords.latitude, lng: position.coords.longitude, label: "Current location" });
    } catch {
      // fall through to leaving the screen up — user can retry or skip
    } finally {
      setRequesting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Let&apos;s check the weather where you are</Text>
      <Text style={styles.body}>
        So we can show today&apos;s conditions and suggest what to wear. You can plan real journeys and add your
        own gear later — this is just enough to get started.
      </Text>

      {!typingAddress ? (
        <>
          <Pressable onPress={useCurrentLocation} disabled={requesting} style={styles.primaryButton}>
            {requesting ? (
              <ActivityIndicator color={theme.bg} />
            ) : (
              <Text style={styles.primaryLabel}>Use my current location</Text>
            )}
          </Pressable>
          <Pressable onPress={() => setTypingAddress(true)} style={styles.secondaryButton}>
            <Text style={styles.secondaryLabel}>Type a location instead</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.addressBlock}>
          <AddressAutocomplete
            value={addressText}
            onChangeText={setAddressText}
            onSelectPlace={(result) => onDone({ lat: result.lat, lng: result.lng, label: result.address })}
            placeholder="Suburb or address"
          />
        </View>
      )}

      <Pressable onPress={() => onDone(undefined)} style={styles.skipButton}>
        <Text style={styles.skipLabel}>Skip for now</Text>
      </Pressable>
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: theme.bg },
    title: { fontSize: 22, fontWeight: "700", color: theme.textPrimary },
    body: { fontSize: 15, color: theme.textSecondary, lineHeight: 22 },
    primaryButton: { marginTop: 24, paddingVertical: 14, alignItems: "center", borderRadius: 8, backgroundColor: theme.textPrimary },
    primaryLabel: { color: theme.bg, fontWeight: "600", fontSize: 15 },
    secondaryButton: { marginTop: 12, alignItems: "center", paddingVertical: 10 },
    secondaryLabel: { color: theme.accentWalk, fontSize: 14, fontWeight: "600" },
    addressBlock: { marginTop: 24 },
    skipButton: { marginTop: 20, alignItems: "center", paddingVertical: 10 },
    skipLabel: { color: theme.textSecondary },
  });
}

import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LEAVE_BY_LEAD_MINUTES, requestNotificationPermission } from "../../../lib/notifications";

// docs/07-recommendation-engine.md §7.3 — "request notification permission
// from the onboarding flow... not silently on app launch." Modeled on
// Step1LocationPermission's explain-then-request pattern: skip is always an
// option and never blocks finishing onboarding.
interface Props {
  onNext: () => void;
}

export default function Step6NotificationPermission({ onNext }: Props) {
  const [requesting, setRequesting] = useState(false);

  async function allow() {
    setRequesting(true);
    try {
      await requestNotificationPermission();
    } finally {
      setRequesting(false);
      onNext();
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Get a heads-up before you leave?</Text>
      <Text style={styles.body}>
        We&apos;ll send a reminder about {LEAVE_BY_LEAD_MINUTES} minutes before you need to leave, with a quick
        reminder of what to grab.
      </Text>
      <Pressable onPress={allow} disabled={requesting} style={styles.primaryButton}>
        <Text style={styles.primaryLabel}>{requesting ? "Requesting…" : "Allow notifications"}</Text>
      </Pressable>
      <Pressable onPress={onNext} style={styles.skipButton}>
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

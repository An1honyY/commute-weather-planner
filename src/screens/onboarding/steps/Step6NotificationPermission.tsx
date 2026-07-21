import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LEAVE_BY_LEAD_MINUTES, requestNotificationPermission } from "../../../lib/notifications";
import useTheme from "../../../theme/useTheme";

// docs/07-recommendation-engine.md §7.3 — "request notification permission
// from the onboarding flow... not silently on app launch." Modeled on
// Step1LocationPermission's explain-then-request pattern: skip is always an
// option and never blocks finishing onboarding.
interface Props {
  onNext: () => void;
}

export default function Step6NotificationPermission({ onNext }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
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

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: theme.bg },
    title: { fontSize: 22, fontWeight: "700", color: theme.textPrimary },
    body: { fontSize: 15, color: theme.textSecondary, lineHeight: 22 },
    primaryButton: { marginTop: 24, paddingVertical: 14, alignItems: "center", borderRadius: 8, backgroundColor: theme.textPrimary },
    primaryLabel: { color: theme.bg, fontWeight: "600", fontSize: 15 },
    skipButton: { marginTop: 12, alignItems: "center", paddingVertical: 10 },
    skipLabel: { color: theme.textSecondary },
  });
}

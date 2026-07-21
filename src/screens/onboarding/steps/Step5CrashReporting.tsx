import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { setCrashReportingEnabled } from "../../../db/repositories/settings";
import { withTimeout } from "../../../lib/withTimeout";

// docs/04-screens-navigation.md §4.1 step 5 — a single toggle, defaulted
// off, changeable later in Settings (Phase 5). Skipping this step leaves
// it off, same as declining it explicitly.
interface Props {
  onFinish: () => void;
}

export default function Step5CrashReporting({ onFinish }: Props) {
  const [enabled, setEnabled] = useState(false);

  async function finish() {
    await withTimeout(setCrashReportingEnabled(enabled), undefined);
    onFinish();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crash reporting</Text>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={styles.body}>
            Send anonymous crash reports to help us fix bugs. Off by default — you can change this
            anytime in Settings.
          </Text>
        </View>
        <Switch value={enabled} onValueChange={setEnabled} />
      </View>
      <Pressable onPress={finish} style={styles.primaryButton}>
        <Text style={styles.primaryLabel}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 },
  textCol: { flex: 1 },
  body: { fontSize: 14, color: "#5C6478", lineHeight: 20 },
  primaryButton: { marginTop: 24, paddingVertical: 14, alignItems: "center", borderRadius: 8, backgroundColor: "#1A1E29" },
  primaryLabel: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
});

import { SafeAreaView, StyleSheet, Text, View } from "react-native";

// Reverse-chronological read-only journey list — docs/04-screens-navigation.md
// §4.4. Reads real Journey rows starting Phase 9; this is the Phase 1 empty
// shell.
export default function HistoryScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.empty}>No past journeys yet</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontSize: 20, fontWeight: "600" },
  empty: { color: "#666" },
});

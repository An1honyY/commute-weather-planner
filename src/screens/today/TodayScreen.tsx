import { SafeAreaView, StyleSheet, Text, View } from "react-native";

// Home/dashboard tab — docs/04-screens-navigation.md item 1. The "Right
// now" card, journey list, and "Leaving now" action land in later phases
// (Section 4.2, Phase 5); this is the empty-state shell from Phase 1.
export default function TodayScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.empty}>No journeys yet — plan your first one</Text>
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

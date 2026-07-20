import { SafeAreaView, StyleSheet, Text, View } from "react-native";

// Journey planner tab — docs/04-screens-navigation.md item 2. Wired to a
// hardcoded Journey object in Phase 3; this is the Phase 1 empty shell.
export default function PlanScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Plan</Text>
        <Text style={styles.empty}>Journey planning coming soon</Text>
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

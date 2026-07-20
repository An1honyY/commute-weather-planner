import { SafeAreaView, StyleSheet, Text, View } from "react-native";

// First-run stack — docs/04-screens-navigation.md §4.1. The 5-step flow
// (location priming, Home/Work, live demo card, gear basics, crash-report
// opt-in) is built in Phase 2; this is the Phase 1 empty shell.
export default function OnboardingScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome</Text>
        <Text style={styles.empty}>Onboarding coming soon</Text>
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

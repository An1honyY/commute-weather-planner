import { SafeAreaView, StyleSheet, Text, View } from "react-native";

// EnvironmentAnnotation manage/list screen — docs/04-screens-navigation.md
// §4.5. Add/edit flow (map long-press sheet) lands in Phase 6; this is the
// Phase 1 empty shell.
export default function LocalKnowledgeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Local knowledge</Text>
        <Text style={styles.empty}>
          No local knowledge yet — long-press anywhere on a journey&apos;s map to
          mark a windy corner, a covered walkway, or a sunny stretch.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 32 },
  title: { fontSize: 20, fontWeight: "600" },
  empty: { color: "#666", textAlign: "center" },
});

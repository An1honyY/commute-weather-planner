import { SafeAreaView, StyleSheet, Text, View } from "react-native";

// SavedLocation CRUD list — docs/04-screens-navigation.md item 3. Full
// add/edit/delete flow lands in Phase 2; this is the Phase 1 empty shell.
// The header's Local knowledge entry point (Section 4.5) is wired via
// RootNavigator, not here.
export default function LocationsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Locations</Text>
        <Text style={styles.empty}>No locations yet — add Home and Work first</Text>
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

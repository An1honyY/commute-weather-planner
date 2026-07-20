import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";

// Core screen — fully specced in docs/09-design-system.md §9.3. Map, gear
// recommendation card, and leg list land in Phase 3+; this is the Phase 1
// empty shell.
type Props = NativeStackScreenProps<RootStackParamList, "JourneyDetail">;

export default function JourneyDetailScreen({ route }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Journey Detail</Text>
        <Text style={styles.empty}>Journey {route.params.journeyId}</Text>
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

import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

// Inventory manager tab, sub-tabbed by Vehicles/Clothing/Shoes/Umbrellas —
// docs/04-screens-navigation.md item 4. Each sub-tab is a simple CRUD list
// in Phase 2; this is the Phase 1 empty shell per sub-tab.
const SUB_TABS = ["Vehicles", "Clothing", "Shoes", "Umbrellas"] as const;
type SubTab = (typeof SUB_TABS)[number];

const EMPTY_LABEL: Record<SubTab, string> = {
  Vehicles: "No vehicles yet — add your first one",
  Clothing: "No clothing yet — add your first item",
  Shoes: "No shoes yet — add your first pair",
  Umbrellas: "No umbrellas yet — add your first one",
};

export default function GearScreen() {
  const [activeTab, setActiveTab] = useState<SubTab>("Clothing");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabBar}>
        {SUB_TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.content}>
        <Text style={styles.empty}>{EMPTY_LABEL[activeTab]}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabButtonActive: { borderBottomWidth: 2, borderBottomColor: "#333" },
  tabLabel: { color: "#888" },
  tabLabelActive: { color: "#333", fontWeight: "600" },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: "#666" },
});

import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import ClothingList from "./ClothingList";
import ShoeList from "./ShoeList";
import UmbrellaList from "./UmbrellaList";
import VehicleList from "./VehicleList";

// Inventory manager tab, sub-tabbed by Vehicles/Clothing/Shoes/Umbrellas —
// docs/04-screens-navigation.md item 4. Full add/edit/delete per sub-tab
// (Phase 2).
const SUB_TABS = ["Vehicles", "Clothing", "Shoes", "Umbrellas"] as const;
type SubTab = (typeof SUB_TABS)[number];

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
      {activeTab === "Clothing" && <ClothingList />}
      {activeTab === "Shoes" && <ShoeList />}
      {activeTab === "Umbrellas" && <UmbrellaList />}
      {activeTab === "Vehicles" && <VehicleList />}
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
});

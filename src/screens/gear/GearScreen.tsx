import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import ClothingList from "./ClothingList";
import ShoeList from "./ShoeList";
import UmbrellaList from "./UmbrellaList";
import VehicleList from "./VehicleList";
import useTheme from "../../theme/useTheme";
import type { MainTabParamList } from "../../navigation/types";

// Inventory manager tab, sub-tabbed by Vehicles/Clothing/Shoes/Umbrellas —
// docs/04-screens-navigation.md item 4. Full add/edit/delete per sub-tab
// (Phase 2).
const SUB_TABS = ["Vehicles", "Clothing", "Shoes", "Umbrellas"] as const;
type SubTab = (typeof SUB_TABS)[number];

type Props = BottomTabScreenProps<MainTabParamList, "Gear">;

// §9.6 — GearRecommendationCard's fallback slots navigate here with
// route.params.openAdd to jump straight into the right sub-tab's add form.
function subTabFor(openAdd: NonNullable<Props["route"]["params"]>["openAdd"]): SubTab | undefined {
  if (!openAdd) return undefined;
  if (openAdd.kind === "clothing") return "Clothing";
  if (openAdd.kind === "shoe") return "Shoes";
  return "Umbrellas";
}

export default function GearScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const openAdd = route.params?.openAdd;
  const [activeTab, setActiveTab] = useState<SubTab>(subTabFor(openAdd) ?? "Clothing");

  // "Adjusting state when a prop changes" (React's render-time pattern,
  // not an effect) — jump to the right sub-tab as soon as a new openAdd
  // target arrives, tracked via the previous-value comparison so this
  // doesn't refire on every re-render.
  const [consumedOpenAdd, setConsumedOpenAdd] = useState(openAdd);
  if (openAdd !== consumedOpenAdd) {
    setConsumedOpenAdd(openAdd);
    const target = subTabFor(openAdd);
    if (target) setActiveTab(target);
  }

  // Consume openAdd once so re-focusing this tab later (e.g. after adding
  // the item and navigating back) doesn't reopen the add form again.
  // navigation.setParams touches state outside this component, so it
  // belongs in an effect rather than the render-time adjustment above.
  useEffect(() => {
    if (route.params?.openAdd) navigation.setParams({ openAdd: undefined });
  }, [route.params?.openAdd, navigation]);

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
      {activeTab === "Clothing" && (
        <ClothingList autoOpenAddType={openAdd?.kind === "clothing" ? openAdd.clothingType : undefined} />
      )}
      {activeTab === "Shoes" && <ShoeList autoOpenAdd={openAdd?.kind === "shoe"} />}
      {activeTab === "Umbrellas" && <UmbrellaList autoOpenAdd={openAdd?.kind === "umbrella"} />}
      {activeTab === "Vehicles" && <VehicleList />}
    </SafeAreaView>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.border },
    tabButton: { flex: 1, paddingVertical: 12, alignItems: "center" },
    tabButtonActive: { borderBottomWidth: 2, borderBottomColor: theme.textPrimary },
    tabLabel: { color: theme.textSecondary },
    tabLabelActive: { color: theme.textPrimary, fontWeight: "600" },
  });
}

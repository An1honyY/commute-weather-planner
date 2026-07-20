import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, Text, View } from "react-native";
import TodayScreen from "../screens/today/TodayScreen";
import PlanScreen from "../screens/plan/PlanScreen";
import LocationsScreen from "../screens/locations/LocationsScreen";
import GearScreen from "../screens/gear/GearScreen";
import type { MainTabParamList, RootStackParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

// Small text-button header icons stand in for the real iconography from
// docs/09-design-system.md until that pass lands — functionally these are
// the History (§4.4), Settings (§9.1 — "reached from the Today tab header,
// alongside the History icon"), and Local knowledge (§4.5) entry points.
function TodayHeaderButtons() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={{ flexDirection: "row", gap: 16 }}>
      <Pressable onPress={() => navigation.navigate("Settings")} hitSlop={8}>
        <Text>Settings</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate("History")} hitSlop={8}>
        <Text>History</Text>
      </Pressable>
    </View>
  );
}

function LocalKnowledgeButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable onPress={() => navigation.navigate("LocalKnowledge")} hitSlop={8}>
      <Text>Local knowledge</Text>
    </Pressable>
  );
}

// Today and Plan are the initial routes; Locations and Gear lazy-load per
// docs/04-screens-navigation.md §4 (React Navigation's default for
// non-focused tab screens).
export default function MainTabs() {
  return (
    <Tab.Navigator initialRouteName="Today">
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{ headerRight: TodayHeaderButtons }}
      />
      <Tab.Screen name="Plan" component={PlanScreen} />
      <Tab.Screen
        name="Locations"
        component={LocationsScreen}
        options={{ headerRight: LocalKnowledgeButton }}
      />
      <Tab.Screen name="Gear" component={GearScreen} />
    </Tab.Navigator>
  );
}

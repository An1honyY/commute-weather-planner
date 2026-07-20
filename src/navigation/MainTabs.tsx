import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, Text } from "react-native";
import TodayScreen from "../screens/today/TodayScreen";
import PlanScreen from "../screens/plan/PlanScreen";
import LocationsScreen from "../screens/locations/LocationsScreen";
import GearScreen from "../screens/gear/GearScreen";
import type { MainTabParamList, RootStackParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

// Small text-button header icons stand in for the real iconography from
// docs/09-design-system.md until that pass lands — functionally these are
// the History (Section 4.4) and Local knowledge (Section 4.5) entry points
// docs/04-screens-navigation.md items 1 and 3 call for.
function HistoryButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable onPress={() => navigation.navigate("History")} hitSlop={8}>
      <Text>History</Text>
    </Pressable>
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
        options={{ headerRight: HistoryButton }}
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

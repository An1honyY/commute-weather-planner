import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, View } from "react-native";
import TodayScreen from "../screens/today/TodayScreen";
import PlanScreen from "../screens/plan/PlanScreen";
import LocationsScreen from "../screens/locations/LocationsScreen";
import GearScreen from "../screens/gear/GearScreen";
import NavIcon from "../components/NavIcon";
import useTheme from "../theme/useTheme";
import type { MainTabParamList, RootStackParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

// docs/09-design-system.md §9.1 (2026-07-22) — real iconography, closing
// the gap this file's own comment used to flag ("small text-button header
// icons stand in... until that pass lands," see DECISIONS.md). Header
// buttons use theme.textPrimary (matching the header title's color, not
// the accent — accent stays reserved for the active tab / primary
// interactive emphasis elsewhere in the app); tab bar tint colors are set
// once in screenOptions below and read back here via the {color} render
// prop rather than each icon re-deriving focused/unfocused itself.
// 2026-07-22 polish pass — buttons/borders were sitting too close to screen
// edges throughout the app; this header row and the tab bar below both
// needed their own explicit breathing room, not just the screen-edge
// padding bump every screen's container got (see DECISIONS.md).
const headerButtonStyle = { minHeight: 44, minWidth: 44, alignItems: "center" as const, justifyContent: "center" as const };
const headerButtonRowStyle = { flexDirection: "row" as const, gap: 8, marginRight: 4 };

function TodayHeaderButtons() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={headerButtonRowStyle}>
      <Pressable
        onPress={() => navigation.navigate("Settings")}
        style={headerButtonStyle}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <NavIcon kind="settings" size={22} color={theme.textPrimary} />
      </Pressable>
      <Pressable
        onPress={() => navigation.navigate("History")}
        style={headerButtonStyle}
        accessibilityRole="button"
        accessibilityLabel="History"
      >
        <NavIcon kind="history" size={22} color={theme.textPrimary} />
      </Pressable>
    </View>
  );
}

function LocalKnowledgeButton() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={headerButtonRowStyle}>
      <Pressable
        onPress={() => navigation.navigate("LocalKnowledge")}
        style={headerButtonStyle}
        accessibilityRole="button"
        accessibilityLabel="Local knowledge"
      >
        <NavIcon kind="localKnowledge" size={22} color={theme.textPrimary} />
      </Pressable>
    </View>
  );
}

// Today and Plan are the initial routes; Locations and Gear lazy-load per
// docs/04-screens-navigation.md §4 (React Navigation's default for
// non-focused tab screens).
export default function MainTabs() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      initialRouteName="Today"
      screenOptions={{
        tabBarActiveTintColor: theme.accentWalk,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{
          headerRight: TodayHeaderButtons,
          tabBarIcon: ({ color, size }) => <NavIcon kind="today" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Plan"
        component={PlanScreen}
        options={{ tabBarIcon: ({ color, size }) => <NavIcon kind="plan" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Locations"
        component={LocationsScreen}
        options={{
          headerRight: LocalKnowledgeButton,
          tabBarIcon: ({ color, size }) => <NavIcon kind="locations" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Gear"
        component={GearScreen}
        options={{ tabBarIcon: ({ color, size }) => <NavIcon kind="gear" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

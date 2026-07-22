import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, Text, View } from "react-native";
import TodayScreen from "../screens/today/TodayScreen";
import PlanScreen from "../screens/plan/PlanScreen";
import LocationsScreen from "../screens/locations/LocationsScreen";
import GearScreen from "../screens/gear/GearScreen";
import NavIcon from "../components/NavIcon";
import useTheme from "../theme/useTheme";
import type { MainTabParamList, RootStackParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

// docs/09-design-system.md §9.1 (2026-07-22) — real iconography for the
// bottom tab bar and header buttons, closing the gap this file's own
// comment used to flag ("small text-button header icons stand in... until
// that pass lands," see DECISIONS.md). Header buttons went icon-only, were
// corrected to text-only the same day, then back to icon-only again once
// the "settings" glyph itself was fixed (sliders → an actual cog, per
// explicit request) — see DECISIONS.md for the full back-and-forth. Header
// buttons use theme.textPrimary (matching the header title's color, not
// the accent — accent stays reserved for the active tab / primary
// interactive emphasis elsewhere in the app).
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

// React Navigation's own default tab-bar label wrapper collapses to a
// fixed ~7px height with overflow:hidden on web (verified via computed
// styles — not something tabBarLabelStyle's fontSize/lineHeight actually
// controls, on this platform), clipping every label down to a sliver
// instead of just a descender. Rendering the label ourselves via
// `tabBarLabel` sidesteps that internal sizing entirely rather than
// fighting it with more style overrides.
function TabLabel({ children, color }: { children: string; color: string }) {
  return <Text style={{ fontSize: 11, fontWeight: "600", color, marginTop: 2, lineHeight: 14 }}>{children}</Text>;
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
          height: 62,
          paddingTop: 8,
          paddingBottom: 8,
        },
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayScreen}
        options={{
          headerRight: TodayHeaderButtons,
          tabBarIcon: ({ color, size }) => <NavIcon kind="today" size={size} color={color} />,
          tabBarLabel: ({ color }) => <TabLabel color={color}>Today</TabLabel>,
        }}
      />
      <Tab.Screen
        name="Plan"
        component={PlanScreen}
        options={{
          tabBarIcon: ({ color, size }) => <NavIcon kind="plan" size={size} color={color} />,
          tabBarLabel: ({ color }) => <TabLabel color={color}>Plan</TabLabel>,
        }}
      />
      <Tab.Screen
        name="Locations"
        component={LocationsScreen}
        options={{
          headerRight: LocalKnowledgeButton,
          tabBarIcon: ({ color, size }) => <NavIcon kind="locations" size={size} color={color} />,
          tabBarLabel: ({ color }) => <TabLabel color={color}>Locations</TabLabel>,
        }}
      />
      <Tab.Screen
        name="Gear"
        component={GearScreen}
        options={{
          tabBarIcon: ({ color, size }) => <NavIcon kind="gear" size={size} color={color} />,
          tabBarLabel: ({ color }) => <TabLabel color={color}>Gear</TabLabel>,
        }}
      />
    </Tab.Navigator>
  );
}

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
// bottom tab bar, closing the gap this file's own comment used to flag
// ("small text-button header icons stand in... until that pass lands,"
// see DECISIONS.md). Header buttons (Settings/History/Local knowledge)
// went icon-only in that same pass and were corrected back to text labels
// the same day — icons alone read as less clear here, and the header has
// room for real words. Tab bar tint colors are set once in screenOptions
// below and read back via the {color} render prop rather than each icon
// re-deriving focused/unfocused itself.
const headerButtonStyle = { minHeight: 44, paddingHorizontal: 10, alignItems: "center" as const, justifyContent: "center" as const };
const headerButtonRowStyle = { flexDirection: "row" as const, gap: 4, marginRight: 4 };

function TodayHeaderButtons() {
  const theme = useTheme();
  const styles = { label: { color: theme.textPrimary, fontWeight: "600" as const, fontSize: 13 } };
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={headerButtonRowStyle}>
      <Pressable
        onPress={() => navigation.navigate("Settings")}
        style={headerButtonStyle}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <Text style={styles.label}>Settings</Text>
      </Pressable>
      <Pressable
        onPress={() => navigation.navigate("History")}
        style={headerButtonStyle}
        accessibilityRole="button"
        accessibilityLabel="History"
      >
        <Text style={styles.label}>History</Text>
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
        <Text style={{ color: theme.textPrimary, fontWeight: "600" as const, fontSize: 13 }}>Local knowledge</Text>
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

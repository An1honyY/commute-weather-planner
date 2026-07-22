import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import OnboardingScreen from "../screens/onboarding/OnboardingScreen";
import JourneyDetailScreen from "../screens/journey-detail/JourneyDetailScreen";
import HistoryScreen from "../screens/history/HistoryScreen";
import LocalKnowledgeScreen from "../screens/local-knowledge/LocalKnowledgeScreen";
import SettingsScreen from "../screens/settings/SettingsScreen";
import GearBasicsSetup from "../screens/setup/GearBasicsSetup";
import NotificationsSetup from "../screens/setup/NotificationsSetup";
import DevMenuScreen from "../screens/dev/DevMenuScreen";
import HeaderBackButton from "./HeaderBackButton";
import useTheme from "../theme/useTheme";
import { darkTheme } from "../theme/tokens";
import type { RootStackParamList } from "./types";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Thin wrappers: GearBasicsSetup/NotificationsSetup take a plain onDone()
// callback (shared with the pre-2026-07-21 onboarding wizard, which called
// it to advance to the next step) — here it just means "go back to
// wherever SetupChecklist sent us from."
function SetupGearBasicsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "SetupGearBasics">) {
  return <GearBasicsSetup onDone={() => navigation.goBack()} />;
}

function SetupNotificationsScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "SetupNotifications">) {
  return <NotificationsSetup onDone={() => navigation.goBack()} />;
}

interface Props {
  // True when app_settings.onboarding_completed isn't set yet —
  // docs/04-screens-navigation.md §4.1; see DECISIONS.md ("Onboarding gate
  // uses an explicit completed flag") for why this isn't derived from
  // Inventory/SavedLocation row counts. Defaults to false so a caller that
  // doesn't pass it (e.g. an isolated test render) lands on Main.
  needsOnboarding?: boolean;
}

export default function RootNavigator({ needsOnboarding = false }: Props) {
  const theme = useTheme();
  const isDark = theme === darkTheme;
  // §9.1 — resolved token object already reflects system/light/dark, so
  // React Navigation's own chrome (headers, tab bar) just needs its colors
  // mapped from the same source rather than tracking theme separately.
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: theme.accentWalk,
      background: theme.bg,
      card: theme.surface,
      text: theme.textPrimary,
      border: theme.border,
      notification: theme.conditionStorm,
    },
  };
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName={needsOnboarding ? "Onboarding" : "Main"}
        screenOptions={({ navigation }) => ({
          // §9.1 — themed header chrome + a custom accent back control
          // (HeaderBackButton) in place of the bare OS-native arrow, giving
          // the pushed screens a consistent, colourful header rather than
          // the plain black-on-white default (especially in light mode).
          headerStyle: { backgroundColor: theme.headerBg },
          headerTitleStyle: { color: theme.textPrimary },
          headerTintColor: theme.accentWalk,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal" as const,
          headerLeft: () =>
            navigation.canGoBack() ? <HeaderBackButton onPress={() => navigation.goBack()} /> : null,
        })}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="JourneyDetail" component={JourneyDetailScreen} options={{ title: "Journey" }} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="LocalKnowledge" component={LocalKnowledgeScreen} options={{ title: "Local knowledge" }} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="SetupGearBasics" component={SetupGearBasicsScreen} options={{ title: "Add gear basics" }} />
        <Stack.Screen name="SetupNotifications" component={SetupNotificationsScreen} options={{ title: "Notifications" }} />
        {/* docs/12-dev-workflow-ci.md §12.2 — only registered in dev/preview
            builds; `__DEV__` compiles to a literal `false` in release,
            so this branch (and DevMenuScreen's own code) is dead-code-
            eliminated rather than merely hidden behind a runtime check. */}
        {__DEV__ && <Stack.Screen name="DevMenu" component={DevMenuScreen} options={{ title: "Debug menu" }} />}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

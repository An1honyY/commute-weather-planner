import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import OnboardingScreen from "../screens/onboarding/OnboardingScreen";
import JourneyDetailScreen from "../screens/journey-detail/JourneyDetailScreen";
import HistoryScreen from "../screens/history/HistoryScreen";
import LocalKnowledgeScreen from "../screens/local-knowledge/LocalKnowledgeScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

interface Props {
  // True when app_settings.onboarding_completed isn't set yet —
  // docs/04-screens-navigation.md §4.1; see DECISIONS.md ("Onboarding gate
  // uses an explicit completed flag") for why this isn't derived from
  // Inventory/SavedLocation row counts. Defaults to false so a caller that
  // doesn't pass it (e.g. an isolated test render) lands on Main.
  needsOnboarding?: boolean;
}

export default function RootNavigator({ needsOnboarding = false }: Props) {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={needsOnboarding ? "Onboarding" : "Main"}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="JourneyDetail" component={JourneyDetailScreen} options={{ title: "Journey" }} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="LocalKnowledge" component={LocalKnowledgeScreen} options={{ title: "Local knowledge" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

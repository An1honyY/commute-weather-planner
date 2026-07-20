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
  // True when there's no Inventory and no SavedLocation rows at all —
  // docs/04-screens-navigation.md §4.1. Wired to real onboarding-state
  // storage in Phase 2; defaults to false so Phase 1 lands on Main.
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

import { useCallback, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { materializeTodaysJourneys } from "../../lib/materializeToday";
import type { RootStackParamList } from "../../navigation/types";
import type { Journey } from "../../types";
import RightNowCard from "./RightNowCard";
import JourneyCard from "./JourneyCard";
import useTheme from "../../theme/useTheme";

// Home/dashboard tab — docs/04-screens-navigation.md item 1, wired to real
// recurring-journey materialization and the reduced "Right now" path
// (docs/08-build-phases.md Phase 5).
export default function TodayScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [journeys, setJourneys] = useState<Journey[] | null>(null);
  // Date.now() is impure to call during render — a useState lazy
  // initializer (react-hooks/purity) only runs once at mount.
  const [nowMs] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      materializeTodaysJourneys().then(setJourneys);
    }, [])
  );

  function openJourney(id: string) {
    navigation.navigate("JourneyDetail", { journeyId: id });
  }

  // §4.2 — the nearest *upcoming* departure gets the "Leaving now" action,
  // not just the first journey in the list (which may already be running
  // or past).
  const nextUpId = journeys
    ?.filter((j) => new Date(j.departTime).getTime() > nowMs)
    .sort((a, b) => new Date(a.departTime).getTime() - new Date(b.departTime).getTime())[0]?.id;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <RightNowCard />

        {journeys === null ? null : journeys.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.empty}>No journeys yet — plan your first one</Text>
          </View>
        ) : (
          journeys.map((journey) => (
            <JourneyCard
              key={journey.id}
              journey={journey}
              isNextUp={journey.id === nextUpId}
              onPress={() => openJourney(journey.id)}
              // §4.2 — cancelling the scheduled leave-by notification here
              // is Phase 8 (notifications don't exist yet); this already
              // does the tap's other job, opening Journey Detail directly.
              onLeavingNow={() => openJourney(journey.id)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    content: { padding: 16 },
    emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 48 },
    empty: { color: theme.textSecondary },
  });
}

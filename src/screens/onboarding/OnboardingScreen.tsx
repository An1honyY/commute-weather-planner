import { SafeAreaView, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setDefaultLocation, setOnboardingCompleted } from "../../db/repositories/settings";
import { withTimeout } from "../../lib/withTimeout";
import type { RootStackParamList } from "../../navigation/types";
import Step1Location from "./steps/Step1Location";

// First-run flow — docs/04-screens-navigation.md §4.1 (2026-07-21 minimal-
// onboarding rework, see DECISIONS.md). Previously a 6-step wizard
// (location permission, Home/Work, live demo, gear basics, crash
// reporting, notifications); now a single "where are you?" step so a user
// reaches a working app — real current-location weather and generic gear
// suggestions — with the absolute minimum friction. Everything else
// (Home/Work, real gear, notifications) moves to the postponable
// SetupChecklist on Today rather than blocking first launch.
type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

export default function OnboardingScreen({ navigation }: Props) {
  async function finish(location: { lat: number; lng: number; label: string } | undefined) {
    const jobs: Promise<unknown>[] = [setOnboardingCompleted()];
    if (location) jobs.push(setDefaultLocation(location));
    await withTimeout(Promise.all(jobs), []);
    // reset, not navigate — onboarding shouldn't be reachable via back-nav
    // once finished.
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  }

  return (
    <SafeAreaView style={styles.container}>
      <Step1Location onDone={finish} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

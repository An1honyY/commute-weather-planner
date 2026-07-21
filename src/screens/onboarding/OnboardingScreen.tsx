import { useState } from "react";
import { SafeAreaView, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { setOnboardingCompleted } from "../../db/repositories/settings";
import { withTimeout } from "../../lib/withTimeout";
import type { RootStackParamList } from "../../navigation/types";
import Step1LocationPermission from "./steps/Step1LocationPermission";
import Step2HomeWork from "./steps/Step2HomeWork";
import Step3LiveDemo from "./steps/Step3LiveDemo";
import Step4GearBasics from "./steps/Step4GearBasics";
import Step5CrashReporting from "./steps/Step5CrashReporting";
import Step6NotificationPermission from "./steps/Step6NotificationPermission";

// First-run stack — docs/04-screens-navigation.md §4.1. A single component
// stepping through an internal index rather than five separate nav-stack
// screens: every step is linear and skippable-with-default-forward, so
// there's no branching or back-navigation need a real stack buys here, and
// keeping shared state (the location fix from step 1, feeding step 2/3)
// is simpler as component state than as nav params. Country-outside-NZ
// detection (the regional-scope notice, §2.1) needs reverse geocoding,
// which isn't wired until Phase 4 — deferred, not dropped.
type Props = NativeStackScreenProps<RootStackParamList, "Onboarding">;

export default function OnboardingScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | undefined>(undefined);

  async function finish() {
    await withTimeout(setOnboardingCompleted(), undefined);
    // reset, not navigate — onboarding shouldn't be reachable via back-nav
    // once finished.
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  }

  return (
    <SafeAreaView style={styles.container}>
      {step === 0 && (
        <Step1LocationPermission
          onNext={(nextCoords) => {
            setCoords(nextCoords);
            setStep(1);
          }}
        />
      )}
      {step === 1 && <Step2HomeWork currentCoords={coords} onNext={() => setStep(2)} />}
      {step === 2 && <Step3LiveDemo coords={coords} onNext={() => setStep(3)} />}
      {step === 3 && <Step4GearBasics onNext={() => setStep(4)} />}
      {step === 4 && <Step5CrashReporting onFinish={() => setStep(5)} />}
      {step === 5 && <Step6NotificationPermission onNext={finish} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

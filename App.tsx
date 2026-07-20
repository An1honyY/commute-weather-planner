import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getDb } from "./src/db";
import { isOnboardingCompleted } from "./src/db/repositories/settings";
import RootNavigator from "./src/navigation/RootNavigator";

const queryClient = new QueryClient();
const STARTUP_TIMEOUT_MS = 5000;

// expo-sqlite's web backend can hang without resolving or rejecting when
// the dev server doesn't set the COOP/COEP headers it wants for OPFS —
// guard any DB-dependent startup step with a timeout so the app still
// renders for a quick web smoke-check rather than spinning forever, with a
// safe default value if the read never completes. Native iOS/Android
// builds resolve immediately and never hit this race.
function withStartupTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  const timeout = new Promise<T>((resolve) => setTimeout(() => resolve(fallback), STARTUP_TIMEOUT_MS));
  return Promise.race([promise, timeout]).catch(() => fallback);
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    withStartupTimeout(getDb(), null)
      .then(() => withStartupTimeout(isOnboardingCompleted(), false))
      .then((completed) => setNeedsOnboarding(!completed))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <RootNavigator needsOnboarding={needsOnboarding} />
        <StatusBar style="auto" />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

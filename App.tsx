import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getDb } from "./src/db";
import { isOnboardingCompleted } from "./src/db/repositories/settings";
import RootNavigator from "./src/navigation/RootNavigator";
import { withTimeout } from "./src/lib/withTimeout";
import { freezeJourneyByIdIfDue } from "./src/lib/leaveBy";

const queryClient = new QueryClient();

export default function App() {
  const [ready, setReady] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // Guard the DB-dependent startup steps with a timeout so the app still
    // renders rather than spinning forever if getDb() never resolves — a
    // defense-in-depth backstop (see withTimeout.ts); the wasm bundling bug
    // that used to make this hang on every web load is now fixed in
    // metro.config.js (DECISIONS.md).
    withTimeout(getDb(), null)
      .then(() => withTimeout(isOnboardingCompleted(), false))
      .then((completed) => setNeedsOnboarding(!completed))
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    // §7.3/§3 — the same moment a leave-by notification actually fires is
    // when RecommendationSnapshot gets frozen and recordWear() runs. This
    // only catches delivery while the app process is alive (foreground or
    // backgrounded) — Journey Detail's freezeIfDue() fallback (src/lib/leaveBy.ts)
    // covers the case where the app was fully killed and this listener
    // never ran (see DECISIONS.md).
    try {
      const subscription = Notifications.addNotificationReceivedListener((notification) => {
        const journeyId = notification.request.content.data?.journeyId;
        if (typeof journeyId === "string") {
          freezeJourneyByIdIfDue(journeyId).catch(() => {});
        }
      });
      return () => subscription.remove();
    } catch {
      // expo-notifications' listener APIs aren't supported on every
      // platform (e.g. web) — Journey Detail's freezeIfDue() fallback still
      // covers the freeze/recordWear path there.
      return undefined;
    }
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

import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { listLocations } from "../../db/repositories/locations";
import { listAllJourneys } from "../../db/repositories/journeys";
import { listClothing } from "../../db/repositories/clothing";
import { listShoes } from "../../db/repositories/shoes";
import { listUmbrellas } from "../../db/repositories/umbrellas";
import { dismissSetupTask, getDismissedSetupTasks } from "../../db/repositories/settings";
import { cardElevationStyle } from "../../theme/tokens";
import useTheme from "../../theme/useTheme";
import type { RootStackParamList } from "../../navigation/types";

// docs/04-screens-navigation.md §4.1 (2026-07-21 minimal-onboarding
// rework) — the postponable setup hints that replace the old forced
// wizard's Home/Work, gear-basics, and notification-permission steps. Each
// task's "done" state is derived live from real data (any SavedLocation,
// any Journey, any inventory item, actual OS notification permission)
// rather than a stored flag — self-heals if the user adds things outside
// this checklist (e.g. via the Gear tab directly) and never drifts out of
// sync with reality, matching the "don't re-derive what a flag already
// tracks, but don't invent a flag where live data already answers the
// question" balance this codebase strikes elsewhere (see DECISIONS.md's
// "Onboarding gate" entry for the other side of that same judgment call —
// that one *does* need an explicit flag, since a fully-skipped run leaves
// no data trail at all). Dismissal ("Not now") is the only state that
// needs persisting, since "postpone indefinitely" has no snooze-until to
// track.
interface TaskDef {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  done: boolean;
  onPress: () => void;
}

export default function SetupChecklist() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [hasLocations, setHasLocations] = useState(true);
  const [hasJourneys, setHasJourneys] = useState(true);
  const [hasGear, setHasGear] = useState(true);
  const [notificationsGranted, setNotificationsGranted] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function load() {
        const [dismissedIds, locations, journeys, clothing, shoes, umbrellas, notificationPermission] = await Promise.all([
          getDismissedSetupTasks(),
          listLocations(),
          listAllJourneys(),
          listClothing(),
          listShoes(),
          listUmbrellas(),
          Notifications.getPermissionsAsync().catch(() => ({ status: "undetermined" as const })),
        ]);
        if (cancelled) return;
        setDismissed(dismissedIds);
        setHasLocations(locations.length > 0);
        setHasJourneys(journeys.length > 0);
        setHasGear(clothing.length > 0 || shoes.length > 0 || umbrellas.length > 0);
        setNotificationsGranted(notificationPermission.status === "granted");
        setLoaded(true);
      }

      load();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function dismiss(id: string) {
    setDismissed((prev) => [...prev, id]);
    await dismissSetupTask(id);
  }

  const tasks: TaskDef[] = [
    {
      id: "locations",
      title: "Add Home and Work",
      description: "Almost every journey starts from one of these.",
      ctaLabel: "Add",
      done: hasLocations,
      onPress: () => navigation.navigate("Main", { screen: "Locations" }),
    },
    {
      id: "journey",
      title: "Plan your first journey",
      description: "Real per-leg weather and gear picks for an actual commute.",
      ctaLabel: "Plan",
      done: hasJourneys,
      onPress: () => navigation.navigate("Main", { screen: "Plan" }),
    },
    {
      id: "gear",
      title: "Add your gear",
      description: "So recommendations point at things you actually own, not generic suggestions.",
      ctaLabel: "Add",
      done: hasGear,
      onPress: () => navigation.navigate("SetupGearBasics"),
    },
    {
      id: "notifications",
      title: "Turn on notifications",
      description: "A heads-up with what to grab before you need to leave.",
      ctaLabel: "Turn on",
      done: notificationsGranted,
      onPress: () => navigation.navigate("SetupNotifications"),
    },
  ];

  const visible = tasks.filter((t) => !t.done && !dismissed.includes(t.id));

  if (!loaded || visible.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Get more personalized results</Text>
      {visible.map((task) => (
        <View key={task.id} style={styles.card}>
          <View style={styles.textCol}>
            <Text style={styles.title}>{task.title}</Text>
            <Text style={styles.description}>{task.description}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable onPress={task.onPress} style={styles.ctaButton}>
              <Text style={styles.ctaLabel}>{task.ctaLabel}</Text>
            </Pressable>
            <Pressable
              onPress={() => dismiss(task.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Not now — ${task.title}`}
            >
              <Text style={styles.dismissLabel}>Not now</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { gap: 8, marginBottom: 16 },
    heading: { fontSize: 13, fontWeight: "600", color: theme.textSecondary, marginBottom: 2 },
    card: {
      padding: 14,
      borderRadius: 12,
      backgroundColor: theme.surfaceRaised,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      ...cardElevationStyle(theme),
    },
    textCol: { flex: 1, gap: 2 },
    title: { fontSize: 14, fontWeight: "600", color: theme.textPrimary },
    description: { fontSize: 12, color: theme.textSecondary },
    actions: { alignItems: "flex-end", gap: 6 },
    ctaButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.accentWalk },
    ctaLabel: { color: "#FFFFFF", fontWeight: "600", fontSize: 13 },
    dismissLabel: { fontSize: 11, color: theme.textSecondary },
  });
}

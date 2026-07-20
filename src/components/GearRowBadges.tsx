import { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

// Unavailability + wash-reminder badges — docs/09-design-system.md §9.4.3.
// Mutually exclusive: an item already out for laundry doesn't also show
// the wash-reminder nudge.
const REASON_COPY: Record<string, string> = {
  laundry: "In the laundry",
  repair: "Being repaired",
  lost: "Lost",
  other: "Marked unavailable",
};

function formatReturnDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

interface Item {
  unavailableUntil?: string;
  unavailableReason?: "laundry" | "repair" | "lost" | "other";
  needsCleaning?: boolean;
  wearsSinceClean?: number;
}

interface Props {
  item: Item;
  onTapUnavailable: () => void;
  onTapWashReminder: () => void;
}

export default function GearRowBadges({ item, onTapUnavailable, onTapWashReminder }: Props) {
  // Date.now() is impure to call during render — the sanctioned pattern is
  // a useState lazy initializer, which only ever runs once at mount
  // (react-hooks/purity). Good enough for a list-row badge that re-renders
  // on every screen focus anyway.
  const [nowMs] = useState(() => Date.now());
  const isUnavailable = !!item.unavailableUntil && new Date(item.unavailableUntil).getTime() > nowMs;

  if (isUnavailable) {
    const reason = item.unavailableReason ?? "other";
    const label =
      reason === "lost"
        ? REASON_COPY.lost
        : `${REASON_COPY[reason]} — back ${formatReturnDate(item.unavailableUntil!)}`;
    return (
      <Pressable onPress={onTapUnavailable} style={styles.badge}>
        <Text style={styles.badgeLabel}>{label}</Text>
      </Pressable>
    );
  }

  if (item.needsCleaning) {
    const label =
      (item.wearsSinceClean ?? 0) > 0
        ? `Worn ${item.wearsSinceClean} times since last wash`
        : "Might need a wash after that last trip";
    return (
      <Pressable onPress={onTapWashReminder} style={[styles.badge, styles.washBadge]}>
        <Text style={styles.badgeLabel}>{label}</Text>
      </Pressable>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#DDE1EA",
  },
  washBadge: { backgroundColor: "#C97327" },
  badgeLabel: { fontSize: 11, color: "#1A1E29" },
});

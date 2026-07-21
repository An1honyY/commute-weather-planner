// §7.3 — leave-by local notifications. Scheduling/cancelling only; the
// RecommendationSnapshot freeze + recordWear() that fire at the same moment
// live in src/lib/leaveBy.ts, since notifications.ts stays a thin wrapper
// around expo-notifications with no DB writes of its own.
import * as Notifications from "expo-notifications";
import type { Recommendation } from "./recommend";
import type { Journey } from "../types";

export const LEAVE_BY_LEAD_MINUTES = 10;

function leaveByIdentifier(journeyId: string): string {
  return `leave-by:${journeyId}`;
}

// A short one-line gear summary for the notification body — e.g. "Rain
// shell + waterproof boots". The full voice/copy pass (§9.0.1) is Phase 11;
// this mirrors §7.3's reference implementation's plain concatenation.
export function summarizeRecommendation(recommendation: Recommendation): string {
  const parts: string[] = [];
  const jacket = recommendation.layers.find((l) => "id" in l);
  if (jacket && "id" in jacket) parts.push(jacket.name);
  if (recommendation.shoes && "id" in recommendation.shoes) parts.push(recommendation.shoes.name);
  if (recommendation.umbrella && "id" in recommendation.umbrella) parts.push(recommendation.umbrella.name);
  if (parts.length === 0) return "Check today's gear recommendation";
  return parts.join(" + ");
}

// Requested from onboarding (Step6NotificationPermission) or, per §7.3,
// the first time the user plans a journey — scheduleLeaveByNotification
// below simply no-ops (via expo-notifications' own permission check) if
// this was never granted, rather than every call site needing to guard it.
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

// Schedule/re-schedule whenever a Journey's weather or gear recommendation
// is (re)computed — src/lib/planJourney.ts calls this once per plan/
// materialization, which also covers Phase 7's live-delay updates since
// those are applied earlier in that same call. The stable `identifier`
// means Expo replaces rather than duplicates on a re-schedule. §5.2 point 3
// — a forecast-drift re-check that actually changed the recommendation
// calls this again with `changed: true`, which swaps the copy to lead with
// what's different rather than repeating the full original message.
export async function scheduleLeaveByNotification(
  journey: Journey,
  recommendation: Recommendation,
  options?: { changed?: boolean }
): Promise<void> {
  const departMs = new Date(journey.departTime).getTime();
  const triggerMs = departMs - LEAVE_BY_LEAD_MINUTES * 60_000;
  if (triggerMs <= Date.now()) return; // don't schedule for the past

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;

  const summary = summarizeRecommendation(recommendation);

  await Notifications.scheduleNotificationAsync({
    identifier: leaveByIdentifier(journey.id),
    content: options?.changed
      ? {
          title: "Forecast changed",
          body: `${journey.destination.label}: now looks like ${summary}`,
          data: { journeyId: journey.id },
        }
      : {
          title: `Leave in ${LEAVE_BY_LEAD_MINUTES} minutes`,
          body: `${journey.destination.label}: ${summary}`,
          data: { journeyId: journey.id },
        },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(triggerMs) },
  });
}

// Called when the user deletes a Journey or turns off a recurrence's
// `active` flag (§7.3) — safe to call even if nothing was ever scheduled,
// or on a platform (web) where expo-notifications' scheduling APIs aren't
// supported at all, matching the DECISIONS.md precedent of the app staying
// usable in the browser smoke-check even where a native API has no web
// backing.
export async function cancelLeaveByNotification(journeyId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(leaveByIdentifier(journeyId));
  } catch {
    // nothing to cancel, or unsupported on this platform
  }
}

// Navigation param lists — see docs/04-screens-navigation.md §4 for the
// screen list this mirrors.
import type { NavigatorScreenParams } from "@react-navigation/native";
import type { ClothingType } from "../types";

// §9.6 — the gear-recommendation card's fallback slots (Journey Detail)
// navigate here to jump straight into the matching Gear add form, one tab
// over. clothingType carries which slot (base/midlayer/jacket/accessory/
// bottoms) so ClothingForm opens pre-set to the right type rather than
// always defaulting to "jacket".
export type GearAddTarget =
  | { kind: "clothing"; clothingType: ClothingType }
  | { kind: "shoe" }
  | { kind: "umbrella" };

export type MainTabParamList = {
  Today: undefined;
  Plan: undefined;
  Locations: undefined;
  Gear: { openAdd?: GearAddTarget } | undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  // cachedFromDate is set only when planJourney() (§5.1) fell back to a
  // previously-saved route between the same origin/destination — Journey
  // Detail shows the "using a saved route from…" banner when present.
  // readOnly is set when opened from History (§4.4) — hides the
  // return-trip toggle, which doesn't apply to something already past.
  JourneyDetail: { journeyId: string; cachedFromDate?: string; readOnly?: boolean };
  History: undefined;
  LocalKnowledge: undefined;
  Settings: undefined;
  // docs/04-screens-navigation.md §4.1 (2026-07-21 minimal-onboarding
  // rework) — reached from the Today tab's SetupChecklist, not forced
  // onboarding steps.
  SetupGearBasics: undefined;
  SetupNotifications: undefined;
  // docs/12-dev-workflow-ci.md §12.2 — only registered on the navigator
  // when `__DEV__` (RootNavigator.tsx), never reachable in a release build.
  DevMenu: undefined;
};

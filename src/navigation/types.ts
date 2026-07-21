// Navigation param lists — see docs/04-screens-navigation.md §4 for the
// screen list this mirrors.

export type MainTabParamList = {
  Today: undefined;
  Plan: undefined;
  Locations: undefined;
  Gear: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  // cachedFromDate is set only when planJourney() (§5.1) fell back to a
  // previously-saved route between the same origin/destination — Journey
  // Detail shows the "using a saved route from…" banner when present.
  // readOnly is set when opened from History (§4.4) — hides the
  // return-trip toggle, which doesn't apply to something already past.
  JourneyDetail: { journeyId: string; cachedFromDate?: string; readOnly?: boolean };
  History: undefined;
  LocalKnowledge: undefined;
  Settings: undefined;
};

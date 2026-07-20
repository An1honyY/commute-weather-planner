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
  JourneyDetail: { journeyId: string };
  History: undefined;
  LocalKnowledge: undefined;
};

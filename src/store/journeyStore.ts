import { create } from "zustand";
import type { Journey } from "../types";

// In-memory-only journey registry for Phase 3 (docs/08-build-phases.md).
// The Plan screen builds a "hardcoded"/mocked Journey object rather than a
// real routed+weather-fetched one (that's Phase 4), and there's no SQLite
// persistence for Journey rows yet either (Phase 4's pipeline is the first
// place a planned Journey actually gets saved, per docs/05-data-wiring.md's
// "save resulting Journey object" step) — so Journey Detail and the
// return-trip link need somewhere to look a just-planned Journey up by id
// in the meantime. Cleared on app restart; that's fine for this phase.
interface JourneyStoreState {
  journeys: Record<string, Journey>;
  addJourney: (journey: Journey) => void;
  getJourney: (id: string) => Journey | undefined;
}

export const useJourneyStore = create<JourneyStoreState>((set, get) => ({
  journeys: {},
  addJourney: (journey) => set((state) => ({ journeys: { ...state.journeys, [journey.id]: journey } })),
  getJourney: (id) => get().journeys[id],
}));

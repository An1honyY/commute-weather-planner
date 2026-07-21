import type { Journey } from "../types";

// docs/09-design-system.md §9.4.2 — History's list groups rows under day
// headers: "Today," "Yesterday," then full dates. Pure so it's testable
// without a real clock/DB — nowMs is passed in rather than read internally.
export interface HistorySection {
  title: string;
  data: Journey[];
}

export function dayLabel(iso: string, nowMs: number): string {
  const d = new Date(iso);
  const now = new Date(nowMs);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

// Journeys must already be sorted descending by departTime (as
// listPastJourneys returns them) — this only groups consecutive runs under
// the same label, it doesn't sort.
export function groupJourneysByDay(journeys: Journey[], nowMs: number): HistorySection[] {
  const sections: HistorySection[] = [];
  for (const journey of journeys) {
    const title = dayLabel(journey.departTime, nowMs);
    const last = sections[sections.length - 1];
    if (last && last.title === title) {
      last.data.push(journey);
    } else {
      sections.push({ title, data: [journey] });
    }
  }
  return sections;
}

// Today tab's recurring-journey materialization — docs/03-data-models.md §3:
// "The Today tab materializes today's occurrence(s) at read time... rather
// than writing a new DB row per day... A materialized occurrence only gets
// persisted as its own row (with templateId set) once its weather/gear
// data has actually been fetched, so it can be cached for the rest of the
// day instead of re-planned on every app open." docs/08-build-phases.md
// Phase 5.
import { listJourneysOnDate, listRecurringTemplates } from "../db/repositories/journeys";
import { planJourney } from "./planJourney";
import { dominantMode } from "./journeyMode";
import type { Journey } from "../types";

function departTimeToday(now: Date, departTimeOfDay: string): string {
  const [hours, minutes] = departTimeOfDay.split(":").map(Number);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes).toISOString();
}

export async function materializeTodaysJourneys(now: Date = new Date()): Promise<Journey[]> {
  const [templates, existingToday] = await Promise.all([listRecurringTemplates(), listJourneysOnDate(now.toISOString())]);

  const dueTemplates = templates.filter(
    (t) => t.recurrence?.active && t.recurrence.daysOfWeek.includes(now.getDay())
  );

  const materialized: Journey[] = [];
  for (const template of dueTemplates) {
    const already = existingToday.find((j) => j.templateId === template.id);
    if (already) {
      materialized.push(already);
      continue;
    }
    const result = await planJourney({
      origin: template.origin,
      destination: template.destination,
      waypoints: template.waypoints ?? [],
      departTime: departTimeToday(now, template.recurrence!.departTimeOfDay),
      mode: dominantMode(template.legs),
      formal: template.formal ?? false,
      carryPreference: template.carryPreference ?? "no-preference",
      templateId: template.id,
    });
    if (result.kind !== "failed") materialized.push(result.journey);
  }

  // One-off journeys planned directly for today — not a template (those
  // never appear directly on Today) and not a materialized occurrence
  // already counted above.
  const oneOff = existingToday.filter((j) => !j.recurrence && !j.templateId);

  return [...materialized, ...oneOff].sort((a, b) => a.departTime.localeCompare(b.departTime));
}

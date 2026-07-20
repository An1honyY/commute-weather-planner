import { getDb } from "../index";
import { fromSqlBoolOptional, fromSqlJson, toSqlBool, toSqlJson } from "../rowMapping";
import type {
  CarryPreference,
  GearFeedback,
  Journey,
  JourneyLeg,
  RecommendationSnapshot,
  RecurrenceRule,
  SavedLocation,
} from "../../types";

interface JourneyRow {
  id: string;
  origin_id: string;
  origin_label: string;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  origin_has_reliable_climate_control: number | null;
  destination_id: string;
  destination_label: string;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  destination_has_reliable_climate_control: number | null;
  depart_time: string;
  legs: string;
  recurrence: string | null;
  template_id: string | null;
  linked_return_journey_id: string | null;
  feedback: string | null;
  saved_route_id: string | null;
  recommendation_snapshot: string | null;
  waypoints: string | null;
  carry_preference: string | null;
  formal: number | null;
}

function toLocationSnapshot(
  id: string,
  label: string,
  address: string,
  lat: number,
  lng: number,
  hasReliableClimateControl: number | null
): SavedLocation {
  return { id, label, address, lat, lng, hasReliableClimateControl: fromSqlBoolOptional(hasReliableClimateControl) };
}

function fromRow(row: JourneyRow): Journey {
  return {
    id: row.id,
    origin: toLocationSnapshot(
      row.origin_id,
      row.origin_label,
      row.origin_address,
      row.origin_lat,
      row.origin_lng,
      row.origin_has_reliable_climate_control
    ),
    destination: toLocationSnapshot(
      row.destination_id,
      row.destination_label,
      row.destination_address,
      row.destination_lat,
      row.destination_lng,
      row.destination_has_reliable_climate_control
    ),
    departTime: row.depart_time,
    legs: fromSqlJson<JourneyLeg[]>(row.legs) ?? [],
    recurrence: fromSqlJson<RecurrenceRule>(row.recurrence),
    templateId: row.template_id ?? undefined,
    linkedReturnJourneyId: row.linked_return_journey_id ?? undefined,
    feedback: (row.feedback as GearFeedback | null) ?? undefined,
    savedRouteId: row.saved_route_id ?? undefined,
    recommendationSnapshot: fromSqlJson<RecommendationSnapshot>(row.recommendation_snapshot),
    waypoints: fromSqlJson<SavedLocation[]>(row.waypoints),
    carryPreference: (row.carry_preference as CarryPreference | null) ?? undefined,
    formal: fromSqlBoolOptional(row.formal),
  };
}

export async function createJourney(journey: Journey): Promise<Journey> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO journeys
      (id, origin_id, origin_label, origin_address, origin_lat, origin_lng, origin_has_reliable_climate_control,
       destination_id, destination_label, destination_address, destination_lat, destination_lng, destination_has_reliable_climate_control,
       depart_time, legs, recurrence, template_id, linked_return_journey_id, feedback, saved_route_id,
       recommendation_snapshot, waypoints, carry_preference, formal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    journey.id,
    journey.origin.id,
    journey.origin.label,
    journey.origin.address,
    journey.origin.lat,
    journey.origin.lng,
    toSqlBool(journey.origin.hasReliableClimateControl),
    journey.destination.id,
    journey.destination.label,
    journey.destination.address,
    journey.destination.lat,
    journey.destination.lng,
    toSqlBool(journey.destination.hasReliableClimateControl),
    journey.departTime,
    toSqlJson(journey.legs) ?? "[]",
    toSqlJson(journey.recurrence),
    journey.templateId ?? null,
    journey.linkedReturnJourneyId ?? null,
    journey.feedback ?? null,
    journey.savedRouteId ?? null,
    toSqlJson(journey.recommendationSnapshot),
    toSqlJson(journey.waypoints),
    journey.carryPreference ?? null,
    toSqlBool(journey.formal)
  );
  return journey;
}

export async function updateJourney(journey: Journey): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE journeys SET
      legs = ?, recurrence = ?, linked_return_journey_id = ?, feedback = ?,
      recommendation_snapshot = ?, waypoints = ?, carry_preference = ?, formal = ?
     WHERE id = ?`,
    toSqlJson(journey.legs) ?? "[]",
    toSqlJson(journey.recurrence),
    journey.linkedReturnJourneyId ?? null,
    journey.feedback ?? null,
    toSqlJson(journey.recommendationSnapshot),
    toSqlJson(journey.waypoints),
    journey.carryPreference ?? null,
    toSqlBool(journey.formal),
    journey.id
  );
}

export async function getJourney(id: string): Promise<Journey | undefined> {
  const db = await getDb();
  const row = await db.getFirstAsync<JourneyRow>("SELECT * FROM journeys WHERE id = ?", id);
  return row ? fromRow(row) : undefined;
}

// §3 — a recurring journey is stored as a single row with `recurrence` set
// and no `templateId` (it *is* the template). Today reads these to decide
// which occurrences to materialize.
export async function listRecurringTemplates(): Promise<Journey[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<JourneyRow>(
    "SELECT * FROM journeys WHERE recurrence IS NOT NULL AND template_id IS NULL"
  );
  return rows.map(fromRow);
}

// Every journey (one-off or a materialized recurring occurrence) whose
// departTime falls on the given calendar day, earliest first — what the
// Today tab actually lists.
export async function listJourneysOnDate(dateIso: string): Promise<Journey[]> {
  const db = await getDb();
  const date = new Date(dateIso);
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
  const startOfNextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();
  const rows = await db.getAllAsync<JourneyRow>(
    `SELECT * FROM journeys WHERE depart_time >= ? AND depart_time < ? ORDER BY depart_time ASC`,
    startOfDay,
    startOfNextDay
  );
  return rows.map(fromRow);
}

// docs/05-data-wiring.md §5.1 — the offline-planning fallback: "a
// previously-saved Journey between the same origin/destination pair (exact
// SavedLocation.id match) within the last 30 days." Most recent first.
export async function findRecentJourneyBetween(
  originId: string,
  destinationId: string,
  sinceIso: string
): Promise<Journey | undefined> {
  const db = await getDb();
  const row = await db.getFirstAsync<JourneyRow>(
    `SELECT * FROM journeys
     WHERE origin_id = ? AND destination_id = ? AND depart_time >= ?
     ORDER BY depart_time DESC
     LIMIT 1`,
    originId,
    destinationId,
    sinceIso
  );
  return row ? fromRow(row) : undefined;
}

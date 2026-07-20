import { getDb } from "../index";
import { newId } from "../rowMapping";
import type { SavedRoute } from "../../types";

interface SavedRouteRow {
  id: string;
  label: string;
  origin_id: string;
  destination_id: string;
  preferred_mode: string | null;
  created_at: string;
  last_used_at: string | null;
}

function fromRow(row: SavedRouteRow): SavedRoute {
  return {
    id: row.id,
    label: row.label,
    originId: row.origin_id,
    destinationId: row.destination_id,
    preferredMode: (row.preferred_mode as SavedRoute["preferredMode"]) ?? undefined,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? undefined,
  };
}

// Most recently used first — docs/04-screens-navigation.md §4.3's Plan-screen
// chip row ordering, same pattern as SavedLocation's recency sort.
export async function listSavedRoutes(): Promise<SavedRoute[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SavedRouteRow>(
    `SELECT * FROM saved_routes ORDER BY COALESCE(last_used_at, created_at) DESC`
  );
  return rows.map(fromRow);
}

export async function createSavedRoute(input: Omit<SavedRoute, "id" | "createdAt">): Promise<SavedRoute> {
  const db = await getDb();
  const route: SavedRoute = { ...input, id: newId(), createdAt: new Date().toISOString() };
  await db.runAsync(
    `INSERT INTO saved_routes (id, label, origin_id, destination_id, preferred_mode, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    route.id,
    route.label,
    route.originId,
    route.destinationId,
    route.preferredMode ?? null,
    route.createdAt,
    route.lastUsedAt ?? null
  );
  return route;
}

// Bumps lastUsedAt — called when a chip is tapped to pre-fill Plan, per
// §4.3's recency-ordering requirement.
export async function touchSavedRoute(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("UPDATE saved_routes SET last_used_at = ? WHERE id = ?", new Date().toISOString(), id);
}

export async function deleteSavedRoute(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM saved_routes WHERE id = ?", id);
}

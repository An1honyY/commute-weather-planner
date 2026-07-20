import { getDb } from "../index";
import type { UmbrellaItem } from "../../types";

interface UmbrellaRow {
  id: string;
  name: string;
  type: string;
  wind_rating: string;
  unavailable_until: string | null;
  color: string | null;
  photo_uri: string | null;
}

function fromRow(row: UmbrellaRow): UmbrellaItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type as UmbrellaItem["type"],
    windRating: row.wind_rating as UmbrellaItem["windRating"],
    unavailableUntil: row.unavailable_until ?? undefined,
    color: (row.color as UmbrellaItem["color"]) ?? undefined,
    photoUri: row.photo_uri ?? undefined,
  };
}

export async function listUmbrellas(): Promise<UmbrellaItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<UmbrellaRow>("SELECT * FROM umbrella_items ORDER BY name");
  return rows.map(fromRow);
}

// Caller supplies `item.id` — see clothing.ts's createClothing for why.
export async function createUmbrella(item: UmbrellaItem): Promise<UmbrellaItem> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO umbrella_items (id, name, type, wind_rating, unavailable_until, color, photo_uri)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.name,
    item.type,
    item.windRating,
    item.unavailableUntil ?? null,
    item.color ?? null,
    item.photoUri ?? null
  );
  return item;
}

export async function updateUmbrella(item: UmbrellaItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE umbrella_items SET name = ?, type = ?, wind_rating = ?, unavailable_until = ?, color = ?, photo_uri = ?
     WHERE id = ?`,
    item.name,
    item.type,
    item.windRating,
    item.unavailableUntil ?? null,
    item.color ?? null,
    item.photoUri ?? null,
    item.id
  );
}

export async function deleteUmbrella(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM umbrella_items WHERE id = ?", id);
}

import { getDb } from "../index";
import { fromSqlBool, fromSqlBoolOptional, fromSqlJson, toSqlBool, toSqlJson } from "../rowMapping";
import type { ClothingItem } from "../../types";

interface ClothingRow {
  id: string;
  name: string;
  type: string;
  warmth: number;
  waterproof: number;
  windproof: number;
  packable: number;
  substitutes_for_midlayer: number | null;
  tags: string | null;
  unavailable_until: string | null;
  unavailable_reason: string | null;
  wears_since_clean: number | null;
  last_worn_at: string | null;
  needs_cleaning: number | null;
  color: string | null;
  photo_uri: string | null;
}

function fromRow(row: ClothingRow): ClothingItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ClothingItem["type"],
    warmth: row.warmth,
    waterproof: fromSqlBool(row.waterproof),
    windproof: fromSqlBool(row.windproof),
    packable: fromSqlBool(row.packable),
    substitutesForMidlayer: fromSqlBoolOptional(row.substitutes_for_midlayer),
    tags: fromSqlJson<string[]>(row.tags),
    unavailableUntil: row.unavailable_until ?? undefined,
    unavailableReason: (row.unavailable_reason as ClothingItem["unavailableReason"]) ?? undefined,
    wearsSinceClean: row.wears_since_clean ?? undefined,
    lastWornAt: row.last_worn_at ?? undefined,
    needsCleaning: fromSqlBoolOptional(row.needs_cleaning),
    color: (row.color as ClothingItem["color"]) ?? undefined,
    photoUri: row.photo_uri ?? undefined,
  };
}

export async function listClothing(): Promise<ClothingItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ClothingRow>("SELECT * FROM clothing_items ORDER BY name");
  return rows.map(fromRow);
}

// Caller supplies `item.id` (generated up front via rowMapping.newId()) so
// forms can associate a captured photo (Section 3.3,
// `gear-photos/{itemId}.jpg`) with the item before it's actually saved.
export async function createClothing(item: ClothingItem): Promise<ClothingItem> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO clothing_items
      (id, name, type, warmth, waterproof, windproof, packable, substitutes_for_midlayer, tags,
       unavailable_until, unavailable_reason, wears_since_clean, last_worn_at, needs_cleaning, color, photo_uri)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.name,
    item.type,
    item.warmth,
    toSqlBool(item.waterproof),
    toSqlBool(item.windproof),
    toSqlBool(item.packable),
    toSqlBool(item.substitutesForMidlayer),
    toSqlJson(item.tags),
    item.unavailableUntil ?? null,
    item.unavailableReason ?? null,
    item.wearsSinceClean ?? null,
    item.lastWornAt ?? null,
    toSqlBool(item.needsCleaning),
    item.color ?? null,
    item.photoUri ?? null
  );
  return item;
}

export async function updateClothing(item: ClothingItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE clothing_items SET
      name = ?, type = ?, warmth = ?, waterproof = ?, windproof = ?, packable = ?,
      substitutes_for_midlayer = ?, tags = ?, unavailable_until = ?, unavailable_reason = ?,
      wears_since_clean = ?, last_worn_at = ?, needs_cleaning = ?, color = ?, photo_uri = ?
     WHERE id = ?`,
    item.name,
    item.type,
    item.warmth,
    toSqlBool(item.waterproof),
    toSqlBool(item.windproof),
    toSqlBool(item.packable),
    toSqlBool(item.substitutesForMidlayer),
    toSqlJson(item.tags),
    item.unavailableUntil ?? null,
    item.unavailableReason ?? null,
    item.wearsSinceClean ?? null,
    item.lastWornAt ?? null,
    toSqlBool(item.needsCleaning),
    item.color ?? null,
    item.photoUri ?? null,
    item.id
  );
}

// docs/10-production-readiness.md §10.3 — Import data upserts by id (an
// item may already exist from a prior import or partial re-sync), unlike
// createClothing() which always inserts a fresh row.
export async function upsertClothing(item: ClothingItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO clothing_items
      (id, name, type, warmth, waterproof, windproof, packable, substitutes_for_midlayer, tags,
       unavailable_until, unavailable_reason, wears_since_clean, last_worn_at, needs_cleaning, color, photo_uri)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, type = excluded.type, warmth = excluded.warmth,
       waterproof = excluded.waterproof, windproof = excluded.windproof, packable = excluded.packable,
       substitutes_for_midlayer = excluded.substitutes_for_midlayer, tags = excluded.tags,
       unavailable_until = excluded.unavailable_until, unavailable_reason = excluded.unavailable_reason,
       wears_since_clean = excluded.wears_since_clean, last_worn_at = excluded.last_worn_at,
       needs_cleaning = excluded.needs_cleaning, color = excluded.color, photo_uri = excluded.photo_uri`,
    item.id,
    item.name,
    item.type,
    item.warmth,
    toSqlBool(item.waterproof),
    toSqlBool(item.windproof),
    toSqlBool(item.packable),
    toSqlBool(item.substitutesForMidlayer),
    toSqlJson(item.tags),
    item.unavailableUntil ?? null,
    item.unavailableReason ?? null,
    item.wearsSinceClean ?? null,
    item.lastWornAt ?? null,
    toSqlBool(item.needsCleaning),
    item.color ?? null,
    item.photoUri ?? null
  );
}

export async function deleteClothing(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM clothing_items WHERE id = ?", id);
}

// §7.16 — recordWear()'s targeted per-item write. A smaller, dedicated
// UPDATE rather than routing through updateClothing() (which requires the
// full item object the caller doesn't have at the leave-by call site).
export async function updateClothingWearTracking(
  id: string,
  patch: { wearsSinceClean: number; lastWornAt: string; needsCleaning: boolean }
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE clothing_items SET wears_since_clean = ?, last_worn_at = ?, needs_cleaning = ? WHERE id = ?`,
    patch.wearsSinceClean,
    patch.lastWornAt,
    toSqlBool(patch.needsCleaning),
    id
  );
}

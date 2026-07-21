import { getDb } from "../index";
import { fromSqlBool, fromSqlBoolOptional, toSqlBool } from "../rowMapping";
import type { ShoeItem } from "../../types";

interface ShoeRow {
  id: string;
  name: string;
  type: string;
  waterproof: number;
  grip: string;
  unavailable_until: string | null;
  unavailable_reason: string | null;
  wears_since_clean: number | null;
  last_worn_at: string | null;
  needs_cleaning: number | null;
  color: string | null;
  photo_uri: string | null;
}

function fromRow(row: ShoeRow): ShoeItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ShoeItem["type"],
    waterproof: fromSqlBool(row.waterproof),
    grip: row.grip as ShoeItem["grip"],
    unavailableUntil: row.unavailable_until ?? undefined,
    unavailableReason: (row.unavailable_reason as ShoeItem["unavailableReason"]) ?? undefined,
    wearsSinceClean: row.wears_since_clean ?? undefined,
    lastWornAt: row.last_worn_at ?? undefined,
    needsCleaning: fromSqlBoolOptional(row.needs_cleaning),
    color: (row.color as ShoeItem["color"]) ?? undefined,
    photoUri: row.photo_uri ?? undefined,
  };
}

export async function listShoes(): Promise<ShoeItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ShoeRow>("SELECT * FROM shoe_items ORDER BY name");
  return rows.map(fromRow);
}

// Caller supplies `item.id` — see clothing.ts's createClothing for why.
export async function createShoe(item: ShoeItem): Promise<ShoeItem> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO shoe_items
      (id, name, type, waterproof, grip, unavailable_until, unavailable_reason,
       wears_since_clean, last_worn_at, needs_cleaning, color, photo_uri)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.name,
    item.type,
    toSqlBool(item.waterproof),
    item.grip,
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

export async function updateShoe(item: ShoeItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE shoe_items SET
      name = ?, type = ?, waterproof = ?, grip = ?, unavailable_until = ?, unavailable_reason = ?,
      wears_since_clean = ?, last_worn_at = ?, needs_cleaning = ?, color = ?, photo_uri = ?
     WHERE id = ?`,
    item.name,
    item.type,
    toSqlBool(item.waterproof),
    item.grip,
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

export async function deleteShoe(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM shoe_items WHERE id = ?", id);
}

// §7.16 — recordWear()'s targeted per-item write, mirroring
// updateClothingWearTracking() in clothing.ts for the shoe_items table.
export async function updateShoeWearTracking(
  id: string,
  patch: { wearsSinceClean: number; lastWornAt: string; needsCleaning: boolean }
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE shoe_items SET wears_since_clean = ?, last_worn_at = ?, needs_cleaning = ? WHERE id = ?`,
    patch.wearsSinceClean,
    patch.lastWornAt,
    toSqlBool(patch.needsCleaning),
    id
  );
}

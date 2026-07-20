import { getDb } from "../index";
import type { VehicleItem } from "../../types";

interface VehicleRow {
  id: string;
  name: string;
  type: string;
  weather_protection: string;
  photo_uri: string | null;
}

function fromRow(row: VehicleRow): VehicleItem {
  return {
    id: row.id,
    name: row.name,
    type: row.type as VehicleItem["type"],
    weatherProtection: row.weather_protection as VehicleItem["weatherProtection"],
    photoUri: row.photo_uri ?? undefined,
  };
}

export async function listVehicles(): Promise<VehicleItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<VehicleRow>("SELECT * FROM vehicle_items ORDER BY name");
  return rows.map(fromRow);
}

// Caller supplies `item.id` — see clothing.ts's createClothing for why.
export async function createVehicle(item: VehicleItem): Promise<VehicleItem> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO vehicle_items (id, name, type, weather_protection, photo_uri) VALUES (?, ?, ?, ?, ?)`,
    item.id,
    item.name,
    item.type,
    item.weatherProtection,
    item.photoUri ?? null
  );
  return item;
}

export async function updateVehicle(item: VehicleItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE vehicle_items SET name = ?, type = ?, weather_protection = ?, photo_uri = ? WHERE id = ?`,
    item.name,
    item.type,
    item.weatherProtection,
    item.photoUri ?? null,
    item.id
  );
}

export async function deleteVehicle(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM vehicle_items WHERE id = ?", id);
}

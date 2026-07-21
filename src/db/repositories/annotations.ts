import { getDb } from "../index";
import { newId } from "../rowMapping";
import type { EnvironmentAnnotation, EnvironmentEffectType } from "../../types";

interface AnnotationRow {
  id: string;
  label: string;
  effect: string;
  lat: number;
  lng: number;
  radius_m: number;
  notes: string | null;
  created_at: string;
}

function fromRow(row: AnnotationRow): EnvironmentAnnotation {
  return {
    id: row.id,
    label: row.label,
    effect: row.effect as EnvironmentEffectType,
    lat: row.lat,
    lng: row.lng,
    radiusM: row.radius_m,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

// Newest first — the Local knowledge list (§4.5) is a review/prune surface,
// so what was just added should be at the top.
export async function listAnnotations(): Promise<EnvironmentAnnotation[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<AnnotationRow>(
    "SELECT * FROM environment_annotations ORDER BY created_at DESC"
  );
  return rows.map(fromRow);
}

export async function createAnnotation(
  input: Omit<EnvironmentAnnotation, "id" | "createdAt">
): Promise<EnvironmentAnnotation> {
  const db = await getDb();
  const annotation: EnvironmentAnnotation = { ...input, id: newId(), createdAt: new Date().toISOString() };
  await db.runAsync(
    `INSERT INTO environment_annotations (id, label, effect, lat, lng, radius_m, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    annotation.id,
    annotation.label,
    annotation.effect,
    annotation.lat,
    annotation.lng,
    annotation.radiusM,
    annotation.notes ?? null,
    annotation.createdAt
  );
  return annotation;
}

export async function updateAnnotation(annotation: EnvironmentAnnotation): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE environment_annotations SET
      label = ?, effect = ?, lat = ?, lng = ?, radius_m = ?, notes = ?
     WHERE id = ?`,
    annotation.label,
    annotation.effect,
    annotation.lat,
    annotation.lng,
    annotation.radiusM,
    annotation.notes ?? null,
    annotation.id
  );
}

export async function deleteAnnotation(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM environment_annotations WHERE id = ?", id);
}

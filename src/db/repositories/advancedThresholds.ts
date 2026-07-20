import { getDb } from "../index";
import type { AdvancedWarmthThresholds } from "../../types";

interface ThresholdsRow {
  freezing_c: number | null;
  cool_upper_c: number | null;
  warm_outdoor_c: number | null;
}

// Single row, opt-in escape hatch (§3.6) — every field starts undefined,
// meaning "use the named constant from recommend.ts unchanged."
export async function getAdvancedThresholds(): Promise<AdvancedWarmthThresholds> {
  const db = await getDb();
  const row = await db.getFirstAsync<ThresholdsRow>("SELECT * FROM advanced_warmth_thresholds WHERE id = 1");
  if (!row) return {};
  return {
    freezingC: row.freezing_c ?? undefined,
    coolUpperC: row.cool_upper_c ?? undefined,
    warmOutdoorC: row.warm_outdoor_c ?? undefined,
  };
}

export async function saveAdvancedThresholds(thresholds: AdvancedWarmthThresholds): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO advanced_warmth_thresholds (id, freezing_c, cool_upper_c, warm_outdoor_c)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       freezing_c = excluded.freezing_c,
       cool_upper_c = excluded.cool_upper_c,
       warm_outdoor_c = excluded.warm_outdoor_c`,
    thresholds.freezingC ?? null,
    thresholds.coolUpperC ?? null,
    thresholds.warmOutdoorC ?? null
  );
}

// Initial schema — see docs/03-data-models.md §3.1-3.2 for migration policy
// and index rationale. Additive-only from here on: never drop or rename a
// column in a later migration, only ADD COLUMN or CREATE TABLE.
import type { SQLiteDatabase } from "expo-sqlite";

export const version = 1;

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS clothing_items (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      warmth INTEGER NOT NULL,
      waterproof INTEGER NOT NULL,
      windproof INTEGER NOT NULL,
      packable INTEGER NOT NULL,
      substitutes_for_midlayer INTEGER,
      tags TEXT,
      unavailable_until TEXT,
      unavailable_reason TEXT,
      wears_since_clean INTEGER,
      last_worn_at TEXT,
      needs_cleaning INTEGER,
      color TEXT,
      photo_uri TEXT
    );

    CREATE TABLE IF NOT EXISTS shoe_items (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      waterproof INTEGER NOT NULL,
      grip TEXT NOT NULL,
      unavailable_until TEXT,
      unavailable_reason TEXT,
      wears_since_clean INTEGER,
      last_worn_at TEXT,
      needs_cleaning INTEGER,
      color TEXT,
      photo_uri TEXT
    );

    CREATE TABLE IF NOT EXISTS umbrella_items (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      wind_rating TEXT NOT NULL,
      unavailable_until TEXT,
      color TEXT,
      photo_uri TEXT
    );

    CREATE TABLE IF NOT EXISTS vehicle_items (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      weather_protection TEXT NOT NULL,
      photo_uri TEXT
    );

    CREATE TABLE IF NOT EXISTS saved_locations (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      icon TEXT,
      is_favorite INTEGER,
      last_used_at TEXT,
      has_reliable_climate_control INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_saved_locations_last_used_at
      ON saved_locations (last_used_at);

    CREATE TABLE IF NOT EXISTS saved_routes (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      origin_id TEXT NOT NULL,
      destination_id TEXT NOT NULL,
      preferred_mode TEXT,
      created_at TEXT NOT NULL,
      last_used_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_saved_routes_last_used_at
      ON saved_routes (last_used_at);

    CREATE TABLE IF NOT EXISTS environment_annotations (
      id TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL,
      effect TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      radius_m REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    -- Journey.origin / .destination are a frozen SavedLocation snapshot at
    -- plan time (Section 3), stored inline; origin_id/destination_id are
    -- kept alongside for the cached-route-reuse lookup (Section 3.2) even
    -- though the referenced SavedLocation may since have changed or been
    -- deleted. legs/recurrence/waypoints/recommendation_snapshot are
    -- nested/variable-shape per Section 3 and stored as JSON text.
    CREATE TABLE IF NOT EXISTS journeys (
      id TEXT PRIMARY KEY NOT NULL,
      origin_id TEXT NOT NULL,
      origin_label TEXT NOT NULL,
      origin_address TEXT NOT NULL,
      origin_lat REAL NOT NULL,
      origin_lng REAL NOT NULL,
      origin_has_reliable_climate_control INTEGER,
      destination_id TEXT NOT NULL,
      destination_label TEXT NOT NULL,
      destination_address TEXT NOT NULL,
      destination_lat REAL NOT NULL,
      destination_lng REAL NOT NULL,
      destination_has_reliable_climate_control INTEGER,
      depart_time TEXT NOT NULL,
      legs TEXT NOT NULL,
      recurrence TEXT,
      template_id TEXT,
      linked_return_journey_id TEXT,
      feedback TEXT,
      saved_route_id TEXT,
      recommendation_snapshot TEXT,
      waypoints TEXT,
      carry_preference TEXT,
      formal INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_journeys_depart_time
      ON journeys (depart_time);
    CREATE INDEX IF NOT EXISTS idx_journeys_origin_id
      ON journeys (origin_id);
    CREATE INDEX IF NOT EXISTS idx_journeys_destination_id
      ON journeys (destination_id);

    -- Single row, no id needed (Section 3).
    CREATE TABLE IF NOT EXISTS warmth_calibration (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      offset_levels REAL NOT NULL DEFAULT 0,
      sample_count INTEGER NOT NULL DEFAULT 0,
      seasonal_offsets TEXT,
      seasonal_sample_counts TEXT,
      wind_sensitivity_offset REAL,
      wind_sensitivity_sample_count INTEGER,
      last_feedback_at TEXT
    );

    -- Single row, opt-in escape hatch (Section 3.6). Every column starts
    -- NULL, meaning "use the named constant from Section 7 unchanged."
    CREATE TABLE IF NOT EXISTS advanced_warmth_thresholds (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      freezing_c REAL,
      cool_upper_c REAL,
      warm_outdoor_c REAL
    );
  `);
}

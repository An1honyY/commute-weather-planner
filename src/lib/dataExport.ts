// docs/10-production-readiness.md §10.3 — "Export my data" / "Import data."
// Serializes Inventory + SavedLocation[] + WarmthCalibration +
// AdvancedWarmthThresholds + Journey[] (including recommendationSnapshot)
// to data.json, bundles it with gear-photos/ into one zip via
// react-native-zip-archive, and shares it with expo-sharing. Import reverses
// the process: unzip, upsert data.json contents by id, copy photos back.
//
// react-native-zip-archive is native-only (no web implementation) — its JS
// entry point is safe to import on web (it lazily resolves the native
// module only when zip()/unzip() is actually called), so this file bundles
// fine for the `expo start --web` smoke check, but the actual export/import
// operations only work on a native build. See exportData()/importData()'s
// Platform.OS === "web" guard.
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { zip, unzip } from "react-native-zip-archive";
import { listClothing, upsertClothing } from "../db/repositories/clothing";
import { listShoes, upsertShoe } from "../db/repositories/shoes";
import { listUmbrellas, upsertUmbrella } from "../db/repositories/umbrellas";
import { listVehicles, upsertVehicle } from "../db/repositories/vehicles";
import { listLocations, upsertLocation } from "../db/repositories/locations";
import { listAllJourneys, upsertJourney } from "../db/repositories/journeys";
import { getWarmthCalibration, saveWarmthCalibration } from "../db/repositories/calibration";
import { getAdvancedThresholds, saveAdvancedThresholds } from "../db/repositories/advancedThresholds";
import type {
  AdvancedWarmthThresholds,
  ClothingItem,
  Journey,
  SavedLocation,
  ShoeItem,
  UmbrellaItem,
  VehicleItem,
  WarmthCalibration,
} from "../types";

const EXPORT_SCHEMA_VERSION = 1;
const GEAR_PHOTOS_DIR = `${FileSystem.documentDirectory}gear-photos/`;
const EXPORT_STAGING_DIR = `${FileSystem.cacheDirectory}export-staging/`;
const IMPORT_STAGING_DIR = `${FileSystem.cacheDirectory}import-staging/`;

interface ExportBundle {
  exportedAt: string;
  schemaVersion: number;
  clothing: ClothingItem[];
  shoes: ShoeItem[];
  umbrellas: UmbrellaItem[];
  vehicles: VehicleItem[];
  locations: SavedLocation[];
  journeys: Journey[];
  calibration: WarmthCalibration;
  advancedThresholds: AdvancedWarmthThresholds;
}

async function resetDir(dir: string): Promise<void> {
  await FileSystem.deleteAsync(dir, { idempotent: true });
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

async function copyDirContents(fromDir: string, toDir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(fromDir);
  if (!info.exists) return;
  const toInfo = await FileSystem.getInfoAsync(toDir);
  if (!toInfo.exists) await FileSystem.makeDirectoryAsync(toDir, { intermediates: true });
  const files = await FileSystem.readDirectoryAsync(fromDir);
  for (const file of files) {
    await FileSystem.copyAsync({ from: `${fromDir}${file}`, to: `${toDir}${file}` });
  }
}

export class ExportUnavailableError extends Error {}

export async function exportData(): Promise<void> {
  if (Platform.OS === "web") {
    throw new ExportUnavailableError("Export isn't available in the web preview — test this on a device or simulator build.");
  }

  const bundle: ExportBundle = {
    exportedAt: new Date().toISOString(),
    schemaVersion: EXPORT_SCHEMA_VERSION,
    clothing: await listClothing(),
    shoes: await listShoes(),
    umbrellas: await listUmbrellas(),
    vehicles: await listVehicles(),
    locations: await listLocations(),
    journeys: await listAllJourneys(),
    calibration: await getWarmthCalibration(),
    advancedThresholds: await getAdvancedThresholds(),
  };

  await resetDir(EXPORT_STAGING_DIR);
  await FileSystem.writeAsStringAsync(`${EXPORT_STAGING_DIR}data.json`, JSON.stringify(bundle, null, 2));
  await copyDirContents(GEAR_PHOTOS_DIR, `${EXPORT_STAGING_DIR}gear-photos/`);

  const zipDest = `${FileSystem.cacheDirectory}commute-weather-export-${Date.now()}.zip`;
  await zip(EXPORT_STAGING_DIR, zipDest);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new ExportUnavailableError("Sharing isn't available on this device.");
  await Sharing.shareAsync(zipDest, { mimeType: "application/zip", dialogTitle: "Export your data" });
}

// Re-derives each gear item's photoUri from whatever photo files actually
// unzipped, rather than trusting the exported absolute path — documentDirectory
// is per-install/per-device, so a path recorded on the exporting device is
// meaningless after a reinstall or on a different device (§10.6's explicit
// "delete app, reinstall, import" test case).
async function relinkPhotos<T extends { id: string; photoUri?: string }>(
  items: T[],
  unzippedPhotosDir: string
): Promise<T[]> {
  const dirInfo = await FileSystem.getInfoAsync(unzippedPhotosDir);
  if (!dirInfo.exists) return items.map((item) => ({ ...item, photoUri: undefined }));

  const destInfo = await FileSystem.getInfoAsync(GEAR_PHOTOS_DIR);
  if (!destInfo.exists) await FileSystem.makeDirectoryAsync(GEAR_PHOTOS_DIR, { intermediates: true });

  return Promise.all(
    items.map(async (item) => {
      const src = `${unzippedPhotosDir}${item.id}.jpg`;
      const srcInfo = await FileSystem.getInfoAsync(src);
      if (!srcInfo.exists) return { ...item, photoUri: undefined };
      const dest = `${GEAR_PHOTOS_DIR}${item.id}.jpg`;
      await FileSystem.copyAsync({ from: src, to: dest });
      return { ...item, photoUri: `${dest}?t=${Date.now()}` };
    })
  );
}

export interface ImportResult {
  imported: boolean;
  error?: string;
}

export async function importData(): Promise<ImportResult> {
  if (Platform.OS === "web") {
    return { imported: false, error: "Import isn't available in the web preview — test this on a device or simulator build." };
  }

  const picked = await DocumentPicker.getDocumentAsync({ type: "application/zip", copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets[0]) return { imported: false };

  await resetDir(IMPORT_STAGING_DIR);
  await unzip(picked.assets[0].uri, IMPORT_STAGING_DIR);

  const dataJsonPath = `${IMPORT_STAGING_DIR}data.json`;
  const dataInfo = await FileSystem.getInfoAsync(dataJsonPath);
  if (!dataInfo.exists) {
    return { imported: false, error: "This file doesn't look like a Commute Weather Planner export." };
  }

  let bundle: ExportBundle;
  try {
    bundle = JSON.parse(await FileSystem.readAsStringAsync(dataJsonPath)) as ExportBundle;
  } catch {
    return { imported: false, error: "This export file is corrupted and couldn't be read." };
  }

  const photosDir = `${IMPORT_STAGING_DIR}gear-photos/`;
  const clothing = await relinkPhotos(bundle.clothing ?? [], photosDir);
  const shoes = await relinkPhotos(bundle.shoes ?? [], photosDir);
  const umbrellas = await relinkPhotos(bundle.umbrellas ?? [], photosDir);
  const vehicles = await relinkPhotos(bundle.vehicles ?? [], photosDir);

  for (const item of clothing) await upsertClothing(item);
  for (const item of shoes) await upsertShoe(item);
  for (const item of umbrellas) await upsertUmbrella(item);
  for (const item of vehicles) await upsertVehicle(item);
  for (const location of bundle.locations ?? []) await upsertLocation(location);
  for (const journey of bundle.journeys ?? []) await upsertJourney(journey);
  if (bundle.calibration) await saveWarmthCalibration(bundle.calibration);
  if (bundle.advancedThresholds) await saveAdvancedThresholds(bundle.advancedThresholds);

  return { imported: true };
}

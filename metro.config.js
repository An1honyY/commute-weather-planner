// expo-sqlite's web backend (wa-sqlite) ships a .wasm binary
// (node_modules/expo-sqlite/web/wa-sqlite/wa-sqlite.wasm) that it imports
// directly. Metro's default asset extension list (expo/metro-config)
// doesn't include "wasm", so it tries to resolve/parse the file as a JS
// module instead of bundling it as a static asset — this is what produces
// "Unable to resolve './wa-sqlite/wa-sqlite.wasm'" on `expo start --web`.
// Registering it as an asset extension is the documented fix.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("wasm");

module.exports = config;

// docs/10-production-readiness.md §10.1 — release builds must never log API
// keys or full network payloads via console.log; strip all console calls
// from production JS bundles (EAS `production`/`preview` profiles set
// NODE_ENV=production) while keeping them for local dev/test.
module.exports = function (api) {
  const isProduction = api.env("production");
  api.cache.using(() => isProduction);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "react-native-reanimated/plugin",
      ...(isProduction ? ["transform-remove-console"] : []),
    ],
  };
};

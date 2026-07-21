// A DB write that never resolves shouldn't be able to freeze a screen
// forever — race it against a timeout and fall back to a safe default so
// the caller can always make forward progress (e.g. advance onboarding
// even if the write didn't actually land). Originally written inline in
// App.tsx for the startup getDb() check (expo-sqlite's web backend was
// hanging there due to a wasm bundling bug, since fixed in metro.config.js
// — see DECISIONS.md); pulled out here so the same defense-in-depth guard
// covers the onboarding steps' own DB writes too, not just startup.
export function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 5000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`withTimeout: promise didn't settle within ${timeoutMs}ms, using fallback`);
      resolve(fallback);
    }, timeoutMs);
  });
  // Clear the timer once the real promise settles first, so a slow-but-
  // eventually-successful call doesn't log a stale "didn't settle" warning
  // after the fact.
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout]).catch(() => fallback);
}

// Shared time-of-day formatter — every screen that renders a clock time
// (RightNowCard, JourneyCard, LegRow, HistoryRow, HourlyStrip) used to call
// `toLocaleTimeString(undefined, {...})` directly, which silently defers
// 12h/24h choice to the device/browser's locale default rather than this
// app's own setting (src/lib/useTimeFormatStore.ts). Centralizing the
// `hour12` option here means the Settings toggle actually takes effect
// everywhere at once.
export function formatTime(iso: string, hour12: boolean, options?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12, ...options });
}

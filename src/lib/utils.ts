// Small shared utility — used by recommendGear() (Section 7) and, from
// Phase 10 onward, applyGearFeedback() (Section 7.5).
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

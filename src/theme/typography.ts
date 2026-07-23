// docs/09-design-system.md §9.2 — the type scale/spacing-unit/radius the
// doc describes but that never became real code tokens (every screen was
// hardcoding its own raw numbers, which had already drifted — see
// DECISIONS.md, UI/UX polish pass 2). Theme-independent (unlike
// src/theme/tokens.ts's colors), so kept as a separate flat file rather
// than folded into ThemeTokens.
export const TYPE = {
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 15, fontWeight: "400" },
  caption: { fontSize: 13, fontWeight: "400" },
  micro: { fontSize: 11, fontWeight: "500" },
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const RADIUS = {
  pill: 8,
  card: 12,
  circle: 999,
} as const;

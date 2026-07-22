import Svg, { Line, Path, Rect } from "react-native-svg";

// docs/09-design-system.md §9.3/§9.4 (2026-07-21) — small line-icon glyphs
// paired with every clothing/accessory recommendation ("icon + item name",
// never bare text), one fixed icon per slot kind — not per-item art (gear
// photos stay exactly as they are in Gear/Journey Detail).
export type ClothingIconKind =
  | "jacket"
  | "midlayer"
  | "base"
  | "bottoms"
  | "shoe"
  | "umbrella"
  | "sunglasses"
  | "accessory";

interface Props {
  kind: ClothingIconKind;
  size?: number;
  color: string;
}

// A picked/fallback accessory's `name`/`fallbackText` is free text with no
// further discriminated subtype (§3's ClothingItem has no accessory
// sub-kind) — recommend.ts's own fallback copy already says "sunglasses/a
// hat", so a name/text match is the only signal available without a schema
// change. Anything that doesn't match reads as the generic accessory glyph.
export function accessoryIconKind(text: string): ClothingIconKind {
  return /sunglasses/i.test(text) ? "sunglasses" : "accessory";
}

const PATHS: Record<ClothingIconKind, { d: string[]; lines?: { x1: number; y1: number; x2: number; y2: number }[]; rects?: { x: number; y: number; w: number; h: number; rx: number }[] }> = {
  jacket: {
    d: ["M9,4 L7,7 L7,19 L17,19 L17,7 L15,4 L12,6.5 Z", "M7,7 L3.5,10 L3.5,15", "M17,7 L20.5,10 L20.5,15"],
  },
  midlayer: {
    d: ["M9,5 Q12,3.3 15,5 L15,19 L9,19 Z", "M9,7 L4.5,9.5 L4.5,14", "M15,7 L19.5,9.5 L19.5,14"],
  },
  base: {
    d: ["M8,4 L4,7.5 L6.5,10.5 L8,9 L8,20 L16,20 L16,9 L17.5,10.5 L20,7.5 L16,4 L13.5,6 L10.5,6 Z"],
  },
  bottoms: {
    d: ["M7,4 L7,20 L10,20 L11,11 L13,11 L14,20 L17,20 L17,4 L13,4 L13,8.5 L11,8.5 L11,4 Z"],
  },
  shoe: {
    d: ["M2,17.5 L2,13 Q2,11.5 3.5,11 L8,9.5 L9,10.5 L14,12 L20,12.5 Q22,12.7 22,15 L22,17.5 Z"],
  },
  umbrella: {
    d: ["M4,13 A8,8 0 0,1 20,13", "M12,20 Q12,23 9,23"],
    lines: [{ x1: 12, y1: 13, x2: 12, y2: 20 }],
  },
  sunglasses: {
    d: [],
    rects: [
      { x: 2.5, y: 9, w: 7, h: 6, rx: 2 },
      { x: 14.5, y: 9, w: 7, h: 6, rx: 2 },
    ],
    lines: [
      { x1: 9.5, y1: 11, x2: 14.5, y2: 11 },
      { x1: 2.5, y1: 10.5, x2: 0.5, y2: 9 },
      { x1: 21.5, y1: 10.5, x2: 23.5, y2: 9 },
    ],
  },
  accessory: {
    d: ["M7,10 Q7,5 11,5 Q15,5 15,10 L15,18 Q15,20 13,20 L9,20 Q7,20 7,18 Z", "M7,11 Q4,11 4,14 Q4,16 6,16 L7,16"],
  },
};

export default function ClothingTypeIcon({ kind, size = 16, color }: Props) {
  const spec = PATHS[kind];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {spec.d.map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {spec.rects?.map((r, i) => (
        <Rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} stroke={color} strokeWidth={1.8} />
      ))}
      {spec.lines?.map((l, i) => (
        <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      ))}
    </Svg>
  );
}

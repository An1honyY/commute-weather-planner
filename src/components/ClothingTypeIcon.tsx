import Svg, { Line, Path, Rect } from "react-native-svg";

// docs/09-design-system.md §9.3/§9.4 (2026-07-21) — small line-icon glyphs
// paired with every clothing/accessory recommendation ("icon + item name",
// never bare text), one fixed icon per slot kind — not per-item art (gear
// photos stay exactly as they are in Gear/Journey Detail).
//
// UI/UX polish pass 2 (2026-07-23): jacket/base/shoe/umbrella/sunglasses/
// accessory paths are adapted from Tabler Icons (github.com/tabler/
// tabler-icons, MIT, no attribution required) — same 24x24 viewBox as this
// file's own convention, near-identical stroke width — after the
// hand-drawn originals didn't read clearly at a glance (the jacket glyph
// in particular didn't look like a jacket). Only geometry is reused; this
// component still applies its own strokeWidth/colour at render time, not
// Tabler's source styling. midlayer/bottoms/vehicle stay hand-drawn —
// simple enough silhouettes not to need an external source. See
// DECISIONS.md.
export type ClothingIconKind =
  | "jacket"
  | "midlayer"
  | "base"
  | "bottoms"
  | "shoe"
  | "umbrella"
  | "sunglasses"
  | "accessory"
  | "vehicle";

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
  // Tabler Icons "jacket" (MIT) — a winter coat with a V-neck collar and
  // two flapped side pockets, unlike the old unrecognisable outline.
  jacket: {
    d: [
      "M16,3l-4,5l-4,-5",
      "M12,19a2,2,0,0,1,-2,2h-4a2,2,0,0,1,-2,-2v-8.172a2,2,0,0,1,.586,-1.414l.828,-.828a2,2,0,0,0,.586,-1.414v-2.172a2,2,0,0,1,2,-2h8a2,2,0,0,1,2,2v2.172a2,2,0,0,0,.586,1.414l.828,.828a2,2,0,0,1,.586,1.414v8.172a2,2,0,0,1,-2,2h-4a2,2,0,0,1,-2,-2",
      "M20,13h-3a1,1,0,0,0,-1,1v2a1,1,0,0,0,1,1h3",
      "M4,17h3a1,1,0,0,0,1,-1v-2a1,1,0,0,0,-1,-1h-3",
      "M12,19v-11",
    ],
  },
  // Hand-drawn — a sleeveless vest/gilet, distinguished from the jacket by
  // its cut-away armholes and lack of a collar/lapel.
  midlayer: {
    d: [
      "M9,4.5 Q12,3 15,4.5 L15,19.5 L12,17.5 L9,19.5 Z",
      "M9,4.5 L6.5,6 L7,10.5",
      "M15,4.5 L17.5,6 L17,10.5",
    ],
  },
  // Tabler Icons "shirt" (MIT) — a t-shirt collar/sleeve silhouette.
  base: {
    d: ["M15,4l6,2v5h-3v8a1,1,0,0,1,-1,1h-10a1,1,0,0,1,-1,-1v-8h-3v-5l6,-2a3,3,0,0,0,6,0"],
  },
  // Hand-drawn — a simple trouser silhouette: waistband + two legs split
  // by a centre seam.
  bottoms: {
    d: ["M7,4 L17,4 L17,20 L13.5,20 L12,10 L10.5,20 L7,20 Z", "M7,7 L17,7"],
  },
  // Tabler Icons "shoe" (MIT).
  shoe: {
    d: [
      "M4,6h5.426a1,1,0,0,1,.863,.496l1.064,1.823a3,3,0,0,0,1.896,1.407l4.677,1.114a4,4,0,0,1,3.074,3.89v2.27a1,1,0,0,1,-1,1h-16a1,1,0,0,1,-1,-1v-10a1,1,0,0,1,1,-1",
      "M14,13l1,-2",
      "M8,18v-1a4,4,0,0,0,-4,-4h-1",
      "M10,12l1.5,-3",
    ],
  },
  // Tabler Icons "umbrella" (MIT).
  umbrella: {
    d: ["M4,12a8,8,0,0,1,16,0l-16,0", "M12,12v6a2,2,0,0,0,4,0"],
  },
  // Tabler Icons "sunglasses" (MIT).
  sunglasses: {
    d: [
      "M8,4h-2l-3,10",
      "M16,4h2l3,10",
      "M10,16h4",
      "M21,16.5a3.5,3.5,0,0,1,-7,0v-2.5h7v2.5",
      "M10,16.5a3.5,3.5,0,0,1,-7,0v-2.5h7v2.5",
      "M4,14l4.5,4.5",
      "M15,14l4.5,4.5",
    ],
  },
  // Tabler Icons "backpack" (MIT) — a generic carried-accessory glyph
  // (bag), used whenever the free-text accessory name isn't sunglasses.
  accessory: {
    d: [
      "M5,18v-6a6,6,0,0,1,6,-6h2a6,6,0,0,1,6,6v6a3,3,0,0,1,-3,3h-8a3,3,0,0,1,-3,-3",
      "M10,6v-1a2,2,0,1,1,4,0v1",
      "M9,21v-4a2,2,0,0,1,2,-2h2a2,2,0,0,1,2,2v4",
      "M11,10h2",
    ],
  },
  // Tabler Icons "car" (MIT) — used by GearThumbnail's vehicle rows.
  vehicle: {
    d: [
      "M5,17a2,2,0,1,0,4,0a2,2,0,1,0,-4,0",
      "M15,17a2,2,0,1,0,4,0a2,2,0,1,0,-4,0",
      "M5,17h-2v-6l2,-5h9l4,5h1a2,2,0,0,1,2,2v4h-2m-4,0h-6m-6,-6h15m-6,0v-5",
    ],
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

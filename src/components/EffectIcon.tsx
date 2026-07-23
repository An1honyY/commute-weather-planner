import Svg, { Path } from "react-native-svg";
import type { EnvironmentEffectType } from "../types";

// UI/UX polish pass 2 — replaces effectMeta.ts's emoji `icon` field with a
// real glyph, same 24x24/stroke-1.8 convention as the app's other icon
// sets. wind-sheltered/shaded/rain-cover/sun-exposed adapt Tabler Icons
// (MIT) paths (building/tree/umbrella/sun); wind-tunnel and high-reflection
// are hand-drawn — a "wind between two buildings" and a "reflective water"
// glyph aren't standard enough icons to reliably find a matching source
// for, but are simple enough to draw clearly.
const PATHS: Record<EnvironmentEffectType, string[]> = {
  "wind-tunnel": ["M4,4v16", "M20,4v16", "M4,9l4,0m-1.5,-2l1.5,2l-1.5,2", "M20,15l-4,0m1.5,-2l-1.5,2l1.5,2"],
  "wind-sheltered": [
    "M3,21l18,0",
    "M9,8l1,0",
    "M9,12l1,0",
    "M9,16l1,0",
    "M14,8l1,0",
    "M14,12l1,0",
    "M14,16l1,0",
    "M5,21v-16a2,2,0,0,1,2,-2h10a2,2,0,0,1,2,2v16",
  ],
  "rain-cover": ["M4,13a8,8,0,0,1,16,0l-16,0", "M12,13v6a2,2,0,0,0,4,0"],
  "sun-exposed": ["M8,12a4,4,0,1,0,8,0a4,4,0,1,0,-8,0", "M3,12h1m8,-9v1m8,8h1m-9,8v1m-6.4,-15.4l.7,.7m12.1,-.7l-.7,.7m0,11.4l.7,.7m-12.1,-.7l-.7,.7"],
  shaded: [
    "M12,13l-2,-2",
    "M12,12l2,-2",
    "M12,21v-13",
    "M9.824,16a3,3,0,0,1,-2.743,-3.69a3,3,0,0,1,.304,-4.833a3,3,0,0,1,4.615,-3.707a3,3,0,0,1,4.614,3.707a3,3,0,0,1,.305,4.833a3,3,0,0,1,-2.919,3.695h-4l-.176,-.005",
  ],
  "high-reflection": ["M3,9q2,-2.5,4,0t4,0t4,0t4,0", "M3,15q2,-2.5,4,0t4,0t4,0t4,0", "M3,21q2,-2.5,4,0t4,0t4,0t4,0"],
};

interface Props {
  kind: EnvironmentEffectType;
  size?: number;
  color: string;
}

export default function EffectIcon({ kind, size = 16, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {PATHS[kind].map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

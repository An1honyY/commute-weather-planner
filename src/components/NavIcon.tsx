import Svg, { Circle, Line, Path } from "react-native-svg";

// Bottom-tab and header-button iconography — closes the gap MainTabs.tsx's
// own comment flagged ("small text-button header icons stand in for the
// real iconography... until that pass lands"). Same line-icon convention
// ClothingTypeIcon.tsx already established: 24x24 viewBox, stroke-only,
// strokeWidth ~1.8, round caps/joins, no fill — one glyph per nav
// destination rather than per-item art, kept in its own file since this
// set is unrelated to clothing (no shared PATHS lookup with
// ClothingTypeIcon makes sense here).
export type NavIconKind = "today" | "plan" | "locations" | "gear" | "settings" | "history" | "localKnowledge";

interface Props {
  kind: NavIconKind;
  size?: number;
  color: string;
}

export default function NavIcon({ kind, size = 22, color }: Props) {
  const stroke = { stroke: color, strokeWidth: 1.8, fill: "none" as const };
  const cap = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {kind === "today" && (
        <>
          <Circle cx={12} cy={12} r={5} {...stroke} />
          <Line x1={12} y1={1} x2={12} y2={3} {...stroke} {...cap} />
          <Line x1={12} y1={21} x2={12} y2={23} {...stroke} {...cap} />
          <Line x1={4.22} y1={4.22} x2={5.64} y2={5.64} {...stroke} {...cap} />
          <Line x1={18.36} y1={18.36} x2={19.78} y2={19.78} {...stroke} {...cap} />
          <Line x1={1} y1={12} x2={3} y2={12} {...stroke} {...cap} />
          <Line x1={21} y1={12} x2={23} y2={12} {...stroke} {...cap} />
          <Line x1={4.22} y1={19.78} x2={5.64} y2={18.36} {...stroke} {...cap} />
          <Line x1={18.36} y1={5.64} x2={19.78} y2={4.22} {...stroke} {...cap} />
        </>
      )}
      {kind === "plan" && (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Path d="M15,9 L13,13 L9,15 L11,11 Z" {...stroke} {...cap} />
        </>
      )}
      {kind === "locations" && (
        <>
          <Path
            d="M12 2C7.6 2 4 5.6 4 10c0 5.6 7 11.5 7.3 11.7a1 1 0 0 0 1.4 0C13 21.5 20 15.6 20 10c0-4.4-3.6-8-8-8Z"
            {...stroke}
          />
          <Circle cx={12} cy={10} r={2.3} {...stroke} />
        </>
      )}
      {kind === "gear" && (
        <>
          <Circle cx={12} cy={4.8} r={1.3} stroke={color} strokeWidth={1.6} fill="none" />
          <Line x1={12} y1={6.1} x2={12} y2={8.2} {...stroke} {...cap} />
          <Path
            d="M4,17 Q2.7,15.6 4.2,14.4 L11.2,8.6 Q12,8 12.8,8.6 L19.8,14.4 Q21.3,15.6 20,17"
            {...stroke}
            {...cap}
          />
        </>
      )}
      {kind === "settings" && (
        <>
          <Line x1={4} y1={21} x2={4} y2={14} {...stroke} {...cap} />
          <Line x1={4} y1={10} x2={4} y2={3} {...stroke} {...cap} />
          <Line x1={12} y1={21} x2={12} y2={12} {...stroke} {...cap} />
          <Line x1={12} y1={8} x2={12} y2={3} {...stroke} {...cap} />
          <Line x1={20} y1={21} x2={20} y2={16} {...stroke} {...cap} />
          <Line x1={20} y1={12} x2={20} y2={3} {...stroke} {...cap} />
          <Line x1={1} y1={14} x2={7} y2={14} {...stroke} {...cap} />
          <Line x1={9} y1={8} x2={15} y2={8} {...stroke} {...cap} />
          <Line x1={17} y1={16} x2={23} y2={16} {...stroke} {...cap} />
        </>
      )}
      {kind === "history" && (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Line x1={12} y1={12} x2={12} y2={7} {...stroke} {...cap} />
          <Line x1={12} y1={12} x2={15.5} y2={13.5} {...stroke} {...cap} />
        </>
      )}
      {kind === "localKnowledge" && (
        <>
          <Path
            d="M10,4C6.7,4 4,6.7 4,10c0,4.5 5.5,9.2 5.8,9.4a0.8,0.8 0 0 0 1.1,0C11.2,19.2 16,14.5 16,10c0-3.3-2.7-6-6-6Z"
            {...stroke}
          />
          <Circle cx={10} cy={10} r={2.1} {...stroke} />
          <Path d="M19,2.5 L19.6,4.4 L21.5,5 L19.6,5.6 L19,7.5 L18.4,5.6 L16.5,5 L18.4,4.4 Z" stroke={color} strokeWidth={1.4} strokeLinejoin="round" fill="none" />
        </>
      )}
    </Svg>
  );
}

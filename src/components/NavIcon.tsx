import Svg, { Circle, Line, Path } from "react-native-svg";

// Bottom-tab and header-button iconography — closes the gap MainTabs.tsx's
// own comment flagged ("small text-button header icons stand in for the
// real iconography... until that pass lands"). Same line-icon convention
// ClothingTypeIcon.tsx already established: 24x24 viewBox, stroke-only,
// strokeWidth ~1.8, round caps/joins, no fill — one glyph per nav
// destination rather than per-item art, kept in its own file since this
// set is unrelated to clothing (no shared PATHS lookup with
// ClothingTypeIcon makes sense here). "gear" is the one exception (see
// below) — a filled glyph traced from a user-supplied reference SVG rather
// than a hand-drawn stroke icon, after two freehand attempts at a
// hook-and-triangle hanger were both rejected as unrecognizable.
export type NavIconKind = "today" | "plan" | "locations" | "gear" | "settings" | "history" | "localKnowledge";

interface Props {
  kind: NavIconKind;
  size?: number;
  color: string;
}

// Traced verbatim from the user-supplied reference SVG (a coat-hanger icon
// from svgrepo.com — hook + a fully closed/hollow triangle body), only the
// fill color changed from the reference's hardcoded black. Own viewBox
// (matching the reference's native 56.751x56.75 coordinate space) rather
// than force-fitting it into the other icons' 24x24 stroke convention —
// this is a filled silhouette, not a stroke path, so rescaling the raw
// numbers into 24x24 would risk exactly the kind of hand-transcription
// error that made the previous two attempts unrecognizable. The two
// "M...Z" subpaths in one `d` combine under the default nonzero fill-rule
// to render the triangle as hollow (a hanger drawn as a wire outline), not
// solid — confirmed by rendering the reference standalone before wiring
// this in.
const GEAR_PATH_D =
  "M56.072,43.004l-27.25-18.5c-0.032-0.021-0.074-0.04-0.124-0.058c-0.07-0.025-0.13-0.44-0.13-0.934" +
  "s0.42-1.056,0.884-1.356c1.551-1.002,2.591-2.767,2.591-4.685c0-3.873-2.628-6.476-6.54-6.476c-3.01,0-5.525,1.992-6.262,4.956" +
  "c-0.199,0.804,0.291,1.617,1.095,1.817c0.806,0.202,1.617-0.291,1.817-1.095c0.398-1.603,1.743-2.679,3.35-2.679" +
  "c2.25,0,3.54,1.267,3.54,3.476c0,1.211-0.995,2.366-2.173,2.524c-0.745,0.099-1.302,0.734-1.302,1.486v1.908" +
  "c0,0.553-0.105,1.021-0.232,1.059c-0.092,0.028-0.167,0.06-0.217,0.096l-24.5,18.5c-0.526,0.381-0.746,1.059-0.546,1.676" +
  "c0.2,0.619,0.776,1.037,1.427,1.037h53.751c0.663,0,1.248-0.436,1.438-1.07S56.628,43.367,56.072,43.004z M49.224,42.758H7.123" +
  "c-0.553,0-0.619-0.234-0.149-0.524l17.642-10.892c1.342-0.974,3.553-1.026,4.938-0.119L49.35,42.272" +
  "C49.832,42.542,49.775,42.758,49.224,42.758z";

export default function NavIcon({ kind, size = 22, color }: Props) {
  const stroke = { stroke: color, strokeWidth: 1.8, fill: "none" as const };
  const cap = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (kind === "gear") {
    return (
      <Svg width={size} height={size} viewBox="0 0 56.751 56.75" fill="none">
        <Path d={GEAR_PATH_D} fill={color} />
      </Svg>
    );
  }

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
      {kind === "settings" && (
        <>
          <Circle cx={12} cy={12} r={3.2} {...stroke} />
          <Circle cx={12} cy={12} r={6.3} {...stroke} />
          <Line x1={12} y1={2.3} x2={12} y2={4.6} stroke={color} strokeWidth={2.2} {...cap} />
          <Line x1={12} y1={19.4} x2={12} y2={21.7} stroke={color} strokeWidth={2.2} {...cap} />
          <Line x1={2.3} y1={12} x2={4.6} y2={12} stroke={color} strokeWidth={2.2} {...cap} />
          <Line x1={19.4} y1={12} x2={21.7} y2={12} stroke={color} strokeWidth={2.2} {...cap} />
          <Line x1={5.66} y1={5.66} x2={7.29} y2={7.29} stroke={color} strokeWidth={2.2} {...cap} />
          <Line x1={16.71} y1={16.71} x2={18.34} y2={18.34} stroke={color} strokeWidth={2.2} {...cap} />
          <Line x1={5.66} y1={18.34} x2={7.29} y2={16.71} stroke={color} strokeWidth={2.2} {...cap} />
          <Line x1={16.71} y1={7.29} x2={18.34} y2={5.66} stroke={color} strokeWidth={2.2} {...cap} />
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

import Svg, { Circle, Line, Path } from "react-native-svg";

// Bottom-tab and header-button iconography — closes the gap MainTabs.tsx's
// own comment flagged ("small text-button header icons stand in for the
// real iconography... until that pass lands"). Same line-icon convention
// ClothingTypeIcon.tsx already established: 24x24 viewBox, stroke-only,
// strokeWidth ~1.8, round caps/joins, no fill — one glyph per nav
// destination rather than per-item art, kept in its own file since this
// set is unrelated to clothing (no shared PATHS lookup with
// ClothingTypeIcon makes sense here). Two exceptions, both because a
// hand-drawn attempt was rejected and a user-supplied reference SVG was
// traced verbatim instead (own stroke-width where the reference's differs
// from this file's usual ~1.8, rather than forcing a mismatch): "gear" (a
// filled hanger silhouette, own viewBox — see GEAR_PATH_D below) and
// "settings" (a real cog, strokeWidth 1.5, same 24x24 viewBox as everything
// else so it needed no special-casing beyond the path data itself).
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
          <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.5} />
          <Path
            d="M13.7654 2.15224C13.3978 2 12.9319 2 12 2C11.0681 2 10.6022 2 10.2346 2.15224C9.74457 2.35523 9.35522 2.74458 9.15223 3.23463C9.05957 3.45834 9.0233 3.7185 9.00911 4.09799C8.98826 4.65568 8.70226 5.17189 8.21894 5.45093C7.73564 5.72996 7.14559 5.71954 6.65219 5.45876C6.31645 5.2813 6.07301 5.18262 5.83294 5.15102C5.30704 5.08178 4.77518 5.22429 4.35436 5.5472C4.03874 5.78938 3.80577 6.1929 3.33983 6.99993C2.87389 7.80697 2.64092 8.21048 2.58899 8.60491C2.51976 9.1308 2.66227 9.66266 2.98518 10.0835C3.13256 10.2756 3.3397 10.437 3.66119 10.639C4.1338 10.936 4.43789 11.4419 4.43786 12C4.43783 12.5581 4.13375 13.0639 3.66118 13.3608C3.33965 13.5629 3.13248 13.7244 2.98508 13.9165C2.66217 14.3373 2.51966 14.8691 2.5889 15.395C2.64082 15.7894 2.87379 16.193 3.33973 17C3.80568 17.807 4.03865 18.2106 4.35426 18.4527C4.77508 18.7756 5.30694 18.9181 5.83284 18.8489C6.07289 18.8173 6.31632 18.7186 6.65204 18.5412C7.14547 18.2804 7.73556 18.27 8.2189 18.549C8.70224 18.8281 8.98826 19.3443 9.00911 19.9021C9.02331 20.2815 9.05957 20.5417 9.15223 20.7654C9.35522 21.2554 9.74457 21.6448 10.2346 21.8478C10.6022 22 11.0681 22 12 22C12.9319 22 13.3978 22 13.7654 21.8478C14.2554 21.6448 14.6448 21.2554 14.8477 20.7654C14.9404 20.5417 14.9767 20.2815 14.9909 19.902C15.0117 19.3443 15.2977 18.8281 15.781 18.549C16.2643 18.2699 16.8544 18.2804 17.3479 18.5412C17.6836 18.7186 17.927 18.8172 18.167 18.8488C18.6929 18.9181 19.2248 18.7756 19.6456 18.4527C19.9612 18.2105 20.1942 17.807 20.6601 16.9999C21.1261 16.1929 21.3591 15.7894 21.411 15.395C21.4802 14.8691 21.3377 14.3372 21.0148 13.9164C20.8674 13.7243 20.6602 13.5628 20.3387 13.3608C19.8662 13.0639 19.5621 12.558 19.5621 11.9999C19.5621 11.4418 19.8662 10.9361 20.3387 10.6392C20.6603 10.4371 20.8675 10.2757 21.0149 10.0835C21.3378 9.66273 21.4803 9.13087 21.4111 8.60497C21.3592 8.21055 21.1262 7.80703 20.6602 7C20.1943 6.19297 19.9613 5.78945 19.6457 5.54727C19.2249 5.22436 18.693 5.08185 18.1671 5.15109C17.9271 5.18269 17.6837 5.28136 17.3479 5.4588C16.8545 5.71959 16.2644 5.73002 15.7811 5.45096C15.2977 5.17191 15.0117 4.65566 14.9909 4.09794C14.9767 3.71848 14.9404 3.45833 14.8477 3.23463C14.6448 2.74458 14.2554 2.35523 13.7654 2.15224Z"
            stroke={color}
            strokeWidth={1.5}
          />
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

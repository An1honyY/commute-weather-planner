import { StyleSheet } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";
import useTheme from "../theme/useTheme";

// A very subtle dot-grid wash for screen backgrounds — gives light mode
// (plain near-white otherwise) a touch of branded texture and depth without
// competing with content. Rendered absolutely behind a screen's scroll
// content; the dots only show in the gaps around opaque cards. Kept low
// opacity on purpose (§9.0's glanceability-first principle) — decoration,
// never a foreground element.
interface Props {
  // Defaults to the theme's patternTint; callers can override to match a
  // mood-tinted background (Today tab).
  tint?: string;
  opacity?: number;
}

const CELL = 26;

export default function ScreenPattern({ tint, opacity }: Props) {
  const theme = useTheme();
  const color = tint ?? theme.patternTint;
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width="100%"
      height="100%"
      pointerEvents="none"
      opacity={opacity ?? (theme.isLight ? 0.5 : 0.35)}
    >
      <Defs>
        <Pattern id="cwp-dots" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
          <Circle cx={2} cy={2} r={1.4} fill={color} opacity={0.35} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#cwp-dots)" />
    </Svg>
  );
}

import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import useTheme from "../theme/useTheme";
import { SPACING, TYPE } from "../theme/typography";

// Shared label(+description)+control row — generalizes the flex-constrained
// layout WarmthSlider.tsx's substitutesRow/substitutesTextCol already got
// right (src/components/WarmthSlider.tsx). Every screen that instead used
// a bare `flexDirection: "row", justifyContent: "space-between"` row with
// no width cap on the label stretches the label and control to opposite
// edges of the screen on a wide web viewport — this fixes that everywhere
// at once rather than per-file. The label column caps at maxWidth so it
// doesn't stretch arbitrarily wide either; the control sits fixed-width on
// the trailing edge, close to the label regardless of viewport.
interface Props {
  label: string;
  description?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export default function FormRow({ label, description, style, children }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={[styles.row, style]}>
      <View style={styles.textCol}>
        <Text style={styles.label}>{label}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      {children}
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, minHeight: 44 },
    textCol: { flex: 1, flexShrink: 1, maxWidth: 420 },
    label: { ...TYPE.body, fontWeight: "600", color: theme.textPrimary },
    description: { ...TYPE.caption, color: theme.textSecondary, marginTop: 2 },
  });
}

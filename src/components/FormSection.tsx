import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import useTheme from "../theme/useTheme";
import { cardElevationStyle } from "../theme/tokens";
import { RADIUS, SPACING, TYPE } from "../theme/typography";

// Groups a form's fields into a titled card — same visual language as
// SettingsScreen's sectionCard, generalized for reuse across the gear/
// location/annotation add-edit forms. Those forms used to be one long,
// flat column of labels and inputs (add photo, name, type, warmth,
// waterproof/windproof/packable, tags, all with no visual grouping) —
// reading like a plain website form rather than a set of related
// decisions grouped for a mobile screen. A form using this should still
// keep its primary identity field (name/photo) as the first section, then
// group the rest by what they're actually deciding together, not just by
// what order the old flat list happened to have them in.
interface Props {
  title: string;
  description?: string;
  children: ReactNode;
}

export default function FormSection({ title, description, children }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.card}>
        {description && <Text style={styles.description}>{description}</Text>}
        {children}
      </View>
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    wrapper: { marginTop: SPACING.lg },
    title: { ...TYPE.caption, fontWeight: "600", color: theme.textSecondary, marginBottom: SPACING.sm },
    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.lg,
      gap: SPACING.md,
      ...cardElevationStyle(theme),
    },
    description: { ...TYPE.caption, color: theme.textSecondary },
  });
}

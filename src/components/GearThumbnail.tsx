import { Image, StyleSheet, Text, View } from "react-native";
import useTheme from "../theme/useTheme";

// Small list-row thumbnail — docs/03-data-models.md §3.3: "~40px thumbnail
// next to the item name wherever gear is listed... missing photo falls back
// to a simple type-based icon, never a broken-image placeholder."
const TYPE_GLYPH: Record<"clothing" | "shoe" | "umbrella" | "vehicle", string> = {
  clothing: "👕",
  shoe: "👟",
  umbrella: "☂",
  vehicle: "🚗",
};

interface Props {
  photoUri: string | undefined;
  kind: "clothing" | "shoe" | "umbrella" | "vehicle";
  dimmed?: boolean; // §9.4.3 — unavailable items dim to 60% opacity
}

export default function GearThumbnail({ photoUri, kind, dimmed }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <View style={[styles.container, dimmed && styles.dimmed]}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.image} />
      ) : (
        <Text style={styles.glyph}>{TYPE_GLYPH[kind]}</Text>
      )}
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: theme.bg,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    dimmed: { opacity: 0.6 },
    image: { width: "100%", height: "100%" },
    glyph: { fontSize: 18 },
  });
}

import { Image, StyleSheet, View } from "react-native";
import useTheme from "../theme/useTheme";
import ClothingTypeIcon, { type ClothingIconKind } from "./ClothingTypeIcon";

// Small list-row thumbnail — docs/03-data-models.md §3.3: "~40px thumbnail
// next to the item name wherever gear is listed... missing photo falls back
// to a simple type-based icon, never a broken-image placeholder." Reuses
// ClothingTypeIcon (UI/UX polish pass 2) instead of a separate emoji map —
// every ClothingIconKind (including shoe/umbrella/vehicle) already has a
// real glyph there.
interface Props {
  photoUri: string | undefined;
  kind: ClothingIconKind;
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
        <ClothingTypeIcon kind={kind} size={20} color={theme.textSecondary} />
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
  });
}

import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import useTheme from "../theme/useTheme";

// Custom header back control replacing React Navigation's platform default —
// a rounded accent-tinted chip with a chevron, matching the app's own
// NavIcon stroke style (24×24 viewBox, ~1.8 stroke) rather than the bare
// OS-native arrow. Wired as the stack navigator's default `headerLeft`
// (RootNavigator) so every pushed screen gets it consistently.
interface Props {
  onPress: () => void;
  label?: string;
}

export default function HeaderBackButton({ onPress, label = "Back" }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path
            d="M15 5l-7 7 7 7"
            stroke={theme.accentWalk}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    button: { flexDirection: "row", alignItems: "center", gap: 4, paddingRight: 12, paddingVertical: 4 },
    pressed: { opacity: 0.55 },
    iconWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.isLight ? "#FBE7F0" : theme.surfaceRaised,
    },
    label: { fontSize: 16, color: theme.accentWalk, fontWeight: "500" },
  });
}

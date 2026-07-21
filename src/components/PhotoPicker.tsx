import { useState } from "react";
import { ActionSheetIOS, Alert, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
// expo-file-system's SDK 54+ default export replaced documentDirectory/
// copyAsync with a new File/Directory class API — `expo-file-system/legacy`
// keeps the string-path API docs/03-data-models.md §3.3 is written against.
import * as FileSystem from "expo-file-system/legacy";
import useTheme from "../theme/useTheme";

// Optional photo well for gear add/edit forms — docs/03-data-models.md §3.3.
// Camera or library via an action sheet, resized/compressed to an 800px
// long edge at ~0.7 JPEG quality, copied into
// `${documentDirectory}gear-photos/{itemId}.jpg` (overwritten in place on
// re-capture) so the photo survives the user deleting it from their camera
// roll. `itemId` must be stable across the whole add flow — the owning
// form generates it up front via rowMapping.newId(), even for a
// not-yet-saved item, specifically so this component has somewhere to
// write to before "Save" is tapped.
const PHOTO_DIR = `${FileSystem.documentDirectory}gear-photos/`;

interface Props {
  itemId: string;
  photoUri: string | undefined;
  onChange: (photoUri: string | undefined) => void;
}

async function ensurePhotoDir() {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

async function processAndStore(uri: string, itemId: string): Promise<string> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  await ensurePhotoDir();
  const dest = `${PHOTO_DIR}${itemId}.jpg`;
  await FileSystem.copyAsync({ from: manipulated.uri, to: dest });
  // Cache-bust the thumbnail — same filename, different content on re-capture.
  return `${dest}?t=${Date.now()}`;
}

export default function PhotoPicker({ itemId, photoUri, onChange }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [busy, setBusy] = useState(false);

  async function pickFrom(source: "camera" | "library") {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow access to add a photo.");
      return;
    }
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 1 });
    if (result.canceled || !result.assets[0]) return;

    setBusy(true);
    try {
      const stored = await processAndStore(result.assets[0].uri, itemId);
      onChange(stored);
    } finally {
      setBusy(false);
    }
  }

  function openPicker() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Take Photo", "Choose from Library"], cancelButtonIndex: 0 },
        (index) => {
          if (index === 1) pickFrom("camera");
          if (index === 2) pickFrom("library");
        }
      );
    } else {
      Alert.alert("Add a photo", undefined, [
        { text: "Take Photo", onPress: () => pickFrom("camera") },
        { text: "Choose from Library", onPress: () => pickFrom("library") },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={openPicker} style={styles.well} disabled={busy}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <Text style={styles.placeholder}>{busy ? "Saving…" : "+ Add photo"}</Text>
        )}
      </Pressable>
      {photoUri && (
        <Pressable onPress={() => onChange(undefined)} hitSlop={8}>
          <Text style={styles.removeLabel}>Remove photo</Text>
        </Pressable>
      )}
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { alignItems: "center", gap: 6 },
    well: {
      width: 96,
      height: 96,
      borderRadius: 12,
      backgroundColor: theme.bg,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    photo: { width: "100%", height: "100%" },
    placeholder: { fontSize: 12, color: theme.textSecondary, textAlign: "center", paddingHorizontal: 8 },
    removeLabel: { fontSize: 12, color: theme.conditionStorm },
  });
}

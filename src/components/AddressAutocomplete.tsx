import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { autocompletePlaces, getPlaceLocation, hasPlacesApiKey, newSessionToken, type PlaceSuggestion } from "../services/placesService";
import useTheme from "../theme/useTheme";

// Google Places-backed address field — docs/02-external-apis.md §2, docs/
// 04-screens-navigation.md §4 "Plan" bullet's "free text via Google Places,
// debounced ~300ms." Shared by LocationForm and onboarding's location step
// rather than each screen re-implementing the debounce/session-token/
// fallback logic. Falls back to a plain text input (no dropdown) when no
// API key is configured — same "not configured is the same shape of
// failure as unreachable" treatment routesService.ts already established.
const DEBOUNCE_MS = 300;

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSelectPlace: (result: { address: string; lat: number; lng: number }) => void;
  placeholder?: string;
}

export default function AddressAutocomplete({ value, onChangeText, onSelectPlace, placeholder }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const sessionTokenRef = useRef(newSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const enabled = hasPlacesApiKey();

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChangeText(text: string) {
    onChangeText(text);
    if (!enabled) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const result = await autocompletePlaces(text, sessionTokenRef.current);
      setSearching(false);
      setSuggestions("data" in result ? result.data : []);
    }, DEBOUNCE_MS);
  }

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    setSuggestions([]);
    setResolving(true);
    const result = await getPlaceLocation(suggestion.placeId, sessionTokenRef.current);
    setResolving(false);
    // A fresh token starts the next autocomplete session — reusing this one
    // past its details call would incorrectly bill the *next* search as
    // part of the session that just completed.
    sessionTokenRef.current = newSessionToken();
    if (!("data" in result)) return;
    const address = result.data.formattedAddress || `${suggestion.primaryText}, ${suggestion.secondaryText}`;
    onChangeText(address);
    onSelectPlace({ address, lat: result.data.lat, lng: result.data.lng });
  }

  return (
    <View>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder ?? "Start typing an address…"}
          placeholderTextColor={theme.textSecondary}
        />
        {(searching || resolving) && <ActivityIndicator size="small" color={theme.textSecondary} style={styles.spinner} />}
      </View>
      {suggestions.length > 0 && (
        <View style={styles.dropdown}>
          {suggestions.map((s) => (
            <Pressable key={s.placeId} onPress={() => selectSuggestion(s)} style={styles.suggestion}>
              <Text style={styles.suggestionPrimary}>{s.primaryText}</Text>
              {s.secondaryText.length > 0 && <Text style={styles.suggestionSecondary}>{s.secondaryText}</Text>}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    inputRow: { flexDirection: "row", alignItems: "center" },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: theme.textPrimary,
    },
    spinner: { position: "absolute", right: 12 },
    dropdown: {
      marginTop: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceRaised,
      overflow: "hidden",
    },
    suggestion: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
    suggestionPrimary: { fontSize: 14, fontWeight: "600", color: theme.textPrimary },
    suggestionSecondary: { fontSize: 12, color: theme.textSecondary, marginTop: 2 },
  });
}

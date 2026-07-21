import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import useTheme from "../../../theme/useTheme";

// docs/04-screens-navigation.md §4.1 step 3 — "the payoff-before-effort
// moment": one real Open-Meteo call before asking for any gear, explicitly
// called out (docs/08-build-phases.md phase 2) as the one place in this
// phase that needs live network data ahead of Phase 4's full weather
// wiring. The condition label below is a small local lookup for this one
// card only — Section 6's classifyWeather() is the canonical version,
// built in Phase 4/6.
const AUCKLAND = { lat: -36.8485, lng: 174.7633 };

function conditionLabel(weatherCode: number): string {
  if (weatherCode === 0) return "Clear";
  if (weatherCode <= 3) return "Partly cloudy";
  if (weatherCode <= 48) return "Foggy";
  if (weatherCode <= 67) return "Rain";
  if (weatherCode <= 77) return "Snow";
  if (weatherCode <= 82) return "Showers";
  return "Stormy";
}

interface DemoWeather {
  tempC: number;
  weatherCode: number;
  isDaylight: boolean;
}

interface Props {
  coords: { lat: number; lng: number } | undefined;
  onNext: () => void;
}

export default function Step3LiveDemo({ coords, onNext }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [weather, setWeather] = useState<DemoWeather | null>(null);
  const [failed, setFailed] = useState(false);

  const location = coords ?? AUCKLAND;
  const isFallback = !coords;

  useEffect(() => {
    const controller = new AbortController();
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}` +
      `&current=temperature_2m,weather_code,is_day&timezone=auto`;
    fetch(url, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        setWeather({
          tempC: data.current.temperature_2m,
          weatherCode: data.current.weather_code,
          isDaylight: data.current.is_day === 1,
        });
      })
      .catch(() => setFailed(true));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once for this onboarding step's fixed location
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Right now</Text>
      {isFallback && <Text style={styles.fallbackLabel}>Example — Auckland</Text>}

      <View style={styles.card}>
        {weather ? (
          <>
            <Text style={styles.temp}>{Math.round(weather.tempC)}°C</Text>
            <Text style={styles.condition}>{conditionLabel(weather.weatherCode)}</Text>
          </>
        ) : failed ? (
          <Text style={styles.body}>Couldn&apos;t fetch conditions right now — that&apos;s okay, you can still continue.</Text>
        ) : (
          <ActivityIndicator />
        )}

        <View style={styles.placeholderRow}>
          <Text style={styles.placeholderText}>If you owned a rain shell, we&apos;d tell you to grab it here.</Text>
        </View>
        <View style={styles.placeholderRow}>
          <Text style={styles.placeholderText}>Your shoes and umbrella picks would show up here too.</Text>
        </View>
      </View>

      <Pressable onPress={onNext} style={styles.primaryButton}>
        <Text style={styles.primaryLabel}>Continue</Text>
      </Pressable>
    </View>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: theme.bg },
    title: { fontSize: 22, fontWeight: "700", color: theme.textPrimary },
    fallbackLabel: { fontSize: 13, color: theme.textSecondary },
    card: { marginTop: 16, padding: 20, borderRadius: 12, backgroundColor: theme.surface, gap: 8 },
    temp: { fontSize: 36, fontWeight: "700", color: theme.textPrimary },
    condition: { fontSize: 15, color: theme.textSecondary },
    body: { fontSize: 14, color: theme.textSecondary },
    placeholderRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border },
    placeholderText: { fontSize: 13, fontStyle: "italic", color: theme.textSecondary },
    primaryButton: { marginTop: 24, paddingVertical: 14, alignItems: "center", borderRadius: 8, backgroundColor: theme.textPrimary },
    primaryLabel: { color: theme.bg, fontWeight: "600", fontSize: 15 },
  });
}

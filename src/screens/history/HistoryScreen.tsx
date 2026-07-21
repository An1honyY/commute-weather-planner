import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, SectionList, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/types";
import { listPastJourneys } from "../../db/repositories/journeys";
import { groupJourneysByDay, type HistorySection } from "../../lib/historyGrouping";
import HistoryRow from "./HistoryRow";
import type { Journey } from "../../types";

// Reverse-chronological read-only journey list — docs/04-screens-navigation.md
// §4.4. A query over real Journey rows (docs/08-build-phases.md Phase 9),
// not a new data model — no separate storage, no pagination beyond a simple
// "load more" past the first page (§4.4).
type Props = NativeStackScreenProps<RootStackParamList, "History">;

const PAGE_SIZE = 30;

export default function HistoryScreen({ navigation }: Props) {
  const [journeys, setJourneys] = useState<Journey[] | undefined>(undefined); // undefined = initial load
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // Lazy initializer — Date.now() is impure to call during render
  // (react-hooks/purity), and a stable "now" avoids rows reshuffling
  // between "Today"/"Yesterday" mid-session.
  const [nowIso] = useState(() => new Date().toISOString());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listPastJourneys(nowIso, PAGE_SIZE, 0).then((page) => {
        if (cancelled) return;
        setJourneys(page);
        setHasMore(page.length === PAGE_SIZE);
      });
      return () => {
        cancelled = true;
      };
    }, [nowIso])
  );

  async function loadMore() {
    if (loadingMore || !hasMore || !journeys) return;
    setLoadingMore(true);
    const nextPage = await listPastJourneys(nowIso, PAGE_SIZE, journeys.length);
    setJourneys([...journeys, ...nextPage]);
    setHasMore(nextPage.length === PAGE_SIZE);
    setLoadingMore(false);
  }

  if (journeys === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (journeys.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.empty}>No past journeys yet</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sections: HistorySection[] = groupJourneysByDay(journeys, new Date(nowIso).getTime());

  return (
    <SafeAreaView style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(journey) => journey.id}
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        renderItem={({ item }) => (
          <HistoryRow
            journey={item}
            onPress={() => navigation.navigate("JourneyDetail", { journeyId: item.id, readOnly: true })}
          />
        )}
        ListFooterComponent={
          hasMore ? (
            <Pressable onPress={loadMore} style={styles.loadMoreButton} disabled={loadingMore}>
              {loadingMore ? <ActivityIndicator /> : <Text style={styles.loadMoreLabel}>Load more</Text>}
            </Pressable>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontSize: 20, fontWeight: "600" },
  empty: { color: "#666" },
  listContent: { padding: 16 },
  sectionHeader: { fontSize: 13, fontWeight: "600", color: "#5C6478", marginBottom: 8, marginTop: 12 },
  loadMoreButton: { alignItems: "center", paddingVertical: 12 },
  loadMoreLabel: { fontWeight: "600", fontSize: 13 },
});

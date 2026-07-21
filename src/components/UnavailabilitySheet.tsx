import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import useTheme from "../theme/useTheme";

// "Mark unavailable until…" action — docs/07-recommendation-engine.md §7.7,
// §7.16, docs/09-design-system.md §9.4.3. A reason picker (Laundry / Repair
// / Lost / Other), each with its own sensible default turnaround the user
// can still nudge via a simple day-count stepper (no date-picker library is
// in the tech stack, docs/01-tech-stack.md, so this stays a relative-days
// control rather than a calendar widget). Doubles as the edit affordance
// when re-opened on an already-unavailable item (pre-filled from its
// current values).
//
// No `visible` boolean prop by design: the caller only mounts this
// component while a sheet should be open (`{target && <UnavailabilitySheet
// key={target.id} .../>}`), so each open is a fresh mount and initial state
// can come straight from props instead of syncing via a setState-in-effect
// (react-hooks/set-state-in-effect).
export type UnavailableReason = "laundry" | "repair" | "lost" | "other";

const DEFAULT_DAYS: Record<UnavailableReason, number | null> = {
  laundry: 2, // LAUNDRY_DEFAULT_TURNAROUND_DAYS, §7.16
  repair: 3,
  other: 3,
  lost: null, // open-ended
};

const REASON_LABEL: Record<UnavailableReason, string> = {
  laundry: "Laundry",
  repair: "Repair",
  lost: "Lost",
  other: "Other",
};

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

interface Props {
  onClose: () => void;
  onConfirm: (result: { unavailableUntil?: string; unavailableReason: UnavailableReason }) => void;
  initialReason?: UnavailableReason;
}

export default function UnavailabilitySheet({ onClose, onConfirm, initialReason }: Props) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const [reason, setReason] = useState<UnavailableReason>(initialReason ?? "laundry");
  const [days, setDays] = useState<number | null>(DEFAULT_DAYS[initialReason ?? "laundry"]);

  function selectReason(next: UnavailableReason) {
    setReason(next);
    setDays(DEFAULT_DAYS[next]);
  }

  function confirm() {
    onConfirm({
      unavailableUntil: days === null ? undefined : daysFromNow(days),
      unavailableReason: reason,
    });
    onClose();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Mark unavailable until…</Text>
          <View style={styles.reasonRow}>
            {(Object.keys(REASON_LABEL) as UnavailableReason[]).map((option) => (
              <Pressable
                key={option}
                onPress={() => selectReason(option)}
                style={[styles.reasonChip, reason === option && styles.reasonChipActive]}
              >
                <Text style={[styles.reasonLabel, reason === option && styles.reasonLabelActive]}>
                  {REASON_LABEL[option]}
                </Text>
              </Pressable>
            ))}
          </View>

          {days === null ? (
            <Text style={styles.turnaround}>No return date — until you mark it available again</Text>
          ) : (
            <View style={styles.stepperRow}>
              <Pressable onPress={() => setDays((d) => Math.max(1, (d ?? 1) - 1))} style={styles.stepperButton}>
                <Text style={styles.stepperButtonLabel}>−</Text>
              </Pressable>
              <Text style={styles.turnaround}>Back in {days} day{days === 1 ? "" : "s"}</Text>
              <Pressable onPress={() => setDays((d) => (d ?? 0) + 1)} style={styles.stepperButton}>
                <Text style={styles.stepperButtonLabel}>+</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.cancelButton}>
              <Text>Cancel</Text>
            </Pressable>
            <Pressable onPress={confirm} style={styles.confirmButton}>
              <Text style={styles.confirmLabel}>Mark unavailable</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function getStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    sheet: { backgroundColor: theme.surfaceRaised, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, gap: 16 },
    title: { fontSize: 17, fontWeight: "600", color: theme.textPrimary },
    reasonRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    reasonChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: theme.border },
    reasonChipActive: { backgroundColor: theme.accentWalk, borderColor: theme.accentWalk },
    reasonLabel: { fontSize: 14, color: theme.textPrimary },
    reasonLabelActive: { color: "#FFFFFF", fontWeight: "600" },
    stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
    stepperButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    stepperButtonLabel: { fontSize: 18, fontWeight: "600", color: theme.textPrimary },
    turnaround: { fontSize: 14, color: theme.textSecondary, textAlign: "center" },
    actions: { flexDirection: "row", gap: 12, justifyContent: "flex-end" },
    cancelButton: { paddingHorizontal: 16, paddingVertical: 10 },
    confirmButton: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: theme.textPrimary, borderRadius: 8 },
    confirmLabel: { color: theme.bg, fontWeight: "600" },
  });
}

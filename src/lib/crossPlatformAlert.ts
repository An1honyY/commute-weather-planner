import { Alert, Platform } from "react-native";

// React Native Web's Alert.alert is a documented no-op — it neither shows a
// dialog nor calls any button's onPress, so any screen that relies on it for
// user-visible feedback (e.g. PlanScreen's "can't plan a route" retry) fails
// completely silently on web. This routes to the real Alert.alert on native
// and to window.alert/confirm on web so the message actually reaches the
// user everywhere.
export interface AlertButtonSpec {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

export function showAlert(title: string, message?: string, buttons?: AlertButtonSpec[]): void {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const primary = buttons.find((b) => b.style !== "cancel") ?? buttons[0];
  const cancel = buttons.find((b) => b.style === "cancel");
  if (window.confirm(text)) {
    primary.onPress?.();
  } else {
    cancel?.onPress?.();
  }
}

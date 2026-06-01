export async function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch (_) {
    return "denied";
  }
}

export function sendBrowserNotification(title, body) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const n = new Notification(title, {
      body,
      icon: "/cat-favicon.png",
      silent: false,
    });
    setTimeout(() => n.close(), 8000);
  } catch (_) {}
}

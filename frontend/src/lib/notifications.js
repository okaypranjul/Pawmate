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

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.warn("SW registration failed", e);
    return null;
  }
}

function getActiveSW() {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return null;
  return (
    navigator.serviceWorker.controller ||
    (navigator.serviceWorker.ready && navigator.serviceWorker.ready.then)
  );
}

export function sendBrowserNotification(title, body, tag) {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    // Prefer service worker notifications so they survive across tab focus changes
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        title,
        body,
        tag,
      });
      return;
    }
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, {
          body,
          icon:
            "https://static.prod-images.emergentagent.com/jobs/ec3808b6-b0af-4f34-8a4a-3ff78eddfdf9/images/0ba86426a286100dc963366cfaaae51f1558d9a882931ee2bda749e8e23c0049.png",
          tag: tag || `pixelpet-${Date.now()}`,
        });
      });
      return;
    }
    const n = new Notification(title, { body });
    setTimeout(() => n.close(), 8000);
  } catch (_) {}
}

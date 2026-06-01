/* PixelPet service worker — handles install/activate and shows system notifications
   triggered by the main thread (postMessage) so reminders reach the user even when
   the tab is unfocused. */

const CACHE = "pixelpet-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SHOW_NOTIFICATION") {
    const { title, body, tag } = data;
    self.registration.showNotification(title || "Pixel pet 🐾", {
      body: body || "",
      icon: "https://static.prod-images.emergentagent.com/jobs/ec3808b6-b0af-4f34-8a4a-3ff78eddfdf9/images/0ba86426a286100dc963366cfaaae51f1558d9a882931ee2bda749e8e23c0049.png",
      badge: "https://static.prod-images.emergentagent.com/jobs/ec3808b6-b0af-4f34-8a4a-3ff78eddfdf9/images/0ba86426a286100dc963366cfaaae51f1558d9a882931ee2bda749e8e23c0049.png",
      tag: tag || `pixelpet-${Date.now()}`,
      requireInteraction: false,
      silent: false,
    });
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ("focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    })
  );
});

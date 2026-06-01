const KEY = "pixelpet_device_id";

// The device id is a non-sensitive random UUID whose entire purpose is to
// persist across visits so the anonymous pet remembers its owner. Using
// localStorage is intentional here — sessionStorage would clear on tab
// close and break the core "remember the pet" feature.
export function getDeviceId() {
  let id = null;
  try {
    id = localStorage.getItem(KEY);
  } catch (e) {
    console.warn("localStorage read failed (private mode?):", e);
  }
  if (!id) {
    id =
      (crypto && crypto.randomUUID && crypto.randomUUID()) ||
      `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(KEY, id);
    } catch (e) {
      console.warn("localStorage write failed (private mode?):", e);
    }
  }
  return id;
}

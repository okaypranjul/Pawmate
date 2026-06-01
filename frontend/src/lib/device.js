const KEY = "pixelpet_device_id";

export function getDeviceId() {
  let id = null;
  try {
    id = localStorage.getItem(KEY);
  } catch (_) {}
  if (!id) {
    id =
      (crypto && crypto.randomUUID && crypto.randomUUID()) ||
      `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(KEY, id);
    } catch (_) {}
  }
  return id;
}

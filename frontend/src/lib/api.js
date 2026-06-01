import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API, timeout: 30000 });

export const api = {
  getPet: (deviceId) =>
    http.get("/pet", { params: { device_id: deviceId } }).then((r) => r.data),
  createPet: (deviceId, name) =>
    http.post("/pet", { device_id: deviceId, name }).then((r) => r.data),
  heartbeat: (deviceId) =>
    http.post(`/pet/heartbeat`, null, { params: { device_id: deviceId } }).then((r) => r.data),

  listNotes: (deviceId) =>
    http.get("/notes", { params: { device_id: deviceId } }).then((r) => r.data),
  createNote: (deviceId, text) =>
    http.post("/notes", { device_id: deviceId, text }).then((r) => r.data),
  deleteNote: (id) => http.delete(`/notes/${id}`).then((r) => r.data),

  listReminders: (deviceId) =>
    http.get("/reminders", { params: { device_id: deviceId } }).then((r) => r.data),
  createReminder: (deviceId, text, localIso) =>
    http
      .post("/reminders", { device_id: deviceId, text, local_iso: localIso })
      .then((r) => r.data),
  deleteReminder: (id) => http.delete(`/reminders/${id}`).then((r) => r.data),
  dueReminders: (deviceId) =>
    http.get("/reminders/due", { params: { device_id: deviceId } }).then((r) => r.data),

  nudge: (deviceId, usedLines) =>
    http.post("/nudge", { device_id: deviceId, used_lines: usedLines }).then((r) => r.data),

  chat: (deviceId, message, history) =>
    http.post("/chat", { device_id: deviceId, message, history }).then((r) => r.data),

  getPrefs: (deviceId) =>
    http.get("/prefs", { params: { device_id: deviceId } }).then((r) => r.data),
  saveSoundPrefs: (deviceId, masterVolume, muted, sounds) =>
    http
      .post("/prefs/sounds", {
        device_id: deviceId,
        master_volume: masterVolume,
        muted,
        sounds,
      })
      .then((r) => r.data),
  recordSession: (deviceId, sessionType, durationMinutes) =>
    http
      .post("/prefs/sessions", {
        device_id: deviceId,
        session_type: sessionType,
        duration_minutes: durationMinutes,
      })
      .then((r) => r.data),
};

export default api;

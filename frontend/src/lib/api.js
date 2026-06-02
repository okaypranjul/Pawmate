import * as chrono from "chrono-node";

// ---- Storage helpers ----
function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function load(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("localStorage write failed:", e);
  }
}

function loadPet() { return load("pixelpet_pet"); }
function savePet(pet) { persist("pixelpet_pet", pet); }

function loadNotes() { return load("pixelpet_notes") || []; }
function saveNotes(notes) { persist("pixelpet_notes", notes); }

function loadReminders() { return load("pixelpet_reminders") || []; }
function saveReminders(reminders) { persist("pixelpet_reminders", reminders); }

function loadPrefs() {
  return load("pixelpet_prefs") || { master_volume: 0.7, muted: false, sounds: [], sessions: {} };
}
function savePrefs(prefs) { persist("pixelpet_prefs", prefs); }

// ---- Static messages (replace LLM) ----
const NUDGE_MESSAGES = [
  "peeking down from up here — you still breathing? 🐾",
  "just a tiny check-in from your corner of the screen",
  "how's it going down there? i've been watching from up high 🐾",
  "psst... remember to blink occasionally",
  "you're doing great — keep it up!",
  "stretching time? i won't tell anyone 🐾",
  "still here if you need me",
  "don't forget to drink some water 🐾",
  "taking notes or taking a nap? either is fine",
  "just a small meow to say hi 🐾",
];

const FOCUS_MESSAGES = {
  deep: [
    "Nice deep work session! 🐾",
    "You crushed that focus block!",
    "deep work done — i'm proud of you! 🐾",
    "another deep session in the books!",
  ],
  flow: [
    "what a flow state session! 🐾",
    "you were totally in the zone!",
    "flow state unlocked — nice work 🐾",
  ],
  break: [
    "good break — you deserved it!",
    "refreshed and ready! 🐾",
    "break time well spent",
  ],
};

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNudge(usedLines = []) {
  const available = NUDGE_MESSAGES.filter((m) => !usedLines.includes(m));
  return randomFrom(available.length > 0 ? available : NUDGE_MESSAGES);
}

function randomFocusMessage(sessionType) {
  return randomFrom(FOCUS_MESSAGES[sessionType] || FOCUS_MESSAGES.deep);
}

// ---- Reminder parsing via chrono-node ----
function parseReminder(text, localIso) {
  const refDate = localIso ? new Date(localIso) : new Date();
  const parsed = chrono.parse(text, refDate, { forwardDate: true });

  if (parsed.length > 0) {
    const result = parsed[0];
    const trigger_at = result.date().toISOString();
    const stripped = text.replace(result.text, "").trim().replace(/^(at|in|on|by)\s+/i, "").trim();
    const raw = stripped || text;
    const content = (raw.charAt(0).toUpperCase() + raw.slice(1)).slice(0, 120);
    return { content, trigger_at };
  }

  return {
    content: (text.charAt(0).toUpperCase() + text.slice(1)).slice(0, 120),
    trigger_at: new Date(refDate.getTime() + 60 * 60 * 1000).toISOString(),
  };
}

// ---- API (matches backend response shapes exactly) ----
export const api = {
  getPet(_deviceId) {
    const pet = loadPet();
    if (!pet) return Promise.resolve({ pet: null, welcome_back: null });

    let welcome_back = null;
    try {
      const gapMin = (Date.now() - new Date(pet.last_interaction).getTime()) / 60000;
      if (gapMin >= 30) {
        const noteCount = loadNotes().length;
        const pendingCount = loadReminders().filter((r) => !r.fired).length;
        welcome_back = `you're back! i kept your ${noteCount} note(s) and ${pendingCount} reminder(s) safe 🐾`;
      }
    } catch {}

    return Promise.resolve({ pet, welcome_back });
  },

  createPet(_deviceId, name) {
    const trimmed = (name || "").trim().slice(0, 30) || "Pixel";
    let pet = loadPet();
    if (pet) {
      pet = { ...pet, name: trimmed, last_interaction: nowIso() };
    } else {
      pet = { id: newId(), device_id: _deviceId, name: trimmed, created_at: nowIso(), last_interaction: nowIso() };
    }
    savePet(pet);
    return Promise.resolve(pet);
  },

  heartbeat(_deviceId) {
    const pet = loadPet();
    if (pet) savePet({ ...pet, last_interaction: nowIso() });
    return Promise.resolve({ ok: true });
  },

  listNotes(_deviceId) {
    const notes = loadNotes();
    return Promise.resolve([...notes].sort((a, b) => b.created_at.localeCompare(a.created_at)));
  },

  createNote(_deviceId, text) {
    const trimmed = (text || "").trim().slice(0, 500);
    if (!trimmed) return Promise.resolve({ error: "empty" });
    const note = { id: newId(), device_id: _deviceId, text: trimmed, created_at: nowIso() };
    saveNotes([...loadNotes(), note]);
    return Promise.resolve(note);
  },

  deleteNote(id) {
    saveNotes(loadNotes().filter((n) => n.id !== id));
    return Promise.resolve({ ok: true });
  },

  listReminders(_deviceId) {
    const reminders = loadReminders();
    return Promise.resolve([...reminders].sort((a, b) => a.trigger_at.localeCompare(b.trigger_at)));
  },

  createReminder(_deviceId, text, localIso) {
    const trimmed = (text || "").trim();
    if (!trimmed) return Promise.resolve({ error: "empty" });
    const { content, trigger_at } = parseReminder(trimmed, localIso);
    const reminder = {
      id: newId(),
      device_id: _deviceId,
      content,
      raw_input: trimmed.slice(0, 500),
      trigger_at,
      fired: false,
      created_at: nowIso(),
    };
    saveReminders([...loadReminders(), reminder]);
    return Promise.resolve(reminder);
  },

  deleteReminder(id) {
    saveReminders(loadReminders().filter((r) => r.id !== id));
    return Promise.resolve({ ok: true });
  },

  dueReminders(_deviceId) {
    const now = new Date().toISOString();
    const reminders = loadReminders();
    const due = reminders.filter((r) => !r.fired && r.trigger_at <= now);
    if (!due.length) return Promise.resolve([]);

    const results = due.map((r) => ({
      ...r,
      message: `hey! reminder: ${r.content} 🐾`,
      fired: true,
    }));
    saveReminders(reminders.map((r) => (due.find((d) => d.id === r.id) ? { ...r, fired: true } : r)));
    return Promise.resolve(results);
  },

  nudge(_deviceId, usedLines) {
    return Promise.resolve({ message: randomNudge(usedLines || []) });
  },

  chat(_deviceId, _message, _history) {
    return Promise.resolve({ reply: "purr 🐾" });
  },

  getPrefs(_deviceId) {
    const prefs = loadPrefs();
    const today = new Date().toISOString().slice(0, 10);
    return Promise.resolve({
      device_id: _deviceId,
      master_volume: prefs.master_volume ?? 0.7,
      muted: !!prefs.muted,
      sounds: prefs.sounds || [],
      today_sessions: (prefs.sessions || {})[today] || 0,
      today,
    });
  },

  saveSoundPrefs(_deviceId, masterVolume, muted, sounds) {
    savePrefs({ ...loadPrefs(), master_volume: masterVolume, muted, sounds });
    return Promise.resolve({ ok: true });
  },

  recordSession(_deviceId, sessionType, _durationMinutes) {
    const today = new Date().toISOString().slice(0, 10);
    const prefs = loadPrefs();
    const sessions = { ...(prefs.sessions || {}) };
    const isWork = sessionType === "deep" || sessionType === "flow";
    if (isWork) sessions[today] = (sessions[today] || 0) + 1;
    savePrefs({ ...prefs, sessions });
    return Promise.resolve({
      today_sessions: sessions[today] || 0,
      message: isWork ? randomFocusMessage(sessionType) : null,
    });
  },
};

export default api;

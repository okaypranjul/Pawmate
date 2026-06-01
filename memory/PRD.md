# PixelPet — Browser-Based Desktop Pet Companion

## Original problem
Build a browser-based desktop pet (a friendly pixel-art cat) that lives along the top of the screen with its home in the top-right. Acts as a notes + reminders companion with LLM-generated personality, proactive popups, natural-language time parsing, persistence across visits, and a cozy minimal pixel-art aesthetic.

## User choices (Feb 2026)
- LLM: **Claude Sonnet 4.5** via Emergent Universal Key (`emergentintegrations`)
- Pet character: **Cat**
- Browser notifications: **ON** (Notification API)
- Identity: **Anonymous device-id** (localStorage UUID), no login
- Aesthetic: simple cozy — Cozy Game UI palette (#E07A5F primary, #F2CC8F secondary, #FDFBF7 panel, #4A3B32 ink), VT323 + Nunito fonts

## Architecture
- **Backend**: FastAPI + MongoDB (motor). All routes under `/api`.
  - Collections: `pets`, `notes`, `reminders`
  - LLM: `anthropic/claude-sonnet-4-5-20250929` via `emergentintegrations.LlmChat`
  - Endpoints: `GET /api/`, `GET/POST /api/pet`, `POST /api/pet/heartbeat`, `GET/POST /api/notes`, `DELETE /api/notes/{id}`, `GET/POST /api/reminders`, `DELETE /api/reminders/{id}`, `GET /api/reminders/due`, `POST /api/nudge`
- **Frontend**: React 19 + Tailwind + framer-motion + lucide-react + sonner.
  - `PetCompanion.jsx` orchestrator (drag + wander + polling + nudges + heartbeat)
  - `CatSprite.jsx`, `SpeechBubble.jsx`, `NotesPanel.jsx`, `NameModal.jsx`
  - `lib/api.js`, `lib/device.js`, `lib/notifications.js`

## Implemented (2026-02)
- First-launch name modal — pet name persisted in MongoDB by device_id
- Pixel-cat sprite (image-rendering: pixelated) anchored fixed top-right with CSS keyframe idle bob, walk wobble, hop, and **focused** animations
- Draggable via framer-motion (springs back home on release; click vs drag detected by movement + dt threshold)
- Idle wander: every 45–90s the cat walks left a random distance, pauses, walks home (skipped while panel open, bubble showing, OR focus session running)
- Click pet → cozy "{name}'s desk" panel with three tabs (reminders / notes / **chat**)
- Reminders: natural-language input parsed by Claude Sonnet 4.5 into `{content, trigger_at, has_time}` (e.g. "lunch at 1pm" → next 13:00 local; "review PR in 2 hours" → +2h)
- Notes: quick text storage, listed newest-first, deletable
- **Chat with the pet**: in-panel chat tab, LLM replies are fourth-wall-aware ("watching the web go by", "from my corner of the screen", etc.)
- Due-reminder polling every 30s — LLM generates a unique in-character bubble line + system Notification (via Service Worker) fires; reminder marked fired
- Nudges: every 20–30 min the LLM generates a fresh in-character check-in (time-of-day aware), skipped if panel/bubble already active; tracks `used_lines` to avoid repeating
- Welcome-back: on GET /api/pet if last_interaction > 30 min ago, LLM produces a recap-aware greeting that auto-pops as a bubble
- Heartbeat every 60s updates `last_interaction`

### Iteration 2 — focus + ambient + PWA
- **Pomodoro focus timer** (left side dock): Deep Work 25 / Flow State 50 / Break 5; start/pause/reset; auto-suggests next session (work → break → work); persistent daily session counter ("N focus sessions today") via `/api/prefs/sessions`; LLM congratulatory message on completion; pet enters calm "focused" animation (subtle sage glow + slow breathing) while a session runs and hops with the congrats line on finish; **gentle chime** when a session ends
- **Ambient sound dock** (right side dock): rain · ocean · forest · café · lo-fi hum · white noise — all **procedurally generated** via Web Audio API (filtered pink/brown/white noise + LFOs + occasional bird chirps for forest + soft sine triad pad for lo-fi). No copyrighted audio. Per-track on/off + volume slider, master volume, global mute. Smooth fade in/out. Preferences persisted via `/api/prefs/sounds`
- **Tasteful UI sounds**: click, pet-tap, complete, chime, reminder, panel-open — all generated tones that respect the global mute
- **PWA**: `/public/manifest.json` (installable as app, standalone, theme colors), updated `index.html` (title, theme-color, manifest link)
- **Service Worker** (`/public/sw.js`) for richer system notifications via `registration.showNotification` (handles install/activate/notificationclick); reminder notifications now route through the SW so they fire reliably even when the tab is unfocused
- New endpoints: `POST /api/chat`, `GET /api/prefs`, `POST /api/prefs/sounds`, `POST /api/prefs/sessions`
- New LLM "focus_complete" prompt for congratulatory lines; existing reminder/check_in prompts updated to be explicitly **fourth-wall-aware**

## Testing
- Iteration 1 (2026-02): 17 pytest backend tests + Playwright e2e — 100% pass on both. No critical or minor blockers.
- Iteration 2 (2026-02): 15 additional pytest backend tests + Playwright e2e (focus timer start/pause/reset, session switch, sound dock toggle/volume/mute/persistence, chat tab user + pet message, PWA manifest reachable, SW registered) — 100% pass on both. No critical issues.

### Iteration 3 — unified cat meow alert (2026-02)
- **~4s cat meow alert** fires for every timed event: deep-work / flow-state / break end + any user reminder coming due. Single consistent "time's up" signal across the whole app.
- 3 short CC-style meow samples (Mixkit License — free for commercial use, no attribution required) chained with small gaps to fill ~3.6–4s, randomized per chain link for natural variation. Files: `/public/sounds/meow.mp3`, `meow_alt.mp3`, `meow_attention.mp3`.
- Audio bus refactor: separate `alertGain` (always at full when not muted) routed through a shared `muteGate` so the meow is **noticeably louder than ambient loops** while still fully respecting the global mute.
- **Ducking**: while the meow plays, the ambient master gain ramps down to ~25% (0.2s ramp), then restores to the user's level (0.5s ramp) after the meow finishes.
- Synced with the pet's happy-hop animation: the bubble (which triggers the hop via `queueBubble`) and the meow fire in the same code path so the sound and visual land together.
- Replaces the previous procedural `ui.chime` (session complete) and `ui.reminder` (reminder due) tones.

## Backlog (P1/P2 — for future iterations)
- P1: Recurring reminders ("every day at 9am")
- P1: Edit existing reminder/note inline
- P1: Snooze a fired reminder by N minutes
- P1: Weekly stats — focus minutes per day, streak
- P2: Multiple pet skins/colors selectable from the panel
- P2: Per-user accounts (Google Auth) so the pet syncs across devices
- P2: Mobile-first compact mode (smaller pet, swipe-up panel)
- P2: Pet "mood" reflecting overdue reminders / streaks
- P2: True background push notifications via Web Push (currently SW notifications require the tab to be open)

## Test credentials
N/A — anonymous device-id auth only (UUID stored in `localStorage` under `pixelpet_device_id`).

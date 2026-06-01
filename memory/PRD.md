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
- Pixel-cat sprite (image-rendering: pixelated) anchored fixed top-right with CSS keyframe idle bob, walk wobble, and hop animations
- Draggable via framer-motion (springs back home on release; click vs drag detected by movement + dt threshold)
- Idle wander: every 45–90s the cat walks left a random distance, pauses, walks home (skipped while panel open or bubble showing)
- Click pet → cozy "{name}'s desk" panel with two tabs (reminders / notes)
- Reminders: natural-language input parsed by Claude Sonnet 4.5 into `{content, trigger_at, has_time}` (e.g. "lunch at 1pm" → next 13:00 local; "review PR in 2 hours" → +2h)
- Notes: quick text storage, listed newest-first, deletable
- Due-reminder polling every 30s — LLM generates a unique in-character bubble line + browser Notification fires; reminder marked fired
- Nudges: every 20–30 min the LLM generates a fresh in-character check-in (time-of-day aware), skipped if panel/bubble already active; tracks `used_lines` to avoid repeating
- Welcome-back: on GET /api/pet if last_interaction > 30 min ago, LLM produces a recap-aware greeting that auto-pops as a bubble
- Heartbeat every 60s updates `last_interaction`
- Cozy landing page beneath the pet showing the concept (feature cards + how-it-works)
- Tailwind palette + VT323/Nunito Google Fonts; chunky hard-shadow Cozy Game UI

## Testing
- Iteration 1 (2026-02): 17 pytest backend tests + Playwright e2e — 100% pass on both. No critical or minor blockers.

## Backlog (P1/P2 — for future iterations)
- P1: Recurring reminders ("every day at 9am")
- P1: Edit existing reminder/note inline
- P1: Snooze a fired reminder by N minutes
- P2: Multiple pet skins/colors selectable from the panel
- P2: Optional sound on reminder fire
- P2: Per-user accounts (Google Auth) so the pet syncs across devices
- P2: Mobile-first compact mode (smaller pet, swipe-up panel)
- P2: Pet "mood" reflecting overdue reminders / streaks

## Test credentials
N/A — anonymous device-id auth only (UUID stored in `localStorage` under `pixelpet_device_id`).

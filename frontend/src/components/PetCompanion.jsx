import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { toast } from "sonner";
import CatSprite from "./CatSprite";
import SpeechBubble from "./SpeechBubble";
import NotesPanel from "./NotesPanel";
import NameModal from "./NameModal";
import { getDeviceId } from "../lib/device";
import api from "../lib/api";
import {
  ensureNotificationPermission,
  sendBrowserNotification,
  registerServiceWorker,
} from "../lib/notifications";
import ui from "../lib/uiSounds";
import { engine } from "../lib/audio";
import useBubble from "../hooks/useBubble";
import useDueReminders from "../hooks/useDueReminders";
import useStroll from "../hooks/useStroll";

const HOME_RIGHT = 24;
const HOME_TOP = 8;
const SPRITE_SIZE = 128;

const HEARTBEAT_MS = 60 * 1000;
const NUDGE_MIN_MS = 20 * 60 * 1000;
const NUDGE_MAX_MS = 30 * 60 * 1000;
const HOP_DURATION_MS = 700;

function randBetween(a, b) {
  return a + Math.random() * (b - a);
}

export default function PetCompanion({ focusRunning, sessionMessage }) {
  const deviceId = useMemo(() => getDeviceId(), []);
  const [pet, setPet] = useState(null);
  const [showName, setShowName] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notes, setNotes] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [facing, setFacing] = useState("left");
  const [petState, setPetState] = useState("walk");

  const usedLinesRef = useRef([]);
  const dragStartRef = useRef(null);
  const focusRunningRef = useRef(focusRunning);
  const panelOpenRef = useRef(false);
  const bubbleRef = useRef(null);
  const pausedRef = useRef(false);
  const x = useMotionValue(0);

  // ---------- Bubble ----------
  const triggerHop = useCallback(() => {
    // Pause walking briefly, do the hop, then resume.
    pausedRef.current = true;
    setPetState("hop");
    setTimeout(() => {
      setPetState("walk");
      if (!panelOpenRef.current) pausedRef.current = false;
    }, HOP_DURATION_MS);
  }, []);

  const { bubble, queueBubble, dismissBubble } = useBubble({ onQueue: triggerHop });

  // keep refs synced
  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);
  useEffect(() => {
    bubbleRef.current = bubble;
  }, [bubble]);
  useEffect(() => {
    focusRunningRef.current = focusRunning;
  }, [focusRunning]);

  // ---------- Initial pet load ----------
  const refreshLists = useCallback(async () => {
    try {
      const [n, r] = await Promise.all([
        api.listNotes(deviceId),
        api.listReminders(deviceId),
      ]);
      setNotes(n || []);
      setReminders(r || []);
    } catch (e) {
      console.warn("refreshLists failed:", e);
    }
  }, [deviceId]);

  useEffect(() => {
    registerServiceWorker();
    let mounted = true;
    (async () => {
      try {
        const data = await api.getPet(deviceId);
        if (!mounted) return;
        if (!data.pet) {
          setShowName(true);
          return;
        }
        setPet(data.pet);
        if (data.welcome_back) queueBubble(data.welcome_back);
        await refreshLists();
      } catch (e) {
        console.warn("initial pet load failed:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [deviceId, queueBubble, refreshLists]);

  // ---------- Naming ----------
  const handleName = async (name) => {
    try {
      const created = await api.createPet(deviceId, name);
      setPet(created);
      setShowName(false);
      const perm = await ensureNotificationPermission();
      if (perm === "granted") {
        toast.success(
          "notifications enabled — i'll let you know when reminders are due"
        );
      }
      queueBubble(`hi! i'm ${name}. tap me anytime to jot a note or a reminder.`);
      await refreshLists();
    } catch (e) {
      console.warn("create pet failed:", e);
      toast.error("hmm, couldn't save the name. try again?");
    }
  };

  // ---------- Walk loop ----------
  const stroll = useStroll({
    pet,
    x,
    pausedRef,
    setFacing,
    setPetState,
    spriteSize: SPRITE_SIZE,
  });

  // ---------- Due reminders + meow ----------
  useDueReminders({
    pet,
    deviceId,
    queueBubble,
    onFired: (d) => {
      setReminders((prev) =>
        prev.map((r) => (r.id === d.id ? { ...r, fired: true } : r))
      );
      usedLinesRef.current.push(d.message);
    },
  });

  // ---------- Heartbeat ----------
  useEffect(() => {
    if (!pet) return undefined;
    const id = setInterval(() => {
      api.heartbeat(deviceId).catch((e) => console.warn("heartbeat failed:", e));
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [pet, deviceId]);

  // ---------- Nudge loop ----------
  useEffect(() => {
    if (!pet) return undefined;
    let cancelled = false;
    let timeout = null;
    const schedule = () => {
      const wait = randBetween(NUDGE_MIN_MS, NUDGE_MAX_MS);
      timeout = setTimeout(async () => {
        if (cancelled) return;
        if (!panelOpenRef.current && !bubbleRef.current) {
          try {
            const { message } = await api.nudge(deviceId, usedLinesRef.current);
            if (message && !cancelled) {
              queueBubble(message);
              usedLinesRef.current.push(message);
            }
          } catch (e) {
            console.warn("nudge fetch failed:", e);
          }
        }
        schedule();
      }, wait);
    };
    schedule();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [pet, deviceId, queueBubble]);

  // ---------- Focus session completion ----------
  useEffect(() => {
    if (!sessionMessage || !sessionMessage.text) return;
    queueBubble(sessionMessage.text);
    if (pet) {
      sendBrowserNotification(
        `${pet.name}`,
        sessionMessage.text,
        `session-${sessionMessage.ts}`
      );
    }
    usedLinesRef.current.push(sessionMessage.text);
  }, [sessionMessage, pet, queueBubble]);

  // ---------- Click vs Drag ----------
  const onDragStart = (_e, info) => {
    dragStartRef.current = { x: info.point.x, y: info.point.y, t: Date.now() };
    stroll.pause();
    setPetState("idle");
  };

  const onDragEnd = (_e, info) => {
    const start = dragStartRef.current;
    const dx = info.point.x - (start?.x ?? info.point.x);
    const dy = info.point.y - (start?.y ?? info.point.y);
    const dt = Date.now() - (start?.t ?? Date.now());
    const isClick = Math.abs(dx) < 5 && Math.abs(dy) < 5 && dt < 250;
    if (isClick) {
      handlePetClick();
      return;
    }
    // resume walking from wherever the cat was dropped
    setPetState("walk");
    if (!panelOpenRef.current) stroll.resume();
  };

  const handlePetClick = async () => {
    if (!pet) return;
    ui.pet();
    if (panelOpenRef.current) {
      // close — resume walking
      setPanelOpen(false);
      stroll.resume();
      return;
    }
    // open — pause + come home for the chat
    stroll.pause();
    setPetState("idle");
    setFacing("right");
    try {
      await animate(x, 0, { duration: 0.35, ease: "easeOut" });
    } catch (e) {
      // animation interrupted is OK
    }
    setPanelOpen(true);
  };

  // ---------- CRUD passthroughs ----------
  const addNote = async (text) => {
    try {
      const created = await api.createNote(deviceId, text);
      setNotes((prev) => [created, ...prev]);
      ui.click();
      queueBubble("got it — tucked into the desk drawer.");
    } catch (e) {
      console.warn("addNote failed:", e);
    }
  };
  const addReminder = async (text) => {
    try {
      const localIso = new Date().toISOString();
      const created = await api.createReminder(deviceId, text, localIso);
      setReminders((prev) =>
        [...prev, created].sort((a, b) =>
          a.trigger_at.localeCompare(b.trigger_at)
        )
      );
      ui.click();
      queueBubble(`okay! i'll remind you about "${created.content}"`);
    } catch (e) {
      console.warn("addReminder failed:", e);
    }
  };
  const deleteNote = async (id) => {
    await api.deleteNote(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };
  const deleteReminder = async (id) => {
    await api.deleteReminder(id);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };
  const chatWithPet = async (message, history) => {
    const res = await api.chat(deviceId, message, history);
    return res.reply;
  };

  // ---------- Render ----------
  return (
    <>
      <NameModal open={showName} onSubmit={handleName} />

      {pet && (
        <>
          {/* The strolling cat */}
          <motion.div
            data-testid="pet-anchor"
            className="fixed z-[100] pointer-events-none"
            style={{ top: HOME_TOP, right: HOME_RIGHT, x }}
          >
            <motion.div
              data-testid="pet-character"
              drag
              dragMomentum={false}
              dragElastic={0.2}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onClick={handlePetClick}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              className="pointer-events-auto cursor-grab active:cursor-grabbing relative"
              style={{
                width: SPRITE_SIZE,
                height: SPRITE_SIZE,
                filter: focusRunning
                  ? "drop-shadow(0 0 8px rgba(129, 178, 154, 0.55))"
                  : undefined,
              }}
              aria-label={`Open ${pet.name}'s notes`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePetClick();
                }
              }}
            >
              <CatSprite state={petState} facing={facing} size={SPRITE_SIZE} />
            </motion.div>
          </motion.div>

          {/* Speech bubble — follows the cat's x position */}
          {bubble && (
            <motion.div
              className="fixed z-[101] pointer-events-auto"
              style={{
                top: HOME_TOP + SPRITE_SIZE + 8,
                right: HOME_RIGHT,
                x,
              }}
            >
              <SpeechBubble message={bubble.message} onDismiss={dismissBubble} />
            </motion.div>
          )}

          {/* Notes panel — anchored at home (cat is paused at x=0 when this is open) */}
          {panelOpen && (
            <div
              className="fixed z-[102] pointer-events-auto"
              style={{ top: HOME_TOP + SPRITE_SIZE + 8, right: HOME_RIGHT }}
            >
              <NotesPanel
                open={panelOpen}
                petName={pet.name}
                deviceId={deviceId}
                notes={notes}
                reminders={reminders}
                onClose={() => {
                  setPanelOpen(false);
                  stroll.resume();
                }}
                onAddNote={addNote}
                onAddReminder={addReminder}
                onDeleteNote={deleteNote}
                onDeleteReminder={deleteReminder}
                onChat={chatWithPet}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
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
import useBubble from "../hooks/useBubble";
import useDueReminders from "../hooks/useDueReminders";
import useWander from "../hooks/useWander";

const HOME_RIGHT = 24;
const HOME_TOP = 10;
const SPRITE_SIZE = 84;

const HEARTBEAT_MS = 60 * 1000;
const NUDGE_MIN_MS = 20 * 60 * 1000;
const NUDGE_MAX_MS = 30 * 60 * 1000;

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
  const [facing, setFacing] = useState("right");
  const [petState, setPetState] = useState("idle"); // idle | walk | hop | focused

  const usedLinesRef = useRef([]);
  const dragStartRef = useRef(null);
  const focusRunningRef = useRef(focusRunning);
  const panelOpenRef = useRef(false);
  const bubbleRef = useRef(null);

  const controls = useAnimationControls();

  // ---------- Bubble (hook) ----------
  const triggerHop = useCallback(() => {
    if (focusRunningRef.current) return;
    setPetState("hop");
    setTimeout(
      () => setPetState(focusRunningRef.current ? "focused" : "idle"),
      600
    );
  }, []);

  const { bubble, queueBubble, dismissBubble } = useBubble({ onQueue: triggerHop });

  // keep refs in sync with state for cross-effect reads (wander, nudge)
  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);
  useEffect(() => {
    bubbleRef.current = bubble;
  }, [bubble]);
  useEffect(() => {
    focusRunningRef.current = focusRunning;
    setPetState(focusRunning ? "focused" : "idle");
  }, [focusRunning]);

  // ---------- Load pet on mount ----------
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
        toast.success("notifications enabled — i'll let you know when reminders are due 🐾");
      }
      queueBubble(`hi! i'm ${name}. tap me anytime to jot a note or a reminder.`);
      await refreshLists();
    } catch (e) {
      console.warn("create pet failed:", e);
      toast.error("hmm, couldn't save the name. try again?");
    }
  };

  // ---------- Due-reminder polling (hook) ----------
  useDueReminders({
    pet,
    deviceId,
    queueBubble,
    onFired: (d) => {
      setReminders((prev) => prev.map((r) => (r.id === d.id ? { ...r, fired: true } : r)));
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

  // ---------- Focus session completion bubble (meow already fired in FocusTimer) ----------
  useEffect(() => {
    if (!sessionMessage || !sessionMessage.text) return;
    queueBubble(sessionMessage.text);
    if (pet) {
      sendBrowserNotification(
        `${pet.name} 🐾`,
        sessionMessage.text,
        `session-${sessionMessage.ts}`
      );
    }
    usedLinesRef.current.push(sessionMessage.text);
  }, [sessionMessage, pet, queueBubble]);

  // ---------- Wander (hook) ----------
  useWander({
    pet,
    controls,
    panelOpenRef,
    bubbleRef,
    focusRunningRef,
    setPetState,
    setFacing,
  });

  // ---------- Drag handlers ----------
  const onDragStart = (_e, info) => {
    dragStartRef.current = { x: info.point.x, y: info.point.y, t: Date.now() };
    setPetState("walk");
  };

  const onDragEnd = (_e, info) => {
    setPetState(focusRunningRef.current ? "focused" : "idle");
    const start = dragStartRef.current;
    const dx = info.point.x - (start?.x ?? info.point.x);
    const dy = info.point.y - (start?.y ?? info.point.y);
    const dt = Date.now() - (start?.t ?? Date.now());
    const isClick = Math.abs(dx) < 5 && Math.abs(dy) < 5 && dt < 250;
    if (isClick) {
      handlePetClick();
    } else {
      controls.start({
        x: 0,
        y: 0,
        transition: { type: "spring", stiffness: 120, damping: 14 },
      });
    }
  };

  // ---------- Click ----------
  const handlePetClick = () => {
    if (!pet) return;
    ui.pet();
    setPanelOpen((v) => !v);
    if (!focusRunningRef.current) {
      setPetState("hop");
      setTimeout(
        () => setPetState(focusRunningRef.current ? "focused" : "idle"),
        600
      );
    }
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
        [...prev, created].sort((a, b) => a.trigger_at.localeCompare(b.trigger_at))
      );
      ui.click();
      queueBubble(`okay! i'll remind you about "${created.content}" 🐾`);
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
        <div
          data-testid="pet-anchor"
          className="fixed z-[100] pointer-events-none"
          style={{ top: HOME_TOP, right: HOME_RIGHT }}
        >
          <motion.div
            data-testid="pet-character"
            animate={controls}
            drag
            dragMomentum={false}
            dragElastic={0.25}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={handlePetClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className="pointer-events-auto cursor-grab active:cursor-grabbing relative"
            style={{ width: SPRITE_SIZE, height: SPRITE_SIZE }}
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
        </div>
      )}

      {pet && bubble && (
        <div
          className="fixed z-[101] pointer-events-auto"
          style={{ top: HOME_TOP + SPRITE_SIZE + 8, right: HOME_RIGHT }}
        >
          <SpeechBubble message={bubble.message} onDismiss={dismissBubble} />
        </div>
      )}

      {pet && panelOpen && (
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
            onClose={() => setPanelOpen(false)}
            onAddNote={addNote}
            onAddReminder={addReminder}
            onDeleteNote={deleteNote}
            onDeleteReminder={deleteReminder}
            onChat={chatWithPet}
          />
        </div>
      )}
    </>
  );
}

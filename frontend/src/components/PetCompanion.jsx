import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, useAnimationControls } from "framer-motion";
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
import { toast } from "sonner";

const HOME_RIGHT = 24; // px from right edge
const HOME_TOP = 10; // px from top
const SPRITE_SIZE = 84;

// timings
const DUE_POLL_MS = 30 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const NUDGE_MIN_MS = 20 * 60 * 1000;
const NUDGE_MAX_MS = 30 * 60 * 1000;
const WANDER_MIN_MS = 45 * 1000;
const WANDER_MAX_MS = 90 * 1000;
const BUBBLE_AUTO_MS = 7000;

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
  const [bubble, setBubble] = useState(null); // {message, key}
  const [facing, setFacing] = useState("right");
  const [petState, setPetState] = useState("idle"); // idle | walk | hop | focused
  const usedLinesRef = useRef([]); // avoid repeating nudge lines in session
  const bubbleTimerRef = useRef(null);
  const wanderTimerRef = useRef(null);
  const dragStartRef = useRef(null);
  const focusRunningRef = useRef(focusRunning);

  const controls = useAnimationControls();

  // ---------- Load ----------
  useEffect(() => {
    // register SW for background notifications
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
        console.error(e);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const refreshLists = useCallback(async () => {
    try {
      const [n, r] = await Promise.all([
        api.listNotes(deviceId),
        api.listReminders(deviceId),
      ]);
      setNotes(n || []);
      setReminders(r || []);
    } catch (e) {
      console.error(e);
    }
  }, [deviceId]);

  // ---------- Naming ----------
  const handleName = async (name) => {
    try {
      const created = await api.createPet(deviceId, name);
      setPet(created);
      setShowName(false);
      // request notification perms after first interaction
      const perm = await ensureNotificationPermission();
      if (perm === "granted") {
        toast.success("notifications enabled — i'll let you know when reminders are due 🐾");
      }
      queueBubble(`hi! i'm ${name}. tap me anytime to jot a note or a reminder.`);
      await refreshLists();
    } catch (e) {
      toast.error("hmm, couldn't save the name. try again?");
    }
  };

  // ---------- Bubble ----------
  const queueBubble = useCallback((message) => {
    if (!message) return;
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    setBubble({ message, key: Date.now() + Math.random() });
    if (!focusRunningRef.current) {
      setPetState("hop");
      setTimeout(() => setPetState(focusRunningRef.current ? "focused" : "idle"), 600);
    }
    bubbleTimerRef.current = setTimeout(() => setBubble(null), BUBBLE_AUTO_MS);
  }, []);

  const dismissBubble = () => {
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    setBubble(null);
  };

  // ---------- Polling: due reminders ----------
  useEffect(() => {
    if (!pet) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const due = await api.dueReminders(deviceId);
        if (cancelled || !due || due.length === 0) return;
        // reflect "fired" in state
        setReminders((prev) =>
          prev.map((r) => {
            const hit = due.find((d) => d.id === r.id);
            return hit ? { ...r, fired: true } : r;
          })
        );
        // show messages one-by-one
        for (const d of due) {
          queueBubble(d.message || `Reminder: ${d.content}`);
          ui.reminder();
          sendBrowserNotification(`${pet.name} 🐾`, d.message || d.content, `reminder-${d.id}`);
          usedLinesRef.current.push(d.message);
          // brief stagger so multiple due reminders don't overwrite each other instantly
          await new Promise((r) => setTimeout(r, 1200));
        }
      } catch (e) {
        // silent
      }
    };
    const id = setInterval(poll, DUE_POLL_MS);
    poll();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pet, deviceId, queueBubble]);

  // ---------- Heartbeat ----------
  useEffect(() => {
    if (!pet) return;
    const id = setInterval(() => {
      api.heartbeat(deviceId).catch(() => {});
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [pet, deviceId]);

  // ---------- Nudges ----------
  useEffect(() => {
    if (!pet) return;
    let cancelled = false;
    let timeout;
    const schedule = () => {
      const wait = randBetween(NUDGE_MIN_MS, NUDGE_MAX_MS);
      timeout = setTimeout(async () => {
        if (cancelled) return;
        // skip if panel open or bubble already showing
        if (!panelOpenRef.current && !bubbleRef.current) {
          try {
            const { message } = await api.nudge(deviceId, usedLinesRef.current);
            if (message && !cancelled) {
              queueBubble(message);
              usedLinesRef.current.push(message);
            }
          } catch (_) {}
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

  // refs for the nudge loop to read latest values without re-subscribing
  const panelOpenRef = useRef(false);
  const bubbleRef = useRef(null);
  useEffect(() => {
    panelOpenRef.current = panelOpen;
  }, [panelOpen]);
  useEffect(() => {
    bubbleRef.current = bubble;
  }, [bubble]);

  // ---------- Focus state syncing ----------
  useEffect(() => {
    focusRunningRef.current = focusRunning;
    if (focusRunning) {
      setPetState("focused");
    } else {
      setPetState("idle");
    }
  }, [focusRunning]);

  // When a focus session completes, show the message
  useEffect(() => {
    if (!sessionMessage) return;
    if (sessionMessage.text) {
      queueBubble(sessionMessage.text);
      ui.complete();
      if (pet) {
        sendBrowserNotification(`${pet.name} 🐾`, sessionMessage.text, `session-${Date.now()}`);
      }
      usedLinesRef.current.push(sessionMessage.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionMessage]);

  // ---------- Wander ----------
  useEffect(() => {
    if (!pet) return;
    let cancelled = false;
    const wander = async () => {
      if (cancelled) return;
      // skip if panel open, bubble showing, OR focus session running
      if (panelOpenRef.current || bubbleRef.current || focusRunningRef.current) {
        wanderTimerRef.current = setTimeout(wander, randBetween(WANDER_MIN_MS, WANDER_MAX_MS));
        return;
      }
      const distance = randBetween(120, 320);
      setPetState("walk");
      setFacing("left");
      await controls.start({
        x: -distance,
        transition: { duration: distance / 80, ease: "linear" },
      });
      if (cancelled) return;
      // pause
      await new Promise((r) => setTimeout(r, randBetween(500, 1400)));
      setFacing("right");
      await controls.start({
        x: 0,
        transition: { duration: distance / 80, ease: "linear" },
      });
      setPetState("idle");
      wanderTimerRef.current = setTimeout(wander, randBetween(WANDER_MIN_MS, WANDER_MAX_MS));
    };
    wanderTimerRef.current = setTimeout(wander, randBetween(WANDER_MIN_MS, WANDER_MAX_MS));
    return () => {
      cancelled = true;
      if (wanderTimerRef.current) clearTimeout(wanderTimerRef.current);
    };
  }, [pet, controls]);

  // ---------- Drag handlers ----------
  const onDragStart = (_e, info) => {
    dragStartRef.current = { x: info.point.x, y: info.point.y, t: Date.now() };
    setPetState("walk");
  };

  const onDragEnd = (_e, info) => {
    setPetState("idle");
    const start = dragStartRef.current;
    const dx = info.point.x - (start?.x ?? info.point.x);
    const dy = info.point.y - (start?.y ?? info.point.y);
    const dt = Date.now() - (start?.t ?? Date.now());
    const isClick = Math.abs(dx) < 5 && Math.abs(dy) < 5 && dt < 250;
    if (isClick) {
      handlePetClick();
    } else {
      // ease back home
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
      setTimeout(() => setPetState(focusRunningRef.current ? "focused" : "idle"), 600);
    }
  };

  // ---------- CRUD passthroughs ----------
  const addNote = async (text) => {
    const created = await api.createNote(deviceId, text);
    setNotes((prev) => [created, ...prev]);
    ui.click();
    queueBubble("got it — tucked into the desk drawer.");
  };
  const addReminder = async (text) => {
    const localIso = new Date().toISOString();
    const created = await api.createReminder(deviceId, text, localIso);
    setReminders((prev) =>
      [...prev, created].sort((a, b) => a.trigger_at.localeCompare(b.trigger_at))
    );
    ui.click();
    queueBubble(`okay! i'll remind you about "${created.content}" 🐾`);
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

      {/* Floating pet anchored to top-right */}
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

      {/* Speech bubble — anchored relative to home position */}
      {pet && bubble && (
        <div
          className="fixed z-[101] pointer-events-auto"
          style={{ top: HOME_TOP + SPRITE_SIZE + 8, right: HOME_RIGHT }}
        >
          <SpeechBubble message={bubble.message} onDismiss={dismissBubble} />
        </div>
      )}

      {/* Notes panel */}
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

import { useEffect, useRef } from "react";
import api from "../lib/api";
import { engine } from "../lib/audio";
import { sendBrowserNotification } from "../lib/notifications";

/**
 * Polls `/api/reminders/due` on a fixed interval. For each due reminder:
 *   - queues an in-character bubble,
 *   - plays the unified ~4s cat meow alert,
 *   - fires a system notification,
 *   - calls `onFired(reminder)` so the parent can mark its local list.
 *
 * The hook is a no-op until `pet` exists.
 */
export default function useDueReminders({
  pet,
  deviceId,
  queueBubble,
  onFired,
  intervalMs = 30 * 1000,
}) {
  const onFiredRef = useRef(onFired);
  const queueBubbleRef = useRef(queueBubble);

  useEffect(() => {
    onFiredRef.current = onFired;
  }, [onFired]);
  useEffect(() => {
    queueBubbleRef.current = queueBubble;
  }, [queueBubble]);

  useEffect(() => {
    if (!pet) return undefined;
    let cancelled = false;

    const poll = async () => {
      try {
        const due = await api.dueReminders(deviceId);
        if (cancelled || !due || due.length === 0) return;
        for (const d of due) {
          if (onFiredRef.current) onFiredRef.current(d);
          if (queueBubbleRef.current) {
            queueBubbleRef.current(d.message || `Reminder: ${d.content}`);
          }
          engine.playMeowAlert().catch((e) => console.warn("meow alert failed:", e));
          sendBrowserNotification(
            `${pet.name}`,
            d.message || d.content,
            `reminder-${d.id}`
          );
          await new Promise((r) => setTimeout(r, 1200));
        }
      } catch (e) {
        console.warn("due reminder poll failed:", e);
      }
    };

    const id = setInterval(poll, intervalMs);
    poll();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pet, deviceId, intervalMs]);
}

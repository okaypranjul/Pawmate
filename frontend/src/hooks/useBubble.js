import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Manages the pet's speech bubble: queue a message, auto-dismiss timer, manual dismiss.
 * Optional `onQueue` fires whenever a new bubble appears (used by parent to trigger hop).
 */
export default function useBubble({ autoDismissMs = 7000, onQueue } = {}) {
  const [bubble, setBubble] = useState(null);
  const timerRef = useRef(null);
  const onQueueRef = useRef(onQueue);

  useEffect(() => {
    onQueueRef.current = onQueue;
  }, [onQueue]);

  const queueBubble = useCallback(
    (message) => {
      if (!message) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      setBubble({ message, key: Date.now() + Math.random() });
      if (onQueueRef.current) onQueueRef.current(message);
      timerRef.current = setTimeout(() => setBubble(null), autoDismissMs);
    },
    [autoDismissMs]
  );

  const dismissBubble = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setBubble(null);
  }, []);

  // clear on unmount
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { bubble, queueBubble, dismissBubble };
}

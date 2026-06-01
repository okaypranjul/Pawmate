import { useEffect } from "react";

function randBetween(a, b) {
  return a + Math.random() * (b - a);
}

/**
 * Idle wander loop: every (minMs..maxMs) the pet walks left a random distance,
 * pauses, then walks back. Skipped while the panel is open, a bubble is showing,
 * or a focus session is running.
 *
 * The pause refs (`panelOpenRef`, `bubbleRef`, `focusRunningRef`) are read inside the
 * loop so the latest values are used without re-subscribing on every state change.
 */
export default function useWander({
  pet,
  controls,
  panelOpenRef,
  bubbleRef,
  focusRunningRef,
  setPetState,
  setFacing,
  minMs = 45 * 1000,
  maxMs = 90 * 1000,
}) {
  useEffect(() => {
    if (!pet) return undefined;
    let cancelled = false;
    let timer = null;

    const wander = async () => {
      if (cancelled) return;
      if (panelOpenRef.current || bubbleRef.current || focusRunningRef.current) {
        timer = setTimeout(wander, randBetween(minMs, maxMs));
        return;
      }
      const distance = randBetween(120, 320);
      setPetState("walk");
      setFacing("left");
      try {
        await controls.start({
          x: -distance,
          transition: { duration: distance / 80, ease: "linear" },
        });
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, randBetween(500, 1400)));
        setFacing("right");
        await controls.start({
          x: 0,
          transition: { duration: distance / 80, ease: "linear" },
        });
      } catch (e) {
        console.warn("wander animation failed:", e);
      }
      setPetState("idle");
      timer = setTimeout(wander, randBetween(minMs, maxMs));
    };

    timer = setTimeout(wander, randBetween(minMs, maxMs));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pet, controls, panelOpenRef, bubbleRef, focusRunningRef, setPetState, setFacing, minMs, maxMs]);
}

import { useCallback, useEffect, useRef } from "react";
import { animate } from "framer-motion";

const STEP_PX = 70; // chunk walks into small steps so pauses can take effect quickly
const SPEED_PX_PER_S = 55; // characterful gentle walk speed
const EDGE_PAUSE_MS = 450; // tiny pause when flipping at the edges

/**
 * Continuous left/right walk loop. The cat strolls from the right edge (x=0) to
 * the left edge (x = -(viewport - sprite - margins)), flips, walks back, flips
 * again — forever. Brief pauses for edge-flips, drag, panel-open, and bubble-hops.
 *
 * Returns { pause, resume } so the parent can stop mid-step (e.g. for the
 * "come home" snap when opening the notes panel).
 */
export default function useStroll({
  pet,
  x,
  pausedRef,
  setFacing,
  setPetState,
  spriteSize = 84,
  margin = 28,
}) {
  const animRef = useRef(null);
  const directionRef = useRef(-1); // -1 = walking left, +1 = walking right

  const pause = useCallback(() => {
    pausedRef.current = true;
    if (animRef.current) {
      try {
        animRef.current.stop();
      } catch (e) {
        console.warn("stroll: stop failed", e);
      }
    }
  }, [pausedRef]);

  const resume = useCallback(() => {
    pausedRef.current = false;
  }, [pausedRef]);

  useEffect(() => {
    if (!pet) return undefined;
    let cancelled = false;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const getMinX = () =>
      -Math.max(0, window.innerWidth - spriteSize - margin * 2);

    const loop = async () => {
      while (!cancelled) {
        if (pausedRef.current) {
          await sleep(120);
          continue;
        }

        const minX = getMinX();
        const currentX = x.get();
        const dir = directionRef.current;

        // At the left edge — flip and walk right
        if (dir < 0 && currentX <= minX + 1) {
          directionRef.current = 1;
          setFacing("right");
          await sleep(EDGE_PAUSE_MS);
          continue;
        }
        // At the right edge (home) — flip and walk left
        if (dir > 0 && currentX >= -1) {
          directionRef.current = -1;
          setFacing("left");
          await sleep(EDGE_PAUSE_MS);
          continue;
        }

        const stepTarget =
          dir < 0
            ? Math.max(currentX - STEP_PX, minX)
            : Math.min(currentX + STEP_PX, 0);

        setFacing(dir < 0 ? "left" : "right");
        setPetState("walk");

        const dist = Math.abs(stepTarget - currentX);
        const duration = dist / SPEED_PX_PER_S;

        try {
          animRef.current = animate(x, stepTarget, {
            duration,
            ease: "linear",
          });
          await animRef.current;
        } catch (e) {
          // animation was interrupted (drag/pause) — fine, loop will check pausedRef
        }
      }
    };

    loop();

    return () => {
      cancelled = true;
      if (animRef.current) {
        try {
          animRef.current.stop();
        } catch (e) {
          // ignore teardown errors
        }
      }
    };
  }, [pet, x, pausedRef, setFacing, setPetState, spriteSize, margin]);

  return { pause, resume };
}

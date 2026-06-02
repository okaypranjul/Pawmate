import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Timer, Coffee, Sparkles } from "lucide-react";
import api from "../lib/api";
import { getDeviceId } from "../lib/device";
import ui from "../lib/uiSounds";
import { engine } from "../lib/audio";

const SESSIONS = {
  deep: { label: "deep work", minutes: 25, icon: Timer, accent: "#2D2D2D" },
  flow: { label: "flow state", minutes: 50, icon: Sparkles, accent: "#3D3D3D" },
  break: { label: "break", minutes: 5, icon: Coffee, accent: "#5C5C5C" },
};

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function FocusTimer({ onRunningChange, onSessionComplete }) {
  const deviceId = useRef(getDeviceId()).current;
  const [sessionKey, setSessionKey] = useState("deep");
  const [remaining, setRemaining] = useState(SESSIONS.deep.minutes * 60);
  const [running, setRunning] = useState(false);
  const [today, setToday] = useState(0);
  const intervalRef = useRef(null);
  const onRunningChangeRef = useRef(onRunningChange);
  const onCompleteRef = useRef(onSessionComplete);

  useEffect(() => {
    onRunningChangeRef.current = onRunningChange;
  }, [onRunningChange]);
  useEffect(() => {
    onCompleteRef.current = onSessionComplete;
  }, [onSessionComplete]);

  useEffect(() => {
    api
      .getPrefs(deviceId)
      .then((p) => setToday(p.today_sessions || 0))
      .catch((e) => console.warn("focus: load prefs failed", e));
  }, [deviceId]);

  useEffect(() => {
    if (onRunningChangeRef.current) onRunningChangeRef.current(running);
  }, [running]);

  const pickSession = (key) => {
    if (running) return;
    ui.click();
    setSessionKey(key);
    setRemaining(SESSIONS[key].minutes * 60);
  };

  const start = () => {
    if (running) return;
    ui.click();
    setRunning(true);
    if (remaining <= 0) setRemaining(SESSIONS[sessionKey].minutes * 60);
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          handleComplete();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  const pause = () => {
    if (!running) return;
    ui.click();
    setRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const reset = () => {
    ui.click();
    setRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setRemaining(SESSIONS[sessionKey].minutes * 60);
  };

  const handleComplete = async () => {
    setRunning(false);
    engine.playMeowAlert().catch((e) => console.warn("meow alert failed:", e));
    try {
      const res = await api.recordSession(
        deviceId,
        sessionKey,
        SESSIONS[sessionKey].minutes
      );
      if (typeof res.today_sessions === "number") setToday(res.today_sessions);
      if (onCompleteRef.current) {
        onCompleteRef.current(res.message || null, sessionKey);
      }
    } catch (e) {
      console.warn("recordSession failed:", e);
      if (onCompleteRef.current) onCompleteRef.current(null, sessionKey);
    }
    const next = sessionKey === "break" ? "deep" : "break";
    setSessionKey(next);
    setRemaining(SESSIONS[next].minutes * 60);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const meta = SESSIONS[sessionKey];
  const total = meta.minutes * 60;
  const pct = ((total - remaining) / total) * 100;

  return (
    <section
      data-testid="focus-panel"
      className="bg-[#E5E2D7] border-2 border-[#0F0F0F] rounded-2xl shadow-cozy-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#3D3D3D] border-b-2 border-[#0F0F0F]">
        <div className="w-10 h-10 grid place-items-center bg-[#E5E2D7] border-2 border-[#0F0F0F] rounded-lg shadow-cozy-sm shrink-0">
          <Timer size={16} className="text-[#0F0F0F]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-pixel text-xl text-[#E5E2D7] leading-none">focus</div>
          <div className="text-[11px] text-[#E5E2D7]/90 mt-1">
            {running ? (
              <span data-testid="focus-status">
                running · <span className="font-pixel text-xs">{fmt(remaining)}</span>
              </span>
            ) : (
              <>
                <span data-testid="today-sessions" className="font-pixel text-xs">
                  {today}
                </span>{" "}
                {today === 1 ? "session" : "sessions"} today
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* session type picker */}
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {Object.entries(SESSIONS).map(([key, s]) => {
            const Icon = s.icon;
            const active = key === sessionKey;
            return (
              <button
                key={key}
                data-testid={`session-${key}`}
                onClick={() => pickSession(key)}
                disabled={running}
                className={`border-2 border-[#0F0F0F] rounded-lg p-1.5 text-[11px] font-bold transition-transform disabled:opacity-60 disabled:cursor-not-allowed ${
                  active ? "shadow-cozy-sm" : "bg-[#E5E2D7]"
                }`}
                style={{
                  background: active ? s.accent : undefined,
                  color: active ? "#E5E2D7" : "#0F0F0F",
                }}
              >
                <Icon size={12} className="mx-auto mb-0.5" />
                <div className="leading-tight">{s.label}</div>
                <div className="font-pixel text-[11px] mt-0.5">{s.minutes}m</div>
              </button>
            );
          })}
        </div>

        {/* countdown */}
        <div
          data-testid="timer-display"
          className="relative bg-[#D2CDBC] border-2 border-[#0F0F0F] rounded-xl px-4 py-4 text-center shadow-cozy-sm"
        >
          <div className="font-pixel text-[56px] sm:text-[64px] leading-none text-[#0F0F0F]">
            {fmt(remaining)}
          </div>
          <div className="font-pixel text-xs text-[#6E6E6E] mt-1 uppercase tracking-wider">
            {meta.label}
          </div>
          <div className="mt-3 h-2.5 bg-[#E5E2D7] border-2 border-[#0F0F0F] rounded-full overflow-hidden">
            <div
              className="h-full transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%`, background: meta.accent }}
            />
          </div>
        </div>

        {/* controls */}
        <div className="flex items-center gap-2 mt-4">
          {running ? (
            <button
              data-testid="pause-btn"
              onClick={pause}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-[#5C5C5C] text-[#0F0F0F] font-bold border-2 border-[#0F0F0F] rounded-lg shadow-cozy-sm py-2.5 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform"
            >
              <Pause size={14} /> pause
            </button>
          ) : (
            <button
              data-testid="start-btn"
              onClick={start}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-[#2D2D2D] text-[#E5E2D7] font-bold border-2 border-[#0F0F0F] rounded-lg shadow-cozy-sm py-2.5 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform"
            >
              <Play size={14} /> start
            </button>
          )}
          <button
            data-testid="reset-btn"
            onClick={reset}
            aria-label="reset"
            className="w-11 h-11 grid place-items-center bg-[#E5E2D7] border-2 border-[#0F0F0F] rounded-lg shadow-cozy-sm active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform"
          >
            <RotateCcw size={14} className="text-[#0F0F0F]" />
          </button>
        </div>
      </div>
    </section>
  );
}

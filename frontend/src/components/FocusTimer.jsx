import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Timer, Coffee, Sparkles } from "lucide-react";
import api from "../lib/api";
import { getDeviceId } from "../lib/device";
import ui from "../lib/uiSounds";

const SESSIONS = {
  deep: { label: "deep work", minutes: 25, icon: Timer, accent: "#E07A5F" },
  flow: { label: "flow state", minutes: 50, icon: Sparkles, accent: "#81B29A" },
  break: { label: "break", minutes: 5, icon: Coffee, accent: "#F2CC8F" },
};

function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function FocusTimer({ onRunningChange, onSessionComplete }) {
  const deviceId = useRef(getDeviceId()).current;
  const [open, setOpen] = useState(false);
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

  // Load today count
  useEffect(() => {
    api
      .getPrefs(deviceId)
      .then((p) => setToday(p.today_sessions || 0))
      .catch(() => {});
  }, [deviceId]);

  // notify parent when running changes
  useEffect(() => {
    onRunningChangeRef.current && onRunningChangeRef.current(running);
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
    ui.chime();
    try {
      const res = await api.recordSession(deviceId, sessionKey, SESSIONS[sessionKey].minutes);
      if (typeof res.today_sessions === "number") setToday(res.today_sessions);
      if (res.message && onCompleteRef.current) {
        onCompleteRef.current(res.message, sessionKey);
      } else if (onCompleteRef.current) {
        onCompleteRef.current(null, sessionKey);
      }
    } catch (_) {
      if (onCompleteRef.current) onCompleteRef.current(null, sessionKey);
    }
    // auto-suggest next session
    const next = sessionKey === "break" ? "deep" : "break";
    setSessionKey(next);
    setRemaining(SESSIONS[next].minutes * 60);
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const meta = SESSIONS[sessionKey];
  const total = meta.minutes * 60;
  const pct = ((total - remaining) / total) * 100;

  return (
    <>
      <button
        data-testid="focus-toggle"
        onClick={() => {
          setOpen((v) => !v);
          ui.open();
        }}
        aria-label={open ? "close focus timer" : "open focus timer"}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-[90] bg-[#81B29A] border-2 border-l-0 border-[#4A3B32] rounded-r-lg shadow-cozy-sm px-2 py-3 hover:translate-x-[2px] transition-transform"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        <span className="font-pixel text-base text-[#FDFBF7] flex items-center gap-1">
          <Timer size={14} />
          focus
        </span>
      </button>

      <aside
        data-testid="focus-panel"
        className={`fixed left-0 top-0 bottom-0 z-[91] w-[300px] sm:w-[320px] bg-[#FDFBF7] border-r-4 border-[#4A3B32] shadow-[8px_0_0_#4A3B32] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } flex flex-col`}
      >
        <div className="bg-[#81B29A] border-b-2 border-[#4A3B32] px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="font-pixel text-2xl text-[#FDFBF7] leading-none">focus timer</h3>
            <p className="text-xs text-[#FDFBF7]/90 mt-1">
              <span data-testid="today-sessions" className="font-pixel text-sm">
                {today}
              </span>{" "}
              focus session{today === 1 ? "" : "s"} today
            </p>
          </div>
          <button
            data-testid="close-focus"
            onClick={() => setOpen(false)}
            aria-label="close"
            className="w-9 h-9 grid place-items-center bg-[#FDFBF7] border-2 border-[#4A3B32] rounded-lg shadow-cozy-sm active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform rotate-180"
          >
            <Timer size={16} className="text-[#4A3B32] -rotate-180" />
          </button>
        </div>

        <div className="px-4 py-5 flex-1 overflow-y-auto cozy-scroll">
          {/* session type picker */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {Object.entries(SESSIONS).map(([key, s]) => {
              const Icon = s.icon;
              const active = key === sessionKey;
              return (
                <button
                  key={key}
                  data-testid={`session-${key}`}
                  onClick={() => pickSession(key)}
                  disabled={running}
                  className={`border-2 border-[#4A3B32] rounded-lg p-2 text-xs font-bold transition-transform disabled:opacity-60 disabled:cursor-not-allowed ${
                    active ? "shadow-cozy-sm" : "bg-[#FDFBF7]"
                  }`}
                  style={{ background: active ? s.accent : undefined, color: active ? "#FDFBF7" : "#4A3B32" }}
                >
                  <Icon size={14} className="mx-auto mb-1" />
                  <div>{s.label}</div>
                  <div className="font-pixel text-sm mt-0.5">{s.minutes}m</div>
                </button>
              );
            })}
          </div>

          {/* big countdown */}
          <div
            data-testid="timer-display"
            className="relative bg-[#F4F1DE] border-2 border-[#4A3B32] rounded-xl p-6 text-center shadow-cozy-sm"
          >
            <div className="font-pixel text-[68px] sm:text-[80px] leading-none text-[#4A3B32]">
              {fmt(remaining)}
            </div>
            <div className="font-pixel text-base text-[#8A7968] mt-1 uppercase tracking-wider">
              {meta.label}
            </div>
            <div className="mt-4 h-3 bg-[#FDFBF7] border-2 border-[#4A3B32] rounded-full overflow-hidden">
              <div
                className="h-full transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%`, background: meta.accent }}
              />
            </div>
          </div>

          {/* controls */}
          <div className="flex items-center gap-2 mt-5">
            {running ? (
              <button
                data-testid="pause-btn"
                onClick={pause}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#F2CC8F] text-[#4A3B32] font-bold border-2 border-[#4A3B32] rounded-lg shadow-cozy-sm py-3 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform"
              >
                <Pause size={16} /> pause
              </button>
            ) : (
              <button
                data-testid="start-btn"
                onClick={start}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#E07A5F] text-[#FDFBF7] font-bold border-2 border-[#4A3B32] rounded-lg shadow-cozy-sm py-3 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform"
              >
                <Play size={16} /> start
              </button>
            )}
            <button
              data-testid="reset-btn"
              onClick={reset}
              aria-label="reset"
              className="w-12 h-12 grid place-items-center bg-[#FDFBF7] border-2 border-[#4A3B32] rounded-lg shadow-cozy-sm active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform"
            >
              <RotateCcw size={16} className="text-[#4A3B32]" />
            </button>
          </div>

          <p className="font-pixel text-xs text-[#8A7968] mt-5 text-center tracking-wider leading-relaxed">
            next up: <span className="text-[#4A3B32]">{sessionKey === "break" ? "deep work" : "break"}</span> · auto-cycles work → break
          </p>
        </div>
      </aside>
    </>
  );
}

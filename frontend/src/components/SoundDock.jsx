import React, { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, ChevronRight, Music } from "lucide-react";
import { engine, TRACK_KEYS, TRACK_META } from "../lib/audio";
import api from "../lib/api";
import { getDeviceId } from "../lib/device";
import ui from "../lib/uiSounds";

const TRACK_ICONS = {
  rain: "🌧",
  ocean: "🌊",
  forest: "🌲",
  cafe: "☕",
  lofi: "🎧",
  white: "✦",
};

export default function SoundDock() {
  const deviceId = useRef(getDeviceId()).current;
  const [open, setOpen] = useState(false);
  const [master, setMaster] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [tracks, setTracks] = useState(
    Object.fromEntries(TRACK_KEYS.map((k) => [k, { enabled: false, volume: 0.5 }]))
  );
  const saveTimer = useRef(null);
  const ready = useRef(false);

  // Load prefs from backend on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const prefs = await api.getPrefs(deviceId);
        if (!mounted) return;
        setMaster(prefs.master_volume ?? 0.7);
        setMuted(!!prefs.muted);
        const next = Object.fromEntries(TRACK_KEYS.map((k) => [k, { enabled: false, volume: 0.5 }]));
        for (const s of prefs.sounds || []) {
          if (next[s.key]) next[s.key] = { enabled: !!s.enabled, volume: s.volume ?? 0.5 };
        }
        setTracks(next);
        engine.setMaster(prefs.master_volume ?? 0.7);
        engine.setMuted(!!prefs.muted);
        ready.current = true;
      } catch (_) {
        ready.current = true;
      }
    })();
    return () => {
      mounted = false;
    };
  }, [deviceId]);

  // Persist prefs (debounced) whenever they change after initial load
  useEffect(() => {
    if (!ready.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const sounds = TRACK_KEYS.map((k) => ({
        key: k,
        enabled: tracks[k].enabled,
        volume: tracks[k].volume,
      }));
      api.saveSoundPrefs(deviceId, master, muted, sounds).catch(() => {});
    }, 600);
  }, [master, muted, tracks, deviceId]);

  const toggleTrack = async (key) => {
    ui.click();
    const t = tracks[key];
    const next = { ...t, enabled: !t.enabled };
    setTracks((prev) => ({ ...prev, [key]: next }));
    if (next.enabled) {
      await engine.enable(key, next.volume);
    } else {
      engine.disable(key);
    }
  };

  const setTrackVolume = (key, vol) => {
    setTracks((prev) => ({ ...prev, [key]: { ...prev[key], volume: vol } }));
    if (tracks[key].enabled) engine.setVolume(key, vol);
  };

  const setMasterVol = (vol) => {
    setMaster(vol);
    engine.setMaster(vol);
  };

  const toggleMute = () => {
    ui.click();
    const next = !muted;
    setMuted(next);
    engine.setMuted(next);
  };

  return (
    <>
      {/* Tab handle on the right edge */}
      <button
        data-testid="sound-dock-toggle"
        onClick={() => {
          setOpen((v) => !v);
          ui.open();
        }}
        aria-label={open ? "close sound dock" : "open sound dock"}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-[90] bg-[#F2CC8F] border-2 border-r-0 border-[#4A3B32] rounded-l-lg shadow-cozy-sm px-2 py-3 hover:translate-x-[-2px] transition-transform"
        style={{ writingMode: "vertical-rl" }}
      >
        <span className="font-pixel text-base text-[#4A3B32] flex items-center gap-1">
          <Music size={14} className="rotate-90" />
          sounds
        </span>
      </button>

      {/* Side panel */}
      <aside
        data-testid="sound-dock"
        className={`fixed right-0 top-0 bottom-0 z-[91] w-[300px] sm:w-[320px] bg-[#FDFBF7] border-l-4 border-[#4A3B32] shadow-[-8px_0_0_#4A3B32] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        } flex flex-col`}
      >
        <div className="bg-[#F2CC8F] border-b-2 border-[#4A3B32] px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="font-pixel text-2xl text-[#4A3B32] leading-none">ambient dock</h3>
            <p className="text-xs text-[#4A3B32]/70 mt-1">layer your focus soundscape</p>
          </div>
          <button
            data-testid="close-sound-dock"
            onClick={() => setOpen(false)}
            aria-label="close"
            className="w-9 h-9 grid place-items-center bg-[#FDFBF7] border-2 border-[#4A3B32] rounded-lg shadow-cozy-sm active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform"
          >
            <ChevronRight size={16} className="text-[#4A3B32]" />
          </button>
        </div>

        {/* Master row */}
        <div className="px-4 py-4 border-b-2 border-dashed border-[#4A3B32]/30 bg-[#F4F1DE]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-pixel text-lg text-[#4A3B32]">master</span>
            <button
              data-testid="mute-toggle"
              onClick={toggleMute}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-2 border-[#4A3B32] text-xs font-bold shadow-cozy-sm active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform ${
                muted ? "bg-[#E07A5F] text-[#FDFBF7]" : "bg-[#FDFBF7] text-[#4A3B32]"
              }`}
            >
              {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
              {muted ? "muted" : "live"}
            </button>
          </div>
          <input
            data-testid="master-volume"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={master}
            onChange={(e) => setMasterVol(parseFloat(e.target.value))}
            className="w-full accent-[#E07A5F]"
          />
        </div>

        {/* Tracks */}
        <div className="flex-1 overflow-y-auto cozy-scroll px-3 py-3 space-y-2">
          {TRACK_KEYS.map((key) => {
            const t = tracks[key];
            const meta = TRACK_META[key];
            return (
              <div
                key={key}
                data-testid={`track-${key}`}
                className={`bg-white border-2 border-[#4A3B32] rounded-lg p-3 transition-colors ${
                  t.enabled ? "shadow-cozy-sm" : "opacity-90"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl" aria-hidden>
                      {TRACK_ICONS[key]}
                    </span>
                    <span className="font-pixel text-lg text-[#4A3B32] truncate">{meta.label}</span>
                  </div>
                  <button
                    data-testid={`toggle-${key}`}
                    onClick={() => toggleTrack(key)}
                    aria-pressed={t.enabled}
                    className={`shrink-0 w-12 h-7 rounded-full border-2 border-[#4A3B32] relative transition-colors ${
                      t.enabled ? "bg-[#81B29A]" : "bg-[#F4F1DE]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-[#FDFBF7] border-2 border-[#4A3B32] rounded-full transition-all ${
                        t.enabled ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
                <input
                  data-testid={`volume-${key}`}
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={t.volume}
                  onChange={(e) => setTrackVolume(key, parseFloat(e.target.value))}
                  disabled={!t.enabled}
                  className="w-full mt-2 accent-[#E07A5F] disabled:opacity-40"
                />
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t-2 border-dashed border-[#4A3B32]/30 bg-[#F4F1DE]">
          <p className="font-pixel text-xs text-[#8A7968] text-center tracking-wider">
            all sounds generated locally · no copyrighted audio
          </p>
        </div>
      </aside>
    </>
  );
}

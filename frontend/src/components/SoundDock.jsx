import React, { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Music } from "lucide-react";
import { engine, TRACK_KEYS, TRACK_META } from "../lib/audio";
import api from "../lib/api";
import { getDeviceId } from "../lib/device";
import ui from "../lib/uiSounds";
import PixelIcon from "./PixelIcon";

const TRACK_ICONS = {
  rain: "rain",
  ocean: "ocean",
  forest: "forest",
  white: "white",
};

export default function SoundDock() {
  const deviceId = useRef(getDeviceId()).current;
  const [master, setMaster] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [tracks, setTracks] = useState(
    Object.fromEntries(TRACK_KEYS.map((k) => [k, { enabled: false, volume: 0.5 }]))
  );
  const saveTimer = useRef(null);
  const ready = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const prefs = await api.getPrefs(deviceId);
        if (!mounted) return;
        setMaster(prefs.master_volume ?? 0.7);
        setMuted(!!prefs.muted);
        const next = Object.fromEntries(
          TRACK_KEYS.map((k) => [k, { enabled: false, volume: 0.5 }])
        );
        for (const s of prefs.sounds || []) {
          if (next[s.key]) next[s.key] = { enabled: !!s.enabled, volume: s.volume ?? 0.5 };
        }
        setTracks(next);
        engine.setMaster(prefs.master_volume ?? 0.7);
        engine.setMuted(!!prefs.muted);
        ready.current = true;
      } catch (e) {
        console.warn("sound dock: load prefs failed", e);
        ready.current = true;
      }
    })();
    return () => {
      mounted = false;
    };
  }, [deviceId]);

  useEffect(() => {
    if (!ready.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const sounds = TRACK_KEYS.map((k) => ({
        key: k,
        enabled: tracks[k].enabled,
        volume: tracks[k].volume,
      }));
      api
        .saveSoundPrefs(deviceId, master, muted, sounds)
        .catch((e) => console.warn("save sound prefs failed", e));
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

  const activeCount = TRACK_KEYS.filter((k) => tracks[k].enabled).length;

  return (
    <section
      data-testid="sound-dock"
      className="bg-[#E5E2D7] border-2 border-[#0F0F0F] rounded-2xl shadow-cozy-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#2D2D2D] border-b-2 border-[#0F0F0F]">
        <div className="w-10 h-10 grid place-items-center bg-[#E5E2D7] border-2 border-[#0F0F0F] rounded-lg shadow-cozy-sm shrink-0">
          <Music size={16} className="text-[#0F0F0F]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-pixel text-xl text-[#E5E2D7] leading-none">sounds</div>
          <div className="text-[11px] text-[#E5E2D7]/90 mt-1">
            {muted ? (
              <span className="inline-flex items-center gap-1">
                <VolumeX size={11} /> muted
              </span>
            ) : activeCount === 0 ? (
              <>pick a vibe</>
            ) : (
              <>
                <span className="font-pixel text-xs">{activeCount}</span>{" "}
                {activeCount === 1 ? "layer" : "layers"} playing
              </>
            )}
          </div>
        </div>
      </div>

      {/* Master */}
      <div className="px-4 py-3 border-b-2 border-dashed border-[#0F0F0F]/30 bg-[#D2CDBC]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-pixel text-base text-[#0F0F0F]">master</span>
          <button
            data-testid="mute-toggle"
            onClick={toggleMute}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border-2 border-[#0F0F0F] text-[11px] font-bold shadow-cozy-sm active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform ${
              muted ? "bg-[#2D2D2D] text-[#E5E2D7]" : "bg-[#E5E2D7] text-[#0F0F0F]"
            }`}
          >
            {muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
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
          className="w-full accent-[#2D2D2D]"
        />
      </div>

      {/* Tracks — 2x2 grid */}
      <div className="px-3 py-3 grid grid-cols-2 gap-2">
        {TRACK_KEYS.map((key) => {
          const t = tracks[key];
          const meta = TRACK_META[key];
          return (
            <div
              key={key}
              data-testid={`track-${key}`}
              className={`bg-white border-2 border-[#0F0F0F] rounded-lg p-2 transition-colors ${
                t.enabled ? "shadow-cozy-sm" : "opacity-90"
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <PixelIcon name={TRACK_ICONS[key]} size={14} className="text-[#0F0F0F] shrink-0" />
                  <span className="font-pixel text-sm text-[#0F0F0F] truncate">
                    {meta.label}
                  </span>
                </div>
                <button
                  data-testid={`toggle-${key}`}
                  onClick={() => toggleTrack(key)}
                  aria-pressed={t.enabled}
                  className={`shrink-0 w-10 h-6 rounded-full border-2 border-[#0F0F0F] relative transition-colors ${
                    t.enabled ? "bg-[#3D3D3D]" : "bg-[#D2CDBC]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-[#E5E2D7] border-2 border-[#0F0F0F] rounded-full transition-all ${
                      t.enabled ? "left-[18px]" : "left-0.5"
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
                className="w-full mt-1.5 accent-[#2D2D2D] disabled:opacity-40"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

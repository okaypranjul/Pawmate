import React, { useCallback, useEffect, useState } from "react";
import "@/App.css";
import { Toaster } from "sonner";
import PetCompanion from "./components/PetCompanion";
import FocusTimer from "./components/FocusTimer";
import SoundDock from "./components/SoundDock";
import BackgroundPicker, { BACKGROUNDS } from "./components/BackgroundPicker";

const BG_KEY = "pixelpet_background";
const DEFAULT_BG = "grass";

function loadBg() {
  try {
    const v = localStorage.getItem(BG_KEY);
    if (v && BACKGROUNDS.some((b) => b.key === v)) return v;
  } catch (e) {
    console.warn("bg load failed:", e);
  }
  return DEFAULT_BG;
}

export default function App() {
  const [focusRunning, setFocusRunning] = useState(false);
  const [sessionMessage, setSessionMessage] = useState(null);
  const [bg, setBg] = useState(loadBg);

  const handleSessionComplete = useCallback((message, sessionKey) => {
    setSessionMessage({ text: message, sessionKey, ts: Date.now() });
  }, []);

  const handleBgChange = useCallback((key) => {
    setBg(key);
    try {
      localStorage.setItem(BG_KEY, key);
    } catch (e) {
      console.warn("bg save failed:", e);
    }
  }, []);

  const bgSrc =
    BACKGROUNDS.find((b) => b.key === bg)?.src ||
    `/backgrounds/${DEFAULT_BG}.png`;

  return (
    <div className="App min-h-screen relative bg-[#1F1F1F]">
      {/* Background image layer — keeps its original colour */}
      <div
        aria-hidden
        data-testid="bg-layer"
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `url(${bgSrc})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
        }}
      />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#E5E2D7",
            color: "#0F0F0F",
            border: "2px solid #0F0F0F",
            borderRadius: "12px",
            fontFamily: "Nunito",
            fontWeight: 600,
            boxShadow: "4px 4px 0px #0F0F0F",
          },
        }}
      />

      {/* Soft dark overlay so the monochrome UI stays readable on bright scenes */}
      <div
        aria-hidden
        data-testid="bg-overlay"
        className="fixed inset-0 pointer-events-none z-[5] bg-black/25"
      />

      <main className="relative z-[20] max-w-5xl mx-auto px-5 sm:px-8 min-h-screen flex items-center justify-center py-32">
        <div className="w-full grid gap-5 md:grid-cols-2">
          <FocusTimer
            onRunningChange={setFocusRunning}
            onSessionComplete={handleSessionComplete}
          />
          <SoundDock />
        </div>
      </main>

      {/* Bottom-left background switcher */}
      <BackgroundPicker current={bg} onChange={handleBgChange} />

      {/* The strolling cat overlay */}
      <PetCompanion focusRunning={focusRunning} sessionMessage={sessionMessage} />
    </div>
  );
}

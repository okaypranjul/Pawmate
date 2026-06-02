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
    <div
      className="App min-h-screen relative"
      style={{
        backgroundImage: `url(${bgSrc})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#FDFBF7",
            color: "#4A3B32",
            border: "2px solid #4A3B32",
            borderRadius: "12px",
            fontFamily: "Nunito",
            fontWeight: 600,
            boxShadow: "4px 4px 0px #4A3B32",
          },
        }}
      />

      {/* Subtle dark overlay over the background so the cat (and panels) pop, stronger at the top */}
      <div
        aria-hidden
        data-testid="bg-overlay"
        className="fixed inset-0 pointer-events-none z-[5] bg-gradient-to-b from-black/45 via-black/15 to-black/20"
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

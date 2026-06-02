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

      {/* Top black strip — the floor the cat walks on */}
      <div
        aria-hidden
        data-testid="top-black-strip"
        className="fixed top-0 left-0 right-0 h-[100px] bg-black pointer-events-none z-[50]"
      />

      <main className="relative z-[20] max-w-5xl mx-auto px-5 sm:px-8 pt-32 pb-24">
        <div className="grid gap-5 md:grid-cols-2">
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

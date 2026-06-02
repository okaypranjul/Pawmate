import React, { useCallback, useState } from "react";
import "@/App.css";
import { Toaster } from "sonner";
import PetCompanion from "./components/PetCompanion";
import FocusTimer from "./components/FocusTimer";
import SoundDock from "./components/SoundDock";

export default function App() {
  const [focusRunning, setFocusRunning] = useState(false);
  const [sessionMessage, setSessionMessage] = useState(null);

  const handleSessionComplete = useCallback((message, sessionKey) => {
    setSessionMessage({ text: message, sessionKey, ts: Date.now() });
  }, []);

  return (
    <div
      className="App min-h-screen relative"
      style={{
        backgroundImage: "url(/backgrounds/home.png)",
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

      {/* Top strip — where the cat walks */}
      <div
        aria-hidden
        className="fixed top-0 left-0 right-0 h-[104px] bg-gradient-to-b from-[#F2CC8F]/40 to-transparent pointer-events-none z-[10]"
      />

      <main className="relative z-[20] max-w-5xl mx-auto px-5 sm:px-8 pt-32 pb-16">
        {/* Side-by-side panels — stacks on mobile */}
        <div className="grid gap-5 md:grid-cols-2">
          <FocusTimer
            onRunningChange={setFocusRunning}
            onSessionComplete={handleSessionComplete}
          />
          <SoundDock />
        </div>
      </main>

      {/* The strolling cat overlay */}
      <PetCompanion focusRunning={focusRunning} sessionMessage={sessionMessage} />
    </div>
  );
}

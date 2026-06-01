import React, { useCallback, useState } from "react";
import "@/App.css";
import { Toaster } from "sonner";
import PetCompanion from "./components/PetCompanion";
import FocusTimer from "./components/FocusTimer";
import SoundDock from "./components/SoundDock";
import { Sparkles, MousePointerClick, Timer, Music } from "lucide-react";

export default function App() {
  const [focusRunning, setFocusRunning] = useState(false);
  const [sessionMessage, setSessionMessage] = useState(null);

  const handleSessionComplete = useCallback((message, sessionKey) => {
    setSessionMessage({ text: message, sessionKey, ts: Date.now() });
  }, []);

  return (
    <div className="App min-h-screen cozy-grid">
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

      <main className="relative z-[20] max-w-2xl mx-auto px-5 sm:px-8 pt-32 pb-20">
        {/* Tiny playful header */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <span className="inline-flex items-center gap-2 font-pixel text-sm text-[#4A3B32] bg-[#F2CC8F] border-2 border-[#4A3B32] rounded-full px-3 py-1 shadow-cozy-sm">
            <Sparkles size={14} /> a tiny desk friend
          </span>
          <span className="font-pixel text-xs text-[#8A7968] tracking-wider">
            🐾 always strolling up top
          </span>
        </div>

        {/* Icon mini-guide — three tiny cues, no walls of text */}
        <ul className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
          <li className="bg-[#FDFBF7] border-2 border-[#4A3B32] rounded-xl px-3 py-3 shadow-cozy-sm flex items-center gap-2">
            <MousePointerClick size={16} className="text-[#E07A5F] shrink-0" />
            <span className="font-pixel text-xs sm:text-sm text-[#4A3B32] leading-tight">
              tap cat
            </span>
          </li>
          <li className="bg-[#FDFBF7] border-2 border-[#4A3B32] rounded-xl px-3 py-3 shadow-cozy-sm flex items-center gap-2">
            <Timer size={16} className="text-[#81B29A] shrink-0" />
            <span className="font-pixel text-xs sm:text-sm text-[#4A3B32] leading-tight">
              focus
            </span>
          </li>
          <li className="bg-[#FDFBF7] border-2 border-[#4A3B32] rounded-xl px-3 py-3 shadow-cozy-sm flex items-center gap-2">
            <Music size={16} className="text-[#E07A5F] shrink-0" />
            <span className="font-pixel text-xs sm:text-sm text-[#4A3B32] leading-tight">
              sounds
            </span>
          </li>
        </ul>

        {/* Inline focus + sound panels */}
        <div className="space-y-5">
          <FocusTimer
            onRunningChange={setFocusRunning}
            onSessionComplete={handleSessionComplete}
          />
          <SoundDock />
        </div>

        <footer className="mt-12 text-center font-pixel text-xs text-[#8A7968] tracking-wider">
          made with care 🐾
        </footer>
      </main>

      {/* The strolling cat overlay */}
      <PetCompanion focusRunning={focusRunning} sessionMessage={sessionMessage} />
    </div>
  );
}

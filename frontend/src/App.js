import React from "react";
import "@/App.css";
import { Toaster } from "sonner";
import PetCompanion from "./components/PetCompanion";
import { StickyNote, Bell, Sparkles, MousePointerClick } from "lucide-react";

function FeatureCard({ icon, title, body }) {
  return (
    <div className="bg-[#FDFBF7] border-2 border-[#4A3B32] rounded-xl shadow-cozy p-5">
      <div className="w-10 h-10 grid place-items-center bg-[#F2CC8F] border-2 border-[#4A3B32] rounded-lg shadow-cozy-sm mb-3">
        {icon}
      </div>
      <h3 className="font-pixel text-xl text-[#4A3B32] leading-none mb-2">{title}</h3>
      <p className="text-sm text-[#4A3B32]/80 leading-relaxed">{body}</p>
    </div>
  );
}

export default function App() {
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

      {/* Top strip subtle indicator (visually separates "OS bar" where pet lives) */}
      <div
        aria-hidden
        className="fixed top-0 left-0 right-0 h-[104px] bg-gradient-to-b from-[#F2CC8F]/40 to-transparent pointer-events-none z-[10]"
      />

      <main className="relative z-[20] max-w-5xl mx-auto px-5 sm:px-8 pt-28 pb-24">
        <header className="mb-12">
          <span className="inline-flex items-center gap-2 font-pixel text-base text-[#4A3B32] bg-[#F2CC8F] border-2 border-[#4A3B32] rounded-full px-3 py-1 shadow-cozy-sm">
            <Sparkles size={14} /> a tiny desk friend
          </span>
          <h1 className="font-pixel text-5xl sm:text-6xl lg:text-7xl text-[#4A3B32] mt-5 leading-[0.95]">
            meet your<br />
            <span className="text-[#E07A5F]">pixel pet</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-[#4A3B32]/85 max-w-xl leading-relaxed">
            a cozy little cat lives at the top of your screen. they hold onto your notes,
            nudge you about reminders, and pop by to say hi — never spammy, always sweet.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 text-sm text-[#8A7968]">
            <MousePointerClick size={16} className="text-[#E07A5F]" />
            <span>tap the cat in the top-right to open their desk →</span>
          </div>
        </header>

        <section className="grid sm:grid-cols-3 gap-5">
          <FeatureCard
            icon={<Bell size={18} className="text-[#4A3B32]" />}
            title="natural reminders"
            body={'type "lunch at 1pm" or "review PR in 2 hours" — your pet parses the time and pops a bubble when it\'s due.'}
          />
          <FeatureCard
            icon={<StickyNote size={18} className="text-[#4A3B32]" />}
            title="quick notes"
            body="jot anything down. it stays put across refreshes, on this device, kept tidy in your pet's little desk drawer."
          />
          <FeatureCard
            icon={<Sparkles size={18} className="text-[#4A3B32]" />}
            title="alive, not noisy"
            body="occasional in-character check-ins generated fresh each time — never the same line twice in a session."
          />
        </section>

        <section className="mt-14 bg-[#FDFBF7] border-2 border-[#4A3B32] rounded-2xl shadow-cozy-lg p-6 sm:p-8">
          <h2 className="font-pixel text-3xl text-[#4A3B32] leading-none mb-3">
            how it works
          </h2>
          <ol className="space-y-3 text-[#4A3B32] text-sm sm:text-base">
            <li className="flex gap-3">
              <span className="font-pixel text-2xl text-[#E07A5F] leading-none w-7 shrink-0">
                1
              </span>
              <span>name your pet — they'll remember it across visits.</span>
            </li>
            <li className="flex gap-3">
              <span className="font-pixel text-2xl text-[#E07A5F] leading-none w-7 shrink-0">
                2
              </span>
              <span>
                tap them to open the desk; add notes and natural-language reminders.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-pixel text-2xl text-[#E07A5F] leading-none w-7 shrink-0">
                3
              </span>
              <span>
                they'll hop and pop a speech bubble when something is due — even on
                other tabs (with notifications enabled).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-pixel text-2xl text-[#E07A5F] leading-none w-7 shrink-0">
                4
              </span>
              <span>
                they wander gently across the top now and then — try dragging them
                somewhere new; they'll mosey home.
              </span>
            </li>
          </ol>
        </section>

        <footer className="mt-16 text-center font-pixel text-sm text-[#8A7968] tracking-wider">
          a small companion overlay · made with care 🐾
        </footer>
      </main>

      {/* The floating pet itself */}
      <PetCompanion />
    </div>
  );
}

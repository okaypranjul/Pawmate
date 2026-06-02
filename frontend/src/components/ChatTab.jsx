import React, { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import ui from "../lib/uiSounds";

export default function ChatTab({ petName, deviceId, onSend }) {
  const [history, setHistory] = useState([]); // {role:'user'|'pet', text}
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, busy]);

  const submit = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    ui.click();
    setBusy(true);
    const userMsg = { id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role: "user", text };
    const next = [...history, userMsg];
    setHistory(next);
    setDraft("");
    try {
      const reply = await onSend(text, history);
      const petMsg = {
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "pet",
        text: reply || "purr.",
      };
      setHistory([...next, petMsg]);
    } catch (e) {
      const errMsg = {
        id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "pet",
        text: "hmm, couldn't reach the brain — try again?",
      };
      setHistory([...next, errMsg]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[260px]">
      <div
        ref={scrollRef}
        data-testid="chat-scroll"
        className="flex-1 overflow-y-auto cozy-scroll space-y-2 pr-1"
      >
        {history.length === 0 && (
          <div className="text-center text-sm text-[#6E6E6E] py-6">
            say hi to{" "}
            <span className="font-pixel text-base text-[#0F0F0F]">{petName}</span>
            <br />
            <span className="font-pixel text-xs">try &quot;tell me a joke&quot; or &quot;how are you?&quot;</span>
          </div>
        )}
        {history.map((m) => (
          <div
            key={m.id}
            data-testid={`chat-msg-${m.role}`}
            className={`max-w-[85%] rounded-lg border-2 border-[#0F0F0F] px-3 py-2 text-sm ${
              m.role === "user"
                ? "bg-[#5C5C5C] ml-auto text-[#0F0F0F]"
                : "bg-white text-[#0F0F0F]"
            }`}
          >
            <p className="whitespace-pre-wrap break-words leading-snug">{m.text}</p>
          </div>
        ))}
        {busy && (
          <div className="bg-white border-2 border-[#0F0F0F] rounded-lg px-3 py-2 max-w-[85%] inline-flex items-center gap-2 text-[#0F0F0F]">
            <Loader2 size={14} className="animate-spin" />
            <span className="font-pixel text-sm">{petName} is thinking…</span>
          </div>
        )}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 mt-3">
        <input
          data-testid="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`talk to ${petName}…`}
          maxLength={300}
          className="flex-1 bg-white border-2 border-[#0F0F0F] rounded-lg px-3 py-2 text-sm text-[#0F0F0F] placeholder:text-[#6E6E6E]/70 focus:outline-none focus:ring-2 focus:ring-[#2D2D2D]"
        />
        <button
          data-testid="chat-send-btn"
          type="submit"
          disabled={busy || !draft.trim()}
          className="bg-[#2D2D2D] text-[#E5E2D7] font-bold border-2 border-[#0F0F0F] rounded-lg shadow-cozy-sm px-3 py-2 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform disabled:opacity-60 inline-flex items-center gap-1"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </form>
    </div>
  );
}

import React, { useState } from "react";
import { Bell, StickyNote, Trash2, X, Loader2, Clock, MessageCircle } from "lucide-react";
import ChatTab from "./ChatTab";

function formatTime(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay) return `today · ${time}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow =
      d.getFullYear() === tomorrow.getFullYear() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getDate() === tomorrow.getDate();
    if (isTomorrow) return `tomorrow · ${time}`;
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
  } catch (_) {
    return iso;
  }
}

export default function NotesPanel({
  open,
  petName,
  deviceId,
  notes,
  reminders,
  onClose,
  onAddNote,
  onAddReminder,
  onDeleteNote,
  onDeleteReminder,
  onChat,
}) {
  const [tab, setTab] = useState("reminders");
  const [noteText, setNoteText] = useState("");
  const [reminderText, setReminderText] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const submitNote = async (e) => {
    e.preventDefault();
    const t = noteText.trim();
    if (!t) return;
    setBusy(true);
    try {
      await onAddNote(t);
      setNoteText("");
    } finally {
      setBusy(false);
    }
  };

  const submitReminder = async (e) => {
    e.preventDefault();
    const t = reminderText.trim();
    if (!t) return;
    setBusy(true);
    try {
      await onAddReminder(t);
      setReminderText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="notes-panel"
      className="bg-[#FDFBF7] border-4 border-[#4A3B32] rounded-2xl shadow-cozy-lg overflow-hidden w-[340px] sm:w-[380px] max-h-[78vh] flex flex-col"
    >
      {/* Header */}
      <div className="bg-[#F2CC8F] border-b-2 border-[#4A3B32] px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="font-pixel text-2xl text-[#4A3B32] leading-none">
            {petName}'s desk
          </h3>
          <p className="text-xs text-[#4A3B32]/70 mt-1">notes &amp; little reminders</p>
        </div>
        <button
          data-testid="close-panel-btn"
          onClick={onClose}
          aria-label="close panel"
          className="w-9 h-9 grid place-items-center bg-[#FDFBF7] border-2 border-[#4A3B32] rounded-lg shadow-cozy-sm active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform"
        >
          <X size={16} className="text-[#4A3B32]" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-3 pt-3 flex-wrap">
        <button
          data-testid="tab-reminders"
          onClick={() => setTab("reminders")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-[#4A3B32] text-sm font-bold transition-transform ${
            tab === "reminders"
              ? "bg-[#E07A5F] text-[#FDFBF7] shadow-cozy-sm"
              : "bg-[#FDFBF7] text-[#4A3B32]"
          }`}
        >
          <Bell size={14} />
          reminders
          <span className="font-pixel text-base leading-none ml-1">
            {reminders.filter((r) => !r.fired).length}
          </span>
        </button>
        <button
          data-testid="tab-notes"
          onClick={() => setTab("notes")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-[#4A3B32] text-sm font-bold transition-transform ${
            tab === "notes"
              ? "bg-[#E07A5F] text-[#FDFBF7] shadow-cozy-sm"
              : "bg-[#FDFBF7] text-[#4A3B32]"
          }`}
        >
          <StickyNote size={14} />
          notes
          <span className="font-pixel text-base leading-none ml-1">{notes.length}</span>
        </button>
        <button
          data-testid="tab-chat"
          onClick={() => setTab("chat")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-[#4A3B32] text-sm font-bold transition-transform ${
            tab === "chat"
              ? "bg-[#E07A5F] text-[#FDFBF7] shadow-cozy-sm"
              : "bg-[#FDFBF7] text-[#4A3B32]"
          }`}
        >
          <MessageCircle size={14} />
          chat
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex-1 overflow-y-auto cozy-scroll">
        {tab === "reminders" && (
          <ul data-testid="reminders-list" className="space-y-2">
            {reminders.length === 0 && (
              <li className="text-center text-sm text-[#8A7968] py-6">
                no reminders yet — try{" "}
                <span className="font-pixel text-base text-[#4A3B32]">
                  "standup in 15 min"
                </span>
              </li>
            )}
            {reminders.map((r) => (
              <li
                key={r.id}
                data-testid={`reminder-${r.id}`}
                className={`bg-white border-2 border-[#4A3B32] rounded-lg p-3 ${
                  r.fired ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#4A3B32] break-words">
                      {r.content}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="font-pixel bg-[#F2CC8F] border border-[#4A3B32] rounded text-xs px-1.5 py-0.5 shadow-cozy-sm inline-flex items-center gap-1">
                        <Clock size={10} />
                        {formatTime(r.trigger_at)}
                      </span>
                      {r.fired && (
                        <span className="font-pixel text-[10px] text-[#8A7968] uppercase">
                          done
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    data-testid={`delete-reminder-${r.id}`}
                    onClick={() => onDeleteReminder(r.id)}
                    aria-label="delete reminder"
                    className="w-7 h-7 grid place-items-center bg-[#FDFBF7] border-2 border-[#4A3B32] rounded shadow-cozy-sm active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform shrink-0"
                  >
                    <Trash2 size={12} className="text-[#4A3B32]" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {tab === "notes" && (
          <ul data-testid="notes-list" className="space-y-2">
            {notes.length === 0 && (
              <li className="text-center text-sm text-[#8A7968] py-6">
                no notes yet — jot anything below
              </li>
            )}
            {notes.map((n) => (
              <li
                key={n.id}
                data-testid={`note-${n.id}`}
                className="bg-white border-2 border-[#4A3B32] rounded-lg p-3 flex items-start justify-between gap-2"
              >
                <p className="text-sm text-[#4A3B32] break-words flex-1 whitespace-pre-wrap">
                  {n.text}
                </p>
                <button
                  data-testid={`delete-note-${n.id}`}
                  onClick={() => onDeleteNote(n.id)}
                  aria-label="delete note"
                  className="w-7 h-7 grid place-items-center bg-[#FDFBF7] border-2 border-[#4A3B32] rounded shadow-cozy-sm active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform shrink-0"
                >
                  <Trash2 size={12} className="text-[#4A3B32]" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {tab === "chat" && (
          <ChatTab petName={petName} deviceId={deviceId} onSend={onChat} />
        )}
      </div>

      {/* Footer input */}
      {tab !== "chat" && (
      <div className="bg-[#F4F1DE] border-t-2 border-[#4A3B32] px-3 py-3">
        {tab === "reminders" ? (
          <form onSubmit={submitReminder} className="flex items-center gap-2">
            <input
              data-testid="reminder-input"
              value={reminderText}
              onChange={(e) => setReminderText(e.target.value)}
              placeholder="lunch at 1pm…"
              maxLength={200}
              className="flex-1 bg-white border-2 border-[#4A3B32] rounded-lg px-3 py-2 text-sm text-[#4A3B32] placeholder:text-[#8A7968]/70 focus:outline-none focus:ring-2 focus:ring-[#E07A5F]"
            />
            <button
              data-testid="add-reminder-btn"
              type="submit"
              disabled={busy || !reminderText.trim()}
              className="bg-[#E07A5F] text-[#FDFBF7] font-bold border-2 border-[#4A3B32] rounded-lg shadow-cozy-sm px-3 py-2 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform disabled:opacity-60 inline-flex items-center gap-1"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : "add"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitNote} className="flex items-center gap-2">
            <input
              data-testid="note-input"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="quick thought…"
              maxLength={500}
              className="flex-1 bg-white border-2 border-[#4A3B32] rounded-lg px-3 py-2 text-sm text-[#4A3B32] placeholder:text-[#8A7968]/70 focus:outline-none focus:ring-2 focus:ring-[#E07A5F]"
            />
            <button
              data-testid="add-note-btn"
              type="submit"
              disabled={busy || !noteText.trim()}
              className="bg-[#E07A5F] text-[#FDFBF7] font-bold border-2 border-[#4A3B32] rounded-lg shadow-cozy-sm px-3 py-2 active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-transform disabled:opacity-60 inline-flex items-center gap-1"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : "save"}
            </button>
          </form>
        )}
        <p className="font-pixel text-[10px] text-[#8A7968] mt-2 text-center tracking-wider">
          try &quot;review pr in 2 hours&quot; · &quot;call priya at 5pm&quot;
        </p>
      </div>
      )}
    </div>
  );
}

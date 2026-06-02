import React, { useState } from "react";

export default function NameModal({ open, onSubmit }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="name-modal"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0F0F0F]/40 backdrop-blur-sm p-4"
    >
      <div className="bg-[#E5E2D7] border-4 border-[#0F0F0F] rounded-2xl shadow-cozy-lg p-6 max-w-[380px] w-full">
        <div className="flex items-center gap-3 mb-3">
          <img
            src="/sprites/cat.gif"
            alt="cat"
            className="pixelated w-14 h-14"
          />
          <div>
            <h2 className="font-pixel text-3xl text-[#0F0F0F] leading-none">a new friend</h2>
            <p className="text-sm text-[#6E6E6E] mt-1">they need a name to remember</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-sm font-semibold text-[#0F0F0F]">
            What should we call them?
          </label>
          <input
            data-testid="name-input"
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mochi, Biscuit, Tofu"
            maxLength={30}
            className="w-full bg-white border-2 border-[#0F0F0F] rounded-lg p-3 text-[#0F0F0F] placeholder:text-[#6E6E6E]/70 focus:outline-none focus:ring-2 focus:ring-[#2D2D2D]"
          />
          <button
            data-testid="name-submit-btn"
            type="submit"
            disabled={!name.trim() || submitting}
            className="w-full bg-[#2D2D2D] text-[#E5E2D7] font-bold border-2 border-[#0F0F0F] rounded-lg shadow-cozy py-3 active:translate-y-[3px] active:translate-x-[3px] active:shadow-none transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "saying hi…" : "say hello"}
          </button>
        </form>
      </div>
    </div>
  );
}

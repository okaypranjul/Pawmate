import React from "react";

export default function SpeechBubble({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div
      data-testid="pet-speech-bubble"
      onClick={onDismiss}
      className="bubble-tail relative cursor-pointer bg-[#FDFBF7] border-2 border-[#4A3B32] rounded-2xl rounded-tr-none shadow-cozy px-4 py-3 anim-bubble-pop max-w-[260px]"
      style={{ fontFamily: "Nunito" }}
    >
      <p className="text-[#4A3B32] text-sm leading-snug font-semibold">{message}</p>
      <p className="font-pixel text-[10px] text-[#8A7968] mt-1 tracking-wider">
        tap to dismiss
      </p>
    </div>
  );
}

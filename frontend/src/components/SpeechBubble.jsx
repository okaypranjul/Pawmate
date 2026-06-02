import React from "react";
import { stripEmoji } from "./PixelIcon";

export default function SpeechBubble({ message, onDismiss }) {
  if (!message) return null;
  const clean = stripEmoji(message);
  return (
    <div
      data-testid="pet-speech-bubble"
      onClick={onDismiss}
      className="bubble-tail relative cursor-pointer bg-[#E5E2D7] border-2 border-[#0F0F0F] rounded-2xl rounded-tr-none shadow-cozy px-4 py-3 anim-bubble-pop max-w-[260px]"
      style={{ fontFamily: "Nunito" }}
    >
      <p className="text-[#0F0F0F] text-sm leading-snug font-semibold">{clean}</p>
      <p className="font-pixel text-[10px] text-[#6E6E6E] mt-1 tracking-wider">
        tap to dismiss
      </p>
    </div>
  );
}

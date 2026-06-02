import React from "react";
import ui from "../lib/uiSounds";

const BACKGROUNDS = [
  { key: "sunflowers", label: "sunflowers", src: "/backgrounds/sunflowers.png" },
  { key: "wheat", label: "wheat field", src: "/backgrounds/wheat.png" },
  { key: "train", label: "night station", src: "/backgrounds/train.png" },
  { key: "grass", label: "wildflowers", src: "/backgrounds/grass.png" },
  { key: "pond", label: "duck pond", src: "/backgrounds/pond.png" },
];

export { BACKGROUNDS };

export default function BackgroundPicker({ current, onChange }) {
  return (
    <div
      data-testid="background-picker"
      className="fixed bottom-4 left-4 z-[90] bg-[#E5E2D7]/95 backdrop-blur-sm border-2 border-[#0F0F0F] rounded-2xl shadow-cozy p-2 flex items-center gap-2"
    >
      {BACKGROUNDS.map((bg) => {
        const active = bg.key === current;
        return (
          <button
            key={bg.key}
            data-testid={`bg-${bg.key}`}
            onClick={() => {
              ui.click();
              onChange(bg.key);
            }}
            aria-label={`switch background to ${bg.label}`}
            title={bg.label}
            className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-transform hover:scale-110 active:scale-95 ${
              active
                ? "border-[#2D2D2D] shadow-cozy-sm ring-2 ring-[#2D2D2D]/40"
                : "border-[#0F0F0F]"
            }`}
          >
            <img
              src={bg.src}
              alt={bg.label}
              draggable={false}
              className="w-full h-full object-cover pixelated"
            />
          </button>
        );
      })}
    </div>
  );
}

import React from "react";

/**
 * Tiny monochrome pixel-art SVG icons.
 * - Drawn on a 16×16 grid with `shape-rendering="crispEdges"` so they render as
 *   real pixel art at any size.
 * - All glyphs use `currentColor` so they inherit the surrounding text colour
 *   (handy for active/inactive button states).
 */

const VIEW = "0 0 16 16";

const ICONS = {
  rain: (
    <>
      {/* cloud */}
      <rect x="4" y="3" width="6" height="1" />
      <rect x="3" y="4" width="9" height="1" />
      <rect x="2" y="5" width="11" height="2" />
      <rect x="3" y="7" width="10" height="1" />
      {/* rain drops */}
      <rect x="4" y="9" width="1" height="2" />
      <rect x="7" y="9" width="1" height="2" />
      <rect x="10" y="9" width="1" height="2" />
      <rect x="5" y="12" width="1" height="2" />
      <rect x="8" y="12" width="1" height="2" />
      <rect x="11" y="12" width="1" height="2" />
    </>
  ),
  ocean: (
    <>
      {/* top wave */}
      <rect x="1" y="5" width="3" height="1" />
      <rect x="4" y="4" width="2" height="1" />
      <rect x="6" y="5" width="2" height="1" />
      <rect x="8" y="6" width="2" height="1" />
      <rect x="10" y="5" width="2" height="1" />
      <rect x="12" y="4" width="2" height="1" />
      <rect x="14" y="5" width="1" height="1" />
      {/* bottom wave */}
      <rect x="1" y="10" width="3" height="1" />
      <rect x="4" y="9" width="2" height="1" />
      <rect x="6" y="10" width="2" height="1" />
      <rect x="8" y="11" width="2" height="1" />
      <rect x="10" y="10" width="2" height="1" />
      <rect x="12" y="9" width="2" height="1" />
      <rect x="14" y="10" width="1" height="1" />
    </>
  ),
  forest: (
    <>
      {/* pine */}
      <rect x="7" y="2" width="2" height="1" />
      <rect x="6" y="3" width="4" height="1" />
      <rect x="6" y="4" width="4" height="2" />
      <rect x="5" y="6" width="6" height="2" />
      <rect x="4" y="8" width="8" height="2" />
      <rect x="3" y="10" width="10" height="2" />
      {/* trunk */}
      <rect x="7" y="12" width="2" height="2" />
    </>
  ),
  white: (
    <>
      {/* dithered static pattern */}
      <rect x="2" y="2" width="2" height="2" />
      <rect x="6" y="2" width="2" height="2" />
      <rect x="10" y="2" width="2" height="2" />
      <rect x="4" y="5" width="2" height="2" />
      <rect x="8" y="5" width="2" height="2" />
      <rect x="12" y="5" width="2" height="2" />
      <rect x="2" y="8" width="2" height="2" />
      <rect x="6" y="8" width="2" height="2" />
      <rect x="10" y="8" width="2" height="2" />
      <rect x="4" y="11" width="2" height="2" />
      <rect x="8" y="11" width="2" height="2" />
      <rect x="12" y="11" width="2" height="2" />
    </>
  ),
  paw: (
    <>
      {/* toes */}
      <rect x="2" y="5" width="2" height="2" />
      <rect x="5" y="3" width="2" height="2" />
      <rect x="9" y="3" width="2" height="2" />
      <rect x="12" y="5" width="2" height="2" />
      {/* main pad */}
      <rect x="5" y="9" width="6" height="3" />
      <rect x="4" y="10" width="1" height="2" />
      <rect x="11" y="10" width="1" height="2" />
      <rect x="6" y="12" width="4" height="1" />
    </>
  ),
};

export default function PixelIcon({ name, size = 16, className = "" }) {
  const glyph = ICONS[name];
  if (!glyph) return null;
  return (
    <svg
      data-testid={`pixel-icon-${name}`}
      viewBox={VIEW}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {glyph}
    </svg>
  );
}

// Util: strip emoji glyphs from any string so LLM-flavoured 🐾 etc. don't leak
// into the now-monochrome UI.
export function stripEmoji(text) {
  if (!text) return text;
  // Covers common emoji ranges + variation selectors + ZWJ.
  // Also collapses any double-spaces left behind.
  return text
    .replace(
      /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}]/gu,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

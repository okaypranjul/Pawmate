import React from "react";

const SPRITE_URL = "/sprites/cat.gif";

/**
 * Pixel cat — animated GIF sprite. The GIF itself carries the walk cycle, so we
 * only layer extra CSS animation for the brief "hop" reaction. The sprite is
 * mirrored horizontally when facing="left".
 */
export default function CatSprite({ state = "walk", facing = "right", size = 80 }) {
  const animClass = state === "hop" ? "anim-hop" : "";

  return (
    <div
      data-testid="cat-sprite"
      data-state={state}
      className={`${animClass} pointer-events-none select-none`}
      style={{
        width: size,
        height: size,
        // The GIF's natural orientation is facing LEFT, so we mirror it when walking right.
        transform: facing === "right" ? "scaleX(-1)" : undefined,
        transformOrigin: "center",
      }}
    >
      <img
        src={SPRITE_URL}
        alt="pixel cat"
        draggable={false}
        className="pixelated w-full h-full object-contain"
      />
    </div>
  );
}

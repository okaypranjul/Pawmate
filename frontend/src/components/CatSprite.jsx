import React from "react";

const SPRITE_URL =
  "https://static.prod-images.emergentagent.com/jobs/ec3808b6-b0af-4f34-8a4a-3ff78eddfdf9/images/0ba86426a286100dc963366cfaaae51f1558d9a882931ee2bda749e8e23c0049.png";

/**
 * Pixel cat sprite. Plays one of: idle | walk | hop.
 * Flips horizontally when facing="left".
 */
export default function CatSprite({ state = "idle", facing = "right", size = 80 }) {
  const animClass =
    state === "walk" ? "anim-walk" : state === "hop" ? "anim-hop" : "anim-bob";

  return (
    <div
      data-testid="cat-sprite"
      className={`${animClass} pointer-events-none select-none`}
      style={{
        width: size,
        height: size,
        transform: facing === "left" ? "scaleX(-1)" : undefined,
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

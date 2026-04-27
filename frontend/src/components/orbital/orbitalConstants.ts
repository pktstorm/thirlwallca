// site/frontend/src/components/orbital/orbitalConstants.ts

export const ORBITAL_R0 = 90              // radius of ring 1 (parents/children)
export const ORBITAL_RING_STEP = 90       // base step before decay
export const ORBITAL_RING_DECAY = 0.85    // logarithmic compression: each ring is 85% of the previous step
export const ORBITAL_TILE_SIZE = 64       // diameter of a person tile (px)
export const ORBITAL_TILE_SIZE_DENSE = 24 // diameter when ring is dense
export const ORBITAL_MIN_SLOT_ANGLE_RAD = (5 * Math.PI) / 180  // 5° threshold for density mode
export const ORBITAL_HEMISPHERE_TOP_START = Math.PI            // 180° (left)
export const ORBITAL_HEMISPHERE_TOP_END = 2 * Math.PI          // 360° (right) — sweep clockwise through top
export const ORBITAL_HEMISPHERE_BOTTOM_START = 0
export const ORBITAL_HEMISPHERE_BOTTOM_END = Math.PI
export const ORBITAL_SIBLING_RADIUS = 28   // small ring next to focus
export const ORBITAL_SPOUSE_OFFSET = 12    // radial offset for spouse tile
export const ORBITAL_RECENTER_ANIMATION_MS = 600

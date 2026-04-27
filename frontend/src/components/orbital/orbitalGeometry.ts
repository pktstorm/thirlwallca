import {
  ORBITAL_R0,
  ORBITAL_RING_STEP,
  ORBITAL_RING_DECAY,
} from "./orbitalConstants"

export interface Point {
  x: number
  y: number
}

export function polarToCartesian(r: number, theta: number): Point {
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) }
}

/**
 * Logarithmic ring spacing.
 * generation 0 -> 0
 * generation 1 -> R0
 * generation g -> sum_{i=0..g-1} (RING_STEP * decay^i)  for g >= 1, magnitude symmetric for negative g.
 */
export function ringRadius(generation: number): number {
  const g = Math.abs(generation)
  if (g === 0) return 0
  let r = 0
  for (let i = 0; i < g; i++) {
    r += i === 0 ? ORBITAL_R0 : ORBITAL_RING_STEP * Math.pow(ORBITAL_RING_DECAY, i)
  }
  return r
}

/** Arc on radius `r` from theta1 → theta2 (radians, math convention: 0 = +x, π/2 = +y).
 *  Returns an SVG path beginning with "M". Empty string if angles equal.
 *  Sweep flag is chosen automatically: shortest-arc direction.
 */
export function arcPath(r: number, theta1: number, theta2: number): string {
  if (theta1 === theta2) return ""
  const p1 = polarToCartesian(r, theta1)
  const p2 = polarToCartesian(r, theta2)
  const sweep = theta2 > theta1 ? 1 : 0
  const largeArc = Math.abs(theta2 - theta1) > Math.PI ? 1 : 0
  return `M ${p1.x.toFixed(3)} ${p1.y.toFixed(3)} A ${r} ${r} 0 ${largeArc} ${sweep} ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`
}

/** Connector from parent (rP, θP) to child (rC, θC): radial spoke at θP, then tangential arc at rC. */
export function radialArcPath(rP: number, thetaP: number, rC: number, thetaC: number): string {
  const parent = polarToCartesian(rP, thetaP)
  const spokeEnd = polarToCartesian(rC, thetaP)
  const child = polarToCartesian(rC, thetaC)
  if (thetaC === thetaP) {
    return `M ${parent.x.toFixed(3)} ${parent.y.toFixed(3)} L ${child.x.toFixed(3)} ${child.y.toFixed(3)}`
  }
  const sweep = thetaC > thetaP ? 1 : 0
  const largeArc = Math.abs(thetaC - thetaP) > Math.PI ? 1 : 0
  return [
    `M ${parent.x.toFixed(3)} ${parent.y.toFixed(3)}`,
    `L ${spokeEnd.x.toFixed(3)} ${spokeEnd.y.toFixed(3)}`,
    `A ${rC} ${rC} 0 ${largeArc} ${sweep} ${child.x.toFixed(3)} ${child.y.toFixed(3)}`,
  ].join(" ")
}

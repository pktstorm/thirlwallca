import type { Ring } from "./orbitalTypes"
import { arcPath } from "./orbitalGeometry"
import {
  ORBITAL_HEMISPHERE_TOP_START,
  ORBITAL_HEMISPHERE_TOP_END,
  ORBITAL_HEMISPHERE_BOTTOM_START,
  ORBITAL_HEMISPHERE_BOTTOM_END,
} from "./orbitalConstants"

interface Props {
  rings: Ring[]
}

export function OrbitalRings({ rings }: Props) {
  return (
    <g className="orbital-rings" pointerEvents="none">
      {/* hemisphere divider line */}
      <line
        x1={-9999}
        y1={0}
        x2={9999}
        y2={0}
        stroke="currentColor"
        strokeOpacity={0.08}
        strokeDasharray="2,4"
      />
      {rings.map((r) => {
        const [start, end] =
          r.hemisphere === "top"
            ? [ORBITAL_HEMISPHERE_TOP_START, ORBITAL_HEMISPHERE_TOP_END]
            : [ORBITAL_HEMISPHERE_BOTTOM_START, ORBITAL_HEMISPHERE_BOTTOM_END]
        return (
          <path
            key={`ring-${r.generation}`}
            d={arcPath(r.radius, start, end)}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.18}
            strokeWidth={1}
          />
        )
      })}
    </g>
  )
}

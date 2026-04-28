import { type EdgeProps } from "@xyflow/react"

interface EdgeData {
  isDirectLine?: boolean
  childNodeIds?: string[]
  parentNodeId?: string
  /** Precomputed orthogonal path from edgeRouter (Task 7). */
  path?: string
  [key: string]: unknown
}

const CORNER_RADIUS = 8

/**
 * Parent-child edge. If `data.path` is precomputed (new pipeline), render it directly.
 * Otherwise fall back to the legacy bezier (legacy pipeline).
 */
export function ParentChildEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps) {
  const edgeData = data as EdgeData | undefined
  const isDirectLine = edgeData?.isDirectLine ?? false
  const precomputedPath = edgeData?.path

  let edgePath: string
  if (precomputedPath) {
    edgePath = precomputedPath
  } else {
    // Legacy bezier (preserved bit-for-bit for useLegacyLayout flag).
    const midY = sourceY + (targetY - sourceY) / 2
    const dx = targetX - sourceX
    if (Math.abs(dx) < 1) {
      edgePath = `M ${sourceX} ${sourceY} V ${targetY}`
    } else {
      const r = Math.min(CORNER_RADIUS, Math.abs(dx) / 2, Math.abs(midY - sourceY), Math.abs(targetY - midY))
      const dirX = dx > 0 ? 1 : -1
      edgePath = [
        `M ${sourceX} ${sourceY}`,
        `V ${midY - r}`,
        `Q ${sourceX} ${midY}, ${sourceX + r * dirX} ${midY}`,
        `H ${targetX - r * dirX}`,
        `Q ${targetX} ${midY}, ${targetX} ${midY + r}`,
        `V ${targetY}`,
      ].join(" ")
    }
  }

  const strokeColor = isDirectLine ? "#30e86e" : "#c5d6cb"
  const strokeWidth = isDirectLine ? 2.5 : 1.5

  return (
    <g>
      {isDirectLine && (
        <path
          d={edgePath}
          fill="none"
          stroke="#30e86e"
          strokeWidth={6}
          strokeOpacity={0.15}
          className="animate-pulse-line"
        />
      )}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        className={isDirectLine ? "animate-pulse-line" : ""}
        style={
          isDirectLine
            ? { filter: "drop-shadow(0 0 3px rgba(48, 232, 110, 0.4))" }
            : undefined
        }
      />
    </g>
  )
}

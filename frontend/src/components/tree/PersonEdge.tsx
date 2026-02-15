import { type EdgeProps } from "@xyflow/react"

interface EdgeData {
  isDirectLine?: boolean
  [key: string]: unknown
}

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

  // Orthogonal bracket path: vertical down → horizontal to child → vertical down
  const midY = sourceY + (targetY - sourceY) / 2
  const edgePath = `M ${sourceX} ${sourceY} V ${midY} H ${targetX} V ${targetY}`

  return (
    <g>
      {/* Glow behind active edges */}
      {isDirectLine && (
        <path
          d={edgePath}
          fill="none"
          stroke="#30e86e"
          strokeWidth={8}
          strokeOpacity={0.2}
          className="animate-pulse-line"
          filter="url(#glow)"
        />
      )}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={isDirectLine ? "#30e86e" : "#c5d6cb"}
        strokeWidth={isDirectLine ? 3 : 2}
        className={isDirectLine ? "animate-pulse-line" : ""}
        style={
          isDirectLine
            ? { filter: "drop-shadow(0 0 4px rgba(48, 232, 110, 0.5))" }
            : undefined
        }
      />
      {/* SVG filter for glow */}
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </g>
  )
}

export function SpouseEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: EdgeProps) {
  // Horizontal dashed line between spouse handles
  const edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`

  return (
    <path
      id={id}
      d={edgePath}
      fill="none"
      stroke="#9dbba8"
      strokeWidth={2}
      strokeDasharray="5,5"
    />
  )
}

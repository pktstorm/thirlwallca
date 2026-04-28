import {
  EDGE_OBSTACLE_MARGIN,
  EDGE_CORNER_RADIUS,
  EDGE_Y_SCAN_STEP,
} from "./treeLayoutConstants"

export interface ObstacleBox {
  unitId: string
  /** Top-left corner of the box (in canvas coords). */
  x: number
  y: number
  width: number
  height: number
}

export interface EdgeRouteInput {
  id: string
  sourceUnitId: string
  targetUnitId: string
  /** Bottom-center of the source unit (typical parent-child handle). */
  source: { x: number; y: number }
  /** Top-center of the target unit. */
  target: { x: number; y: number }
}

/**
 * Route a set of edges as orthogonal SVG paths that avoid the given obstacle boxes.
 * Returns a map: edge.id → SVG path string.
 *
 * Algorithm per edge:
 *   1. Self-loop or zero-length → empty string.
 *   2. Same X (within 4px) → straight V line.
 *   3. Try L path with midY = (source.y + target.y) / 2; if horizontal segment is clear, emit.
 *   4. Scan candidate midY values upward and downward from default in EDGE_Y_SCAN_STEP increments.
 *      First clear midY wins.
 *   5. No clear midY → fall back to a quad-bezier matching the existing PersonEdge shape.
 *
 * Source and target unit boxes are excluded from collision checks (their unitId matches the edge's
 * sourceUnitId or targetUnitId).
 */
export function routeEdges(
  edges: EdgeRouteInput[],
  obstacles: ObstacleBox[],
): Map<string, string> {
  const result = new Map<string, string>()
  for (const edge of edges) {
    result.set(edge.id, routeOne(edge, obstacles))
  }
  return result
}

function routeOne(edge: EdgeRouteInput, obstacles: ObstacleBox[]): string {
  if (edge.sourceUnitId === edge.targetUnitId) return ""
  const { source, target } = edge
  if (source.x === target.x && source.y === target.y) return ""

  // Defensive: if source and target are too close vertically to draw a sensible orthogonal path,
  // return empty path so PersonEdge falls back to React Flow's source/target coords + its built-in bezier.
  const verticalSpan = target.y - source.y
  if (Math.abs(verticalSpan) < 16) return ""

  // 1. Straight vertical?
  if (Math.abs(source.x - target.x) < 4) {
    return `M ${source.x} ${source.y} V ${target.y}`
  }

  // 2. Try L path with midY = midpoint, then scan if blocked.
  const midYDefault = (source.y + target.y) / 2
  const filteredObstacles = obstacles.filter(
    (o) => o.unitId !== edge.sourceUnitId && o.unitId !== edge.targetUnitId,
  )
  const tryMidY = (midY: number): string | null => {
    if (!isHorizontalSegmentClear(source.x, target.x, midY, filteredObstacles)) return null
    return buildLPath(source, target, midY)
  }
  const direct = tryMidY(midYDefault)
  if (direct) return direct

  // 3. Scan upward and downward from default.
  const minY = Math.min(source.y, target.y) + EDGE_Y_SCAN_STEP
  const maxY = Math.max(source.y, target.y) - EDGE_Y_SCAN_STEP
  for (
    let offset = EDGE_Y_SCAN_STEP;
    offset < (maxY - minY) / 2 + EDGE_Y_SCAN_STEP;
    offset += EDGE_Y_SCAN_STEP
  ) {
    const tryUp = midYDefault - offset
    if (tryUp >= minY) {
      const p = tryMidY(tryUp)
      if (p) return p
    }
    const tryDown = midYDefault + offset
    if (tryDown <= maxY) {
      const p = tryMidY(tryDown)
      if (p) return p
    }
  }

  // 4. Fallback: quad bezier.
  return buildBezierFallback(source, target)
}

function isHorizontalSegmentClear(
  x1: number,
  x2: number,
  y: number,
  obstacles: ObstacleBox[],
): boolean {
  const left = Math.min(x1, x2)
  const right = Math.max(x1, x2)
  for (const o of obstacles) {
    const ox1 = o.x - EDGE_OBSTACLE_MARGIN
    const oy1 = o.y - EDGE_OBSTACLE_MARGIN
    const ox2 = o.x + o.width + EDGE_OBSTACLE_MARGIN
    const oy2 = o.y + o.height + EDGE_OBSTACLE_MARGIN
    if (y >= oy1 && y <= oy2) {
      // Horizontal segment overlaps the obstacle's Y band; check X overlap.
      if (right >= ox1 && left <= ox2) return false
    }
  }
  return true
}

/**
 * Build an orthogonal L-shaped path from source to target through midY,
 * using SVG arc commands for rounded corners.
 *
 * The path shape:
 *   source → vertical down to (midY - r) → arc corner → horizontal to (target.x - r) → arc corner → vertical to target
 */
function buildLPath(
  source: { x: number; y: number },
  target: { x: number; y: number },
  midY: number,
): string {
  const dx = target.x - source.x
  const dirX = dx > 0 ? 1 : -1
  const r = Math.min(
    EDGE_CORNER_RADIUS,
    Math.abs(dx) / 2,
    Math.abs(midY - source.y),
    Math.abs(target.y - midY),
  )

  // Determine sweep direction for arcs based on the turn direction.
  // First corner: going down then turning to dirX — sweep depends on dirX.
  // dirX > 0: turning right → sweep=1 (clockwise)
  // dirX < 0: turning left → sweep=0 (counter-clockwise)
  const sweep1 = dirX > 0 ? 1 : 0
  // Second corner: going horizontal then turning down — always clockwise opposite to first.
  const sweep2 = dirX > 0 ? 0 : 1

  return [
    `M ${source.x} ${source.y}`,
    `V ${midY - r}`,
    `A ${r} ${r} 0 0 ${sweep1} ${source.x + r * dirX} ${midY}`,
    `H ${target.x - r * dirX}`,
    `A ${r} ${r} 0 0 ${sweep2} ${target.x} ${midY + r}`,
    `V ${target.y}`,
  ].join(" ")
}

function buildBezierFallback(
  source: { x: number; y: number },
  target: { x: number; y: number },
): string {
  // Same shape as the existing PersonEdge.tsx bezier (used as a last resort).
  const midY = (source.y + target.y) / 2
  return [
    `M ${source.x} ${source.y}`,
    `Q ${source.x} ${midY}, ${(source.x + target.x) / 2} ${midY}`,
    `Q ${target.x} ${midY}, ${target.x} ${target.y}`,
  ].join(" ")
}

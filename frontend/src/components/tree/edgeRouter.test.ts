import { describe, it, expect } from "vitest"
import { routeEdges, type EdgeRouteInput, type ObstacleBox } from "./edgeRouter"

function box(id: string, x: number, y: number, w: number, h: number): ObstacleBox {
  return { unitId: id, x, y, width: w, height: h }
}

describe("routeEdges — direct vertical", () => {
  it("emits a straight vertical path when source and target share x", () => {
    const edges: EdgeRouteInput[] = [
      { id: "e1", sourceUnitId: "a", targetUnitId: "b", source: { x: 100, y: 0 }, target: { x: 100, y: 160 } },
    ]
    const obstacles: ObstacleBox[] = []
    const result = routeEdges(edges, obstacles)
    const path = result.get("e1")!
    expect(path).toMatch(/^M 100/)
    expect(path).toContain("V 160")
  })
})

describe("routeEdges — L-shape", () => {
  it("emits an L-shaped path when source and target are offset, no obstacles", () => {
    const edges: EdgeRouteInput[] = [
      { id: "e1", sourceUnitId: "a", targetUnitId: "b", source: { x: 0, y: 0 }, target: { x: 200, y: 160 } },
    ]
    const obstacles: ObstacleBox[] = []
    const result = routeEdges(edges, obstacles)
    const path = result.get("e1")!
    expect(path.startsWith("M 0")).toBe(true)
    expect(path).toContain("A 8 8")  // corner arc
  })
})

describe("routeEdges — obstacle avoidance", () => {
  it("shifts midY when a unit blocks the direct L path", () => {
    // Edge from (0, 0) to (200, 160). Default midY is 80.
    // Place an obstacle covering [50, 70] horizontally at midY=80 — blocks the straight path.
    const edges: EdgeRouteInput[] = [
      { id: "e1", sourceUnitId: "a", targetUnitId: "b", source: { x: 0, y: 0 }, target: { x: 200, y: 160 } },
    ]
    const obstacles: ObstacleBox[] = [box("c", 50, 70, 100, 20)]
    const result = routeEdges(edges, obstacles)
    const path = result.get("e1")!
    // Path should be valid (start with M, contain horizontal segment)
    expect(path).toMatch(/^M /)
    // It should differ from the unblocked default — i.e., midY shifted
    // We verify by checking the path doesn't go through the obstacle's Y band:
    // Pull the V coordinate before the corner arc — the midY value should not be in [70, 90].
    const verticalCoords = path.match(/V ([0-9.]+)/g) ?? []
    for (const v of verticalCoords) {
      const y = parseFloat(v.slice(2))
      expect(y < 70 || y > 90).toBe(true)
    }
  })
})

describe("routeEdges — fallback bezier", () => {
  it("emits a bezier fallback when no clear corridor exists", () => {
    // Place obstacles densely between source and target so no midY is clear.
    const edges: EdgeRouteInput[] = [
      { id: "e1", sourceUnitId: "a", targetUnitId: "b", source: { x: 0, y: 0 }, target: { x: 200, y: 160 } },
    ]
    const obstacles: ObstacleBox[] = []
    // Add obstacles densely covering the entire vertical range between source.y and target.y.
    for (let y = 4; y < 160; y += 4) {
      obstacles.push(box(`obs${y}`, 50, y, 100, 4))
    }
    const result = routeEdges(edges, obstacles)
    const path = result.get("e1")!
    // Bezier fallback uses Q.
    expect(path).toContain("Q")
  })
})

describe("routeEdges — endpoint exclusion", () => {
  it("ignores source and target unit boxes when checking for collisions", () => {
    // The source and target boxes themselves are at the endpoints; if they were treated as obstacles,
    // every edge would collide. Verify routing succeeds with source/target boxes present.
    const edges: EdgeRouteInput[] = [
      { id: "e1", sourceUnitId: "a", targetUnitId: "b", source: { x: 100, y: 0 }, target: { x: 100, y: 160 } },
    ]
    const obstacles: ObstacleBox[] = [
      box("a", 50, -16, 100, 32),    // source's box
      box("b", 50, 144, 100, 32),    // target's box
    ]
    const result = routeEdges(edges, obstacles)
    const path = result.get("e1")!
    // Should still produce a straight vertical path.
    expect(path).toMatch(/^M 100/)
    expect(path).toContain("V 160")
  })
})

describe("routeEdges — self-loop", () => {
  it("returns an empty path string for self-loops", () => {
    const edges: EdgeRouteInput[] = [
      { id: "e1", sourceUnitId: "a", targetUnitId: "a", source: { x: 0, y: 0 }, target: { x: 0, y: 0 } },
    ]
    const result = routeEdges(edges, [])
    expect(result.get("e1")).toBe("")
  })
})

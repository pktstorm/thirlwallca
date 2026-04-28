import type { FamilyUnit } from "./layoutUtils"
import {
  COUPLE_NODE_WIDTH,
  PERSON_WIDTH,
  TIER_HEIGHT,
} from "./layoutUtils"
import {
  COUPLE_NODE_WIDTH_COMPACT,
  PERSON_WIDTH_COMPACT,
  MIN_SIBLING_GAP_NORMAL,
  MIN_SIBLING_GAP_TIGHT,
  MIN_SIBLING_GAP_COMPACT,
  SIBLING_TIER_NORMAL_MAX,
  SIBLING_TIER_TIGHT_MAX,
  LANE_CENTER_HALF_WIDTH,
} from "./treeLayoutConstants"
import type { BranchSide } from "./branchSide"

/**
 * Compute the longest-path rank for every unit such that for any parent-child relationship,
 * child.rank > parent.rank. Roots (units with no parents in the unit graph) get rank 0.
 */
export function computeRanks(
  units: FamilyUnit[],
  personToUnit: Map<string, string>,
): Map<string, number> {
  // Build unit-to-unit parent edges: for each unit u that has a child p, find p's unit (the unit
  // where p is the primaryId), and emit edge (u -> p's unit).
  const childUnits = new Map<string, Set<string>>() // parentUnitId -> set of childUnitIds
  const parentUnits = new Map<string, Set<string>>() // childUnitId -> set of parentUnitIds

  for (const u of units) {
    for (const childPersonId of u.childIds) {
      const childUnitId = personToUnit.get(childPersonId)
      if (!childUnitId || childUnitId === u.id) continue
      if (!childUnits.has(u.id)) childUnits.set(u.id, new Set())
      childUnits.get(u.id)!.add(childUnitId)
      if (!parentUnits.has(childUnitId)) parentUnits.set(childUnitId, new Set())
      parentUnits.get(childUnitId)!.add(u.id)
    }
  }

  // Longest-path rank assignment via Kahn-style topological order.
  const ranks = new Map<string, number>()
  for (const u of units) ranks.set(u.id, 0)

  // Topological order
  const inDegree = new Map<string, number>()
  for (const u of units) inDegree.set(u.id, parentUnits.get(u.id)?.size ?? 0)
  const queue: string[] = []
  for (const u of units) if ((inDegree.get(u.id) ?? 0) === 0) queue.push(u.id)

  while (queue.length) {
    const id = queue.shift()!
    const myRank = ranks.get(id) ?? 0
    const children = childUnits.get(id) ?? new Set()
    for (const c of children) {
      const cRank = ranks.get(c) ?? 0
      if (myRank + 1 > cRank) ranks.set(c, myRank + 1)
      const newDeg = (inDegree.get(c) ?? 0) - 1
      inDegree.set(c, newDeg)
      if (newDeg === 0) queue.push(c)
    }
  }

  return ranks
}

export interface VirtualEdge {
  from: string  // unit id (real or virtual)
  to: string    // unit id (real or virtual)
  /** The original parent-child source unit id (so the renderer can attribute styling). */
  originalParentId: string
  /** The original child unit id. */
  originalChildId: string
}

export interface VirtualExpansion {
  /** Synthetic zero-width units inserted at intermediate ranks. */
  virtualUnits: { id: string }[]
  /** Per-virtual-unit rank lookup. */
  virtualRanks: Map<string, number>
  /** All edges (original single-rank + new segment edges through virtuals). */
  virtualEdges: VirtualEdge[]
}

/**
 * For every parent-child edge that spans more than one rank, insert virtual units at every
 * intermediate rank and replace the edge with a chain of single-rank edges.
 *
 * Single-rank edges pass through unchanged.
 */
export function expandVirtualNodes(
  units: FamilyUnit[],
  personToUnit: Map<string, string>,
  ranks: Map<string, number>,
): VirtualExpansion {
  const virtualUnits: { id: string }[] = []
  const virtualRanks = new Map<string, number>()
  const virtualEdges: VirtualEdge[] = []
  let counter = 0

  for (const u of units) {
    const parentRank = ranks.get(u.id) ?? 0
    for (const childPersonId of u.childIds) {
      const childUnitId = personToUnit.get(childPersonId)
      if (!childUnitId || childUnitId === u.id) continue
      const childRank = ranks.get(childUnitId) ?? 0
      const span = childRank - parentRank
      if (span <= 1) {
        virtualEdges.push({
          from: u.id,
          to: childUnitId,
          originalParentId: u.id,
          originalChildId: childUnitId,
        })
      } else {
        // Insert (span - 1) virtual units, chain them.
        let prevId = u.id
        for (let r = parentRank + 1; r < childRank; r++) {
          const vid = `__virtual_${counter++}__`
          virtualUnits.push({ id: vid })
          virtualRanks.set(vid, r)
          virtualEdges.push({
            from: prevId,
            to: vid,
            originalParentId: u.id,
            originalChildId: childUnitId,
          })
          prevId = vid
        }
        virtualEdges.push({
          from: prevId,
          to: childUnitId,
          originalParentId: u.id,
          originalChildId: childUnitId,
        })
      }
    }
  }

  return { virtualUnits, virtualRanks, virtualEdges }
}

export interface LayoutPosition {
  x: number
  y: number
  width: number
  compact: boolean
  /** True for synthetic units inserted by expandVirtualNodes; not rendered. */
  isVirtual?: boolean
}

export interface LayoutOptions {
  /** Per-person branch-side classification (from classifyBranchSides). */
  branchSides: Map<string, BranchSide>
  /** When true, paternal/maternal lane constraint applies. Disable in Full Tree view. */
  useLanes: boolean
}

export interface LayoutByLanesResult {
  positions: Map<string, LayoutPosition>
}

/**
 * Position every unit using a Sugiyama-style algorithm:
 *   1. Rank assignment (computeRanks).
 *   2. Crossing reduction via median heuristic (multiple sweeps).
 *   3. X-positioning with subtree-width balancing, sibling compression, and (optionally)
 *      lane constraint.
 *
 * Y is rank * TIER_HEIGHT — guarantees same-rank = same-Y.
 */
export function layoutByLanes(
  units: FamilyUnit[],
  personToUnit: Map<string, string>,
  options: LayoutOptions,
): LayoutByLanesResult {
  const ranks = computeRanks(units, personToUnit)
  const expansion = expandVirtualNodes(units, personToUnit, ranks)

  // Combined unit list: real + virtual.
  type SyntheticUnit = { id: string; isVirtual: true }
  type AnyUnit = FamilyUnit | SyntheticUnit
  const allUnits: AnyUnit[] = [
    ...units,
    ...expansion.virtualUnits.map((v) => ({ id: v.id, isVirtual: true as const })),
  ]
  const allRanks = new Map<string, number>(ranks)
  for (const [vid, vr] of expansion.virtualRanks) allRanks.set(vid, vr)

  // Group units by rank.
  const rankToUnits = new Map<number, AnyUnit[]>()
  for (const u of allUnits) {
    const r = allRanks.get(u.id) ?? 0
    if (!rankToUnits.has(r)) rankToUnits.set(r, [])
    rankToUnits.get(r)!.push(u)
  }

  // Build per-rank ordering. Initial order: units sorted by id (stable).
  const rankSorted = new Map<number, string[]>()
  for (const [r, list] of rankToUnits) {
    rankSorted.set(r, list.map((u) => u.id).sort())
  }

  // Sibling-count tier per child-unit: derived from each parent unit's child count.
  // All siblings of one parent share a tier.
  const siblingTierByUnit = new Map<string, "normal" | "tight" | "compact">()
  for (const u of units) {
    const childUnitIds = u.childIds
      .map((cid) => personToUnit.get(cid))
      .filter((id): id is string => !!id && id !== u.id)
    const distinct = new Set(childUnitIds)
    const count = distinct.size
    let tier: "normal" | "tight" | "compact" = "normal"
    if (count > SIBLING_TIER_TIGHT_MAX) tier = "compact"
    else if (count > SIBLING_TIER_NORMAL_MAX) tier = "tight"
    for (const cuid of distinct) siblingTierByUnit.set(cuid, tier)
  }

  // Build adjacency from virtual edges (real edges + segments through virtuals).
  const adjacency = buildAdjacency(expansion.virtualEdges)

  // Crossing reduction: median heuristic, alternating top-down and bottom-up, 4 iterations.
  const sortedRankKeys = [...rankSorted.keys()].sort((a, b) => a - b)
  for (let iter = 0; iter < 4; iter++) {
    const direction = iter % 2 === 0 ? "down" : "up"
    const rankKeys = direction === "down" ? sortedRankKeys : [...sortedRankKeys].reverse()
    for (const r of rankKeys) {
      const list = rankSorted.get(r) ?? []
      const adjRank = direction === "down" ? r - 1 : r + 1
      const adjList = rankSorted.get(adjRank) ?? []
      const adjPos = new Map<string, number>()
      adjList.forEach((id, i) => adjPos.set(id, i))
      const withMedian = list.map((id) => {
        const neighbors =
          direction === "down"
            ? adjacency.parents.get(id) ?? []
            : adjacency.children.get(id) ?? []
        const positions = neighbors
          .map((n) => adjPos.get(n))
          .filter((p): p is number => p !== undefined)
          .sort((a, b) => a - b)
        const median =
          positions.length === 0 ? -1 : positions[Math.floor(positions.length / 2)]!
        return { id, median }
      })
      withMedian.sort((a, b) => a.median - b.median)
      rankSorted.set(r, withMedian.map((x) => x.id))
    }
  }

  // Compute width per unit.
  const widthByUnit = new Map<string, number>()
  for (const u of allUnits) {
    if ("isVirtual" in u && u.isVirtual) {
      widthByUnit.set(u.id, 0)
      continue
    }
    const real = u as FamilyUnit
    const tier = siblingTierByUnit.get(real.id) ?? "normal"
    const compact = tier === "compact"
    const w = compact
      ? real.spouseId
        ? COUPLE_NODE_WIDTH_COMPACT
        : PERSON_WIDTH_COMPACT
      : real.spouseId
        ? COUPLE_NODE_WIDTH
        : PERSON_WIDTH
    widthByUnit.set(real.id, w)
  }

  // Subtree-width budget (memoized recursive computation).
  const subtreeWidth = new Map<string, number>()
  function computeSubtreeWidth(unitId: string): number {
    const cached = subtreeWidth.get(unitId)
    if (cached !== undefined) return cached
    const myWidth = widthByUnit.get(unitId) ?? 0
    const children = adjacency.children.get(unitId) ?? []
    if (children.length === 0) {
      subtreeWidth.set(unitId, myWidth)
      return myWidth
    }
    const firstChildTier = siblingTierByUnit.get(children[0]!) ?? "normal"
    const gap =
      firstChildTier === "compact"
        ? MIN_SIBLING_GAP_COMPACT
        : firstChildTier === "tight"
          ? MIN_SIBLING_GAP_TIGHT
          : MIN_SIBLING_GAP_NORMAL
    let sum = 0
    for (const c of children) sum += computeSubtreeWidth(c)
    sum += gap * Math.max(0, children.length - 1)
    const result = Math.max(myWidth, sum)
    subtreeWidth.set(unitId, result)
    return result
  }
  for (const u of allUnits) computeSubtreeWidth(u.id)

  // Place each rank left-to-right with cumulative-with-gaps positioning.
  const positions = new Map<string, LayoutPosition>()
  for (const r of sortedRankKeys) {
    const list = rankSorted.get(r) ?? []
    let cursor = 0
    for (const id of list) {
      const w = widthByUnit.get(id) ?? 0
      const isVirtual = expansion.virtualRanks.has(id)
      const tier = siblingTierByUnit.get(id) ?? "normal"
      const compact = !isVirtual && tier === "compact"
      positions.set(id, {
        x: cursor + w / 2,
        y: r * TIER_HEIGHT,
        width: w,
        compact,
        isVirtual,
      })
      const gap =
        tier === "compact"
          ? MIN_SIBLING_GAP_COMPACT
          : tier === "tight"
            ? MIN_SIBLING_GAP_TIGHT
            : MIN_SIBLING_GAP_NORMAL
      cursor += w + gap
    }
  }

  // Parent-centering: bottom-up, shift each parent so it's centered over its children's X span.
  const reverseRanks = [...sortedRankKeys].reverse()
  for (const r of reverseRanks) {
    const list = rankSorted.get(r) ?? []
    for (const id of list) {
      const children = adjacency.children.get(id) ?? []
      if (children.length === 0) continue
      const childPositions = children
        .map((c) => positions.get(c))
        .filter((p): p is LayoutPosition => p !== undefined)
      if (childPositions.length === 0) continue
      const minX = Math.min(...childPositions.map((p) => p.x))
      const maxX = Math.max(...childPositions.map((p) => p.x))
      const center = (minX + maxX) / 2
      const cur = positions.get(id)!
      positions.set(id, { ...cur, x: center })
    }
  }

  // Resolve overlaps within each rank (post-centering, parents may collide).
  for (const r of sortedRankKeys) {
    const list = rankSorted.get(r) ?? []
    for (let i = 1; i < list.length; i++) {
      const prev = positions.get(list[i - 1]!)!
      const cur = positions.get(list[i]!)!
      const tier = siblingTierByUnit.get(list[i]!) ?? "normal"
      const gap =
        tier === "compact"
          ? MIN_SIBLING_GAP_COMPACT
          : tier === "tight"
            ? MIN_SIBLING_GAP_TIGHT
            : MIN_SIBLING_GAP_NORMAL
      const minLeftEdge = prev.x + prev.width / 2 + gap + cur.width / 2
      if (cur.x < minLeftEdge) {
        positions.set(list[i]!, { ...cur, x: minLeftEdge })
      }
    }
  }

  // Lane constraint (Branch view only).
  if (options.useLanes) {
    // Find focus's x; shift everything so focus sits at x = 0.
    let focusX = 0
    for (const u of units) {
      if (options.branchSides.get(u.primaryId) === "self") {
        focusX = positions.get(u.id)?.x ?? 0
        break
      }
    }
    for (const [id, p] of positions) {
      positions.set(id, { ...p, x: p.x - focusX })
    }
    // Snap units to their correct lane.
    for (const u of units) {
      const side = options.branchSides.get(u.primaryId) ?? "neutral"
      const p = positions.get(u.id)
      if (!p) continue
      if (side === "paternal" && p.x > -LANE_CENTER_HALF_WIDTH) {
        positions.set(u.id, { ...p, x: -LANE_CENTER_HALF_WIDTH - p.width / 2 })
      } else if (side === "maternal" && p.x < LANE_CENTER_HALF_WIDTH) {
        positions.set(u.id, { ...p, x: LANE_CENTER_HALF_WIDTH + p.width / 2 })
      }
    }
    // Re-resolve overlaps within each lane (independently).
    const paternal: { id: string; pos: LayoutPosition }[] = []
    const maternal: { id: string; pos: LayoutPosition }[] = []
    for (const u of units) {
      const side = options.branchSides.get(u.primaryId)
      const p = positions.get(u.id)
      if (!p) continue
      if (side === "paternal") paternal.push({ id: u.id, pos: p })
      else if (side === "maternal") maternal.push({ id: u.id, pos: p })
    }
    paternal.sort((a, b) => a.pos.x - b.pos.x)
    maternal.sort((a, b) => a.pos.x - b.pos.x)
    function resolveOverlap(group: { id: string; pos: LayoutPosition }[], isLeft: boolean): void {
      if (isLeft) {
        for (let i = group.length - 2; i >= 0; i--) {
          const cur = group[i]!.pos
          const next = group[i + 1]!.pos
          const maxRightEdge = next.x - next.width / 2 - MIN_SIBLING_GAP_NORMAL - cur.width / 2
          if (cur.x > maxRightEdge) {
            const newPos = { ...cur, x: maxRightEdge }
            positions.set(group[i]!.id, newPos)
            group[i]!.pos = newPos
          }
        }
      } else {
        for (let i = 1; i < group.length; i++) {
          const cur = group[i]!.pos
          const prev = group[i - 1]!.pos
          const minLeftEdge = prev.x + prev.width / 2 + MIN_SIBLING_GAP_NORMAL + cur.width / 2
          if (cur.x < minLeftEdge) {
            const newPos = { ...cur, x: minLeftEdge }
            positions.set(group[i]!.id, newPos)
            group[i]!.pos = newPos
          }
        }
      }
    }
    resolveOverlap(paternal, true)
    resolveOverlap(maternal, false)
  }

  return { positions }
}

// Adjacency helper: from a list of edges, build parent->children and child->parents maps.
function buildAdjacency(edges: VirtualEdge[]): {
  children: Map<string, string[]>
  parents: Map<string, string[]>
} {
  const children = new Map<string, string[]>()
  const parents = new Map<string, string[]>()
  for (const e of edges) {
    if (!children.has(e.from)) children.set(e.from, [])
    children.get(e.from)!.push(e.to)
    if (!parents.has(e.to)) parents.set(e.to, [])
    parents.get(e.to)!.push(e.from)
  }
  return { children, parents }
}

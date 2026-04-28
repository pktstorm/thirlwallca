import type { FamilyUnit } from "./layoutUtils"

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

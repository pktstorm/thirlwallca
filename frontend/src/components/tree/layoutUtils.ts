import type { ApiTreeEdge, ApiTreeNode, TreeNodeData } from "./FamilyTreeCanvas"
import type { Node, Edge } from "@xyflow/react"

// --- Constants ---

/** Width of a single person within a couple node */
export const PERSON_WIDTH = 180
/** Width of a couple node (two people side by side) */
export const COUPLE_NODE_WIDTH = 380
/** Height of a single person node (solo) */
export const PERSON_NODE_HEIGHT = 64
/** Height of a couple node */
export const COUPLE_NODE_HEIGHT = 64
/** Vertical spacing between generations */
export const TIER_HEIGHT = 160
/** Minimum horizontal gap between sibling nodes in the same tier */
export const MIN_SIBLING_GAP = 60
/** Extra gap between different family units in same tier */
export const FAMILY_GAP = 80
/** Width of the trunk bar connecting siblings */
export const TRUNK_BAR_HEIGHT = 1

// --- Types ---

export interface CoupleNodeData extends Record<string, unknown> {
  /** Primary person (the one with parent-child connections, or leftmost) */
  primary: TreeNodeData
  /** Spouse person, if any */
  spouse: TreeNodeData | null
  /** Whether this is a couple or solo node */
  isCouple: boolean
  /** IDs for click handling */
  primaryId: string
  spouseId: string | null
  /** Direct line flags */
  primaryIsDirectLine?: boolean
  spouseIsDirectLine?: boolean
  primaryIsFocused?: boolean
  spouseIsFocused?: boolean
  /** Visual Y-offset (in generations) for the spouse — comes from FamilyUnit.spouseGenOffset.
   *  Zero means no offset. Nonzero means render the spouse shifted vertically. */
  spouseGenOffset?: number
  /** Render in compact size (new pipeline: many siblings). */
  compact?: boolean
}

export type CoupleNode = Node<CoupleNodeData, "coupleNode">

export interface TrunkEdgeData extends Record<string, unknown> {
  isDirectLine?: boolean
  /** IDs of child nodes connected by this trunk */
  childNodeIds: string[]
  /** Parent couple node ID */
  parentNodeId: string
  /** Precomputed SVG path from edgeRouter; if absent, PersonEdge falls back to its own bezier. */
  path?: string
}

export type TreeEdge = Edge<TrunkEdgeData>

// --- Family Unit Grouping ---

export interface FamilyUnit {
  /** Unique ID for this family unit (couple IDs joined) */
  id: string
  /** Primary person (has parent connections) */
  primaryId: string
  /** Spouse ID if any */
  spouseId: string | null
  /** Child person IDs */
  childIds: string[]
  /** Generation level (0 = root) */
  generation: number
  /** Visual Y-offset for spouse within the couple node, in generations.
   *  Clamped to [-3, +3]. Zero means no offset (the common case). */
  spouseGenOffset: number
}

/**
 * Group people into family units: a couple (or solo person) + their children.
 * Each (couple, children-of-this-marriage) is its own unit — a person with multiple
 * marriages produces one couple unit per marriage.
 * People with no spouse and no children become solo units.
 */
export function buildFamilyUnits(
  nodes: ApiTreeNode[],
  edges: ApiTreeEdge[],
): { units: FamilyUnit[]; personToUnit: Map<string, string>; generationMap: Map<string, number> } {
  const nodeIds = new Set(nodes.map((n) => n.id))

  // 1. Build adjacency maps
  const parentToChildren = new Map<string, Set<string>>()
  const childToParents = new Map<string, Set<string>>()
  const spousePairs: [string, string][] = []

  for (const e of edges) {
    if (e.type === "parent_child") {
      if (!parentToChildren.has(e.source)) parentToChildren.set(e.source, new Set())
      parentToChildren.get(e.source)!.add(e.target)
      if (!childToParents.has(e.target)) childToParents.set(e.target, new Set())
      childToParents.get(e.target)!.add(e.source)
    } else if (e.type === "spouse") {
      spousePairs.push([e.source, e.target])
    }
  }

  // 2. Compute generations (unchanged)
  const generationMap = computeGenerations(nodes, edges)

  // Spouse generation offset is currently disabled. The previous implementation used
  // `computeRawGenerations` (longest-path depth from any root), but that depth measures "how
  // deep is the recorded ancestry chain", not "what genealogical generation is this person."
  // Two same-generation spouses can have wildly different chain depths simply because one
  // side's ancestry has been traced further than the other. Result: nearly every couple where
  // the two sides have asymmetrically-traced ancestry showed a misleading +/-3G clamp badge.
  //
  // The infrastructure (FamilyUnit.spouseGenOffset, CoupleNode rendering) stays in place. To
  // re-enable, replace the body of computeSpouseGenOffset below with a metric grounded in a
  // common reference (e.g. generations relative to the focus person, or relative to the
  // deepest shared ancestor).
  function computeSpouseGenOffset(_primaryId: string, _spouseId: string | null): number {
    return 0
  }

  // 3. Emit a couple unit for every distinct spouse pair
  const units: FamilyUnit[] = []
  const seenSpousePairs = new Set<string>() // canonical key "minId:maxId"
  const assignedChildren = new Set<string>() // children assigned to a couple unit

  for (const [a, b] of spousePairs) {
    if (!nodeIds.has(a) || !nodeIds.has(b)) continue
    const key = a < b ? `${a}:${b}` : `${b}:${a}`
    if (seenSpousePairs.has(key)) continue
    seenSpousePairs.add(key)

    // Determine primary/spouse: the person with recorded parents is "primary".
    // When both or neither have parents, prefer the edge source (a) as primary —
    // this preserves input order so that personToUnit[thomas] resolves to the first
    // spouse-edge involving thomas (which has thomas as the source).
    const aHasParents = (childToParents.get(a)?.size ?? 0) > 0
    const bHasParents = (childToParents.get(b)?.size ?? 0) > 0
    let primary: string, spouse: string
    if (aHasParents && !bHasParents) {
      primary = a; spouse = b
    } else if (bHasParents && !aHasParents) {
      primary = b; spouse = a
    } else {
      // Both or neither have parents — prefer the edge source for stability
      primary = a; spouse = b
    }

    // Children of THIS marriage: those recorded as children of BOTH parents
    const aChildren = parentToChildren.get(a) ?? new Set<string>()
    const bChildren = parentToChildren.get(b) ?? new Set<string>()
    const sharedChildren = [...aChildren]
      .filter((c) => bChildren.has(c) && nodeIds.has(c))
      .sort()
    for (const c of sharedChildren) assignedChildren.add(c)

    units.push({
      id: `${primary}+${spouse}`,
      primaryId: primary,
      spouseId: spouse,
      childIds: sharedChildren,
      generation: generationMap.get(primary) ?? 0,
      spouseGenOffset: computeSpouseGenOffset(primary, spouse),
    })
  }

  // 4. Track who's already in some couple unit
  const usedInUnit = new Set<string>()
  for (const u of units) {
    usedInUnit.add(u.primaryId)
    if (u.spouseId) usedInUnit.add(u.spouseId)
  }

  // 5. Handle children with only one recorded parent (orphan children not yet in a couple unit)
  // Group unassigned children by their single parent
  const soloParentChildren = new Map<string, Set<string>>()
  for (const id of nodeIds) {
    if (assignedChildren.has(id)) continue
    const parents = [...(childToParents.get(id) ?? [])].filter((p) => nodeIds.has(p))
    if (parents.length === 0) continue
    // Use first parent as deterministic key
    const parent = parents[0]!
    if (!soloParentChildren.has(parent)) soloParentChildren.set(parent, new Set())
    soloParentChildren.get(parent)!.add(id)
    assignedChildren.add(id)
  }

  for (const [parent, childSet] of soloParentChildren) {
    // If the parent is already in a couple unit, add orphan children to that unit
    const existingUnit = units.find((u) => u.primaryId === parent || u.spouseId === parent)
    if (existingUnit) {
      const merged = new Set([...existingUnit.childIds, ...childSet])
      existingUnit.childIds = [...merged].sort()
    } else {
      // Emit a solo-parent unit
      units.push({
        id: parent,
        primaryId: parent,
        spouseId: null,
        childIds: [...childSet].sort(),
        generation: generationMap.get(parent) ?? 0,
        spouseGenOffset: 0,
      })
      usedInUnit.add(parent)
    }
  }

  // 6. Completely solo people (no marriages, no children, no parents recorded)
  for (const node of nodes) {
    if (usedInUnit.has(node.id)) continue
    units.push({
      id: node.id,
      primaryId: node.id,
      spouseId: null,
      childIds: [],
      generation: generationMap.get(node.id) ?? 0,
      spouseGenOffset: 0,
    })
    usedInUnit.add(node.id)
  }

  // 7. Build personToUnit — first unit a person appears in (as primary or spouse) wins.
  // Children are also mapped so trunk edge construction can resolve them.
  const personToUnit = new Map<string, string>()
  for (const u of units) {
    if (!personToUnit.has(u.primaryId)) personToUnit.set(u.primaryId, u.id)
    if (u.spouseId && !personToUnit.has(u.spouseId)) personToUnit.set(u.spouseId, u.id)
  }
  // Map children that aren't yet in personToUnit: prefer child's own primary unit if it exists,
  // otherwise fall back to the parent unit where they appear as a child.
  for (const u of units) {
    for (const cid of u.childIds) {
      if (!personToUnit.has(cid)) {
        const childOwnUnit = units.find((x) => x.primaryId === cid)
        personToUnit.set(cid, childOwnUnit?.id ?? u.id)
      }
    }
  }

  return { units, personToUnit, generationMap }
}

// --- Generation computation ---

function computeGenerations(
  nodes: ApiTreeNode[],
  edges: ApiTreeEdge[],
): Map<string, number> {
  const nodeIds = nodes.map((n) => n.id)
  const parentChildEdges = edges.filter((e) => e.type === "parent_child")
  const spouseEdges = edges.filter((e) => e.type === "spouse")

  // Union-find for spouse contraction
  const uf = new Map<string, string>()
  function find(x: string): string {
    if (!uf.has(x)) uf.set(x, x)
    let r = x
    while (uf.get(r) !== r) r = uf.get(r)!
    let c = x
    while (c !== r) { const n = uf.get(c)!; uf.set(c, r); c = n }
    return r
  }
  for (const e of spouseEdges) {
    const ra = find(e.source), rb = find(e.target)
    if (ra !== rb) uf.set(ra, rb)
  }

  // Build contracted DAG
  const superChildren = new Map<string, Set<string>>()
  const superInDeg = new Map<string, number>()
  const allSupers = new Set<string>()

  for (const id of nodeIds) allSupers.add(find(id))
  for (const s of allSupers) {
    superInDeg.set(s, 0)
    superChildren.set(s, new Set())
  }

  for (const e of parentChildEdges) {
    const parentSuper = find(e.source)
    const childSuper = find(e.target)
    if (parentSuper === childSuper) continue
    if (!superChildren.get(parentSuper)!.has(childSuper)) {
      superChildren.get(parentSuper)!.add(childSuper)
      superInDeg.set(childSuper, (superInDeg.get(childSuper) ?? 0) + 1)
    }
  }

  // Longest-path via Kahn's topological sort
  const superGen = new Map<string, number>()
  const queue: string[] = []
  for (const s of allSupers) {
    superGen.set(s, 0)
    if ((superInDeg.get(s) ?? 0) === 0) queue.push(s)
  }

  let qi = 0
  while (qi < queue.length) {
    const cur = queue[qi++]!
    const curG = superGen.get(cur)!
    for (const child of superChildren.get(cur) ?? []) {
      superGen.set(child, Math.max(superGen.get(child)!, curG + 1))
      const rem = superInDeg.get(child)! - 1
      superInDeg.set(child, rem)
      if (rem === 0) queue.push(child)
    }
  }

  // Expand back
  const gen = new Map<string, number>()
  for (const id of nodeIds) {
    gen.set(id, superGen.get(find(id)) ?? 0)
  }

  // Normalize to 0
  let minG = Infinity
  for (const g of gen.values()) if (g < minG) minG = g
  if (minG > 0) for (const id of nodeIds) gen.set(id, gen.get(id)! - minG)

  return gen
}

// --- Family-Unit Layout Algorithm ---

export interface UnitPosition {
  unitId?: string  // legacy field, kept for backwards compat
  x: number
  y: number
  width: number
  compact?: boolean   // NEW: layout flagged for compact rendering
}

/**
 * Layout family units hierarchically.
 * 1. Place units by generation (top to bottom)
 * 2. Within a generation, order children-units left-to-right based on their parent unit's position
 * 3. Center parent units over their children
 */
export function layoutFamilyUnits(
  units: FamilyUnit[],
  personToUnit: Map<string, string>,
): Map<string, UnitPosition> {
  // Build unit adjacency: which units are parents of which units
  const unitChildren = new Map<string, string[]>() // parent unit -> child units
  const unitParents = new Map<string, string[]>() // child unit -> parent units

  for (const unit of units) {
    for (const childId of unit.childIds) {
      const childUnit = personToUnit.get(childId)
      if (!childUnit) continue
      // The child might be the primary of their own couple unit
      const childFamilyUnit = units.find((u) => u.id === childUnit)
      if (!childFamilyUnit) continue

      // Only create parent->child links when the child IS the primary (or spouse) of the child unit
      // This avoids double-linking
      if (childFamilyUnit.primaryId === childId || childFamilyUnit.spouseId === childId) {
        if (!unitChildren.has(unit.id)) unitChildren.set(unit.id, [])
        const existing = unitChildren.get(unit.id)!
        if (!existing.includes(childUnit)) existing.push(childUnit)

        if (!unitParents.has(childUnit)) unitParents.set(childUnit, [])
        const existingParents = unitParents.get(childUnit)!
        if (!existingParents.includes(unit.id)) existingParents.push(unit.id)
      }
    }
  }

  // Group units by generation
  const genToUnits = new Map<number, FamilyUnit[]>()
  for (const unit of units) {
    if (!genToUnits.has(unit.generation)) genToUnits.set(unit.generation, [])
    genToUnits.get(unit.generation)!.push(unit)
  }

  const sortedGens = [...genToUnits.keys()].sort((a, b) => a - b)
  const positions = new Map<string, UnitPosition>()

  // Process generation by generation, top to bottom
  for (const gen of sortedGens) {
    const genUnits = genToUnits.get(gen)!
    const y = gen * TIER_HEIGHT

    // Sort units within a generation:
    // 1. Units with parents: order by parent's X position
    // 2. Units without parents (roots): stable order
    genUnits.sort((a, b) => {
      const aParents = unitParents.get(a.id) ?? []
      const bParents = unitParents.get(b.id) ?? []

      // If both have positioned parents, sort by parent X
      const aParentX = aParents.length > 0 && positions.has(aParents[0]!)
        ? positions.get(aParents[0]!)!.x
        : Infinity
      const bParentX = bParents.length > 0 && positions.has(bParents[0]!)
        ? positions.get(bParents[0]!)!.x
        : Infinity

      if (aParentX !== bParentX) return aParentX - bParentX

      // Fallback: alphabetical by unit ID for stability
      return a.id < b.id ? -1 : 1
    })

    // Place units left to right
    let currentX = 0
    let prevParent: string | null = null

    for (const unit of genUnits) {
      const width = unit.spouseId ? COUPLE_NODE_WIDTH : PERSON_WIDTH

      // Add family gap between units from different parent families
      const parents = unitParents.get(unit.id) ?? []
      const parentKey = parents.length > 0 ? parents[0]! : null
      if (prevParent !== null && parentKey !== prevParent) {
        currentX += FAMILY_GAP
      }
      prevParent = parentKey

      positions.set(unit.id, {
        unitId: unit.id,
        x: currentX,
        y,
        width,
      })

      currentX += width + MIN_SIBLING_GAP
    }
  }

  // Second pass: center parents over their children
  // Go bottom-up to propagate centering
  for (const gen of [...sortedGens].reverse()) {
    const genUnits = genToUnits.get(gen)!
    for (const unit of genUnits) {
      const children = unitChildren.get(unit.id) ?? []
      if (children.length === 0) continue

      const childPositions = children
        .map((cid) => positions.get(cid))
        .filter((p): p is UnitPosition => p !== undefined)

      if (childPositions.length === 0) continue

      // Center parent over children span
      const leftmost = Math.min(...childPositions.map((p) => p.x))
      const rightmost = Math.max(...childPositions.map((p) => p.x + p.width))
      const childrenCenter = (leftmost + rightmost) / 2

      const parentPos = positions.get(unit.id)!
      const parentCenter = parentPos.x + parentPos.width / 2
      const shift = childrenCenter - parentCenter

      if (Math.abs(shift) > 1) {
        parentPos.x += shift
      }
    }
  }

  // Third pass: resolve overlaps within each tier (push right)
  for (const gen of sortedGens) {
    const genUnits = genToUnits.get(gen)!
    const genPositions = genUnits
      .map((u) => positions.get(u.id)!)
      .sort((a, b) => a.x - b.x)

    for (let i = 1; i < genPositions.length; i++) {
      const prev = genPositions[i - 1]!
      const curr = genPositions[i]!
      const minX = prev.x + prev.width + MIN_SIBLING_GAP
      if (curr.x < minX) {
        const shift = minX - curr.x
        curr.x = minX
        // Push all subsequent nodes too
        for (let j = i + 1; j < genPositions.length; j++) {
          genPositions[j]!.x += shift
        }
      }
    }
  }

  // Fourth pass: re-center parents after overlap resolution
  for (const gen of [...sortedGens].reverse()) {
    const genUnits = genToUnits.get(gen)!
    for (const unit of genUnits) {
      const children = unitChildren.get(unit.id) ?? []
      if (children.length === 0) continue

      const childPositions = children
        .map((cid) => positions.get(cid))
        .filter((p): p is UnitPosition => p !== undefined)

      if (childPositions.length === 0) continue

      const leftmost = Math.min(...childPositions.map((p) => p.x))
      const rightmost = Math.max(...childPositions.map((p) => p.x + p.width))
      const childrenCenter = (leftmost + rightmost) / 2

      const parentPos = positions.get(unit.id)!
      const parentCenter = parentPos.x + parentPos.width / 2
      const shift = childrenCenter - parentCenter

      if (Math.abs(shift) > 1) {
        parentPos.x += shift
      }
    }
  }

  // Final pass: resolve any remaining overlaps after re-centering
  for (const gen of sortedGens) {
    const genUnits = genToUnits.get(gen)!
    const genPositions = genUnits
      .map((u) => positions.get(u.id)!)
      .sort((a, b) => a.x - b.x)

    for (let i = 1; i < genPositions.length; i++) {
      const prev = genPositions[i - 1]!
      const curr = genPositions[i]!
      const minX = prev.x + prev.width + MIN_SIBLING_GAP
      if (curr.x < minX) {
        const shift = minX - curr.x
        curr.x = minX
        for (let j = i + 1; j < genPositions.length; j++) {
          genPositions[j]!.x += shift
        }
      }
    }
  }

  // Normalize: shift so leftmost node is at x=0
  let minX = Infinity
  for (const pos of positions.values()) {
    if (pos.x < minX) minX = pos.x
  }
  if (minX !== 0) {
    for (const pos of positions.values()) {
      pos.x -= minX
    }
  }

  return positions
}

// --- Build React Flow nodes and edges ---

export function buildReactFlowNodes(
  units: FamilyUnit[],
  positions: Map<string, UnitPosition>,
  apiNodes: ApiTreeNode[],
): CoupleNode[] {
  const nodeMap = new Map(apiNodes.map((n) => [n.id, n]))

  return units.map((unit) => {
    const pos = positions.get(unit.id)!
    const primary = nodeMap.get(unit.primaryId)!
    const spouse = unit.spouseId ? nodeMap.get(unit.spouseId) ?? null : null

    return {
      id: unit.id,
      type: "coupleNode" as const,
      position: { x: pos.x, y: pos.y },
      data: {
        primary: { ...primary.data },
        spouse: spouse ? { ...spouse.data } : null,
        isCouple: !!spouse,
        primaryId: unit.primaryId,
        spouseId: unit.spouseId,
        primaryIsDirectLine: false,
        spouseIsDirectLine: false,
        primaryIsFocused: false,
        spouseIsFocused: false,
        spouseGenOffset: unit.spouseGenOffset,
        compact: pos.compact ?? false,
      },
      style: {
        width: pos.width,
        height: unit.spouseId ? COUPLE_NODE_HEIGHT : PERSON_NODE_HEIGHT,
      },
    }
  })
}

/**
 * Build shared-trunk edges for parent->children connections.
 * Instead of individual parent->child edges, we create one "trunk" edge per parent unit
 * that connects to all its child units via a shared horizontal bar.
 */
export function buildReactFlowEdges(
  units: FamilyUnit[],
  personToUnit: Map<string, string>,
): TreeEdge[] {
  const edges: TreeEdge[] = []
  const seen = new Set<string>()

  for (const unit of units) {
    if (unit.childIds.length === 0) continue

    // Group children by their couple-unit
    const childUnitIds = new Set<string>()
    for (const childId of unit.childIds) {
      const childUnitId = personToUnit.get(childId)
      if (childUnitId) childUnitIds.add(childUnitId)
    }

    const childUnits = [...childUnitIds]
    const edgeId = `trunk-${unit.id}`
    if (seen.has(edgeId)) continue
    seen.add(edgeId)

    if (childUnits.length === 1) {
      // Single child: direct edge
      edges.push({
        id: edgeId,
        source: unit.id,
        target: childUnits[0]!,
        type: "parentChild",
        sourceHandle: "pc-source",
        targetHandle: "pc-target",
        data: {
          isDirectLine: false,
          childNodeIds: childUnits,
          parentNodeId: unit.id,
        },
      })
    } else {
      // Multiple children: one edge per child but all from the same parent
      // The trunk rendering is handled by the custom edge component
      for (const childUnitId of childUnits) {
        const childEdgeId = `${edgeId}->${childUnitId}`
        edges.push({
          id: childEdgeId,
          source: unit.id,
          target: childUnitId,
          type: "parentChild",
          sourceHandle: "pc-source",
          targetHandle: "pc-target",
          data: {
            isDirectLine: false,
            childNodeIds: childUnits,
            parentNodeId: unit.id,
          },
        })
      }
    }
  }

  return edges
}

// --- Direct line computation ---

/**
 * Walk up (ancestors) and down (descendants) from focusId,
 * including spouses of all direct-line people.
 * Returns a Set of person IDs on the direct line.
 */
export function computeDirectLinePersonIds(
  focusId: string,
  apiEdges: ApiTreeEdge[],
): Set<string> {
  const childToParents = new Map<string, string[]>()
  const parentToChildren = new Map<string, string[]>()
  const spouseMap = new Map<string, string[]>()

  for (const e of apiEdges) {
    if (e.type === "parent_child") {
      if (!childToParents.has(e.target)) childToParents.set(e.target, [])
      childToParents.get(e.target)!.push(e.source)
      if (!parentToChildren.has(e.source)) parentToChildren.set(e.source, [])
      parentToChildren.get(e.source)!.push(e.target)
    } else {
      if (!spouseMap.has(e.source)) spouseMap.set(e.source, [])
      spouseMap.get(e.source)!.push(e.target)
      if (!spouseMap.has(e.target)) spouseMap.set(e.target, [])
      spouseMap.get(e.target)!.push(e.source)
    }
  }

  const direct = new Set<string>()
  direct.add(focusId)

  // Walk UP
  const upQueue = [focusId]
  while (upQueue.length > 0) {
    const cur = upQueue.pop()!
    for (const parent of childToParents.get(cur) ?? []) {
      if (!direct.has(parent)) {
        direct.add(parent)
        upQueue.push(parent)
      }
    }
  }

  // Walk DOWN
  const downQueue = [focusId]
  while (downQueue.length > 0) {
    const cur = downQueue.pop()!
    for (const child of parentToChildren.get(cur) ?? []) {
      if (!direct.has(child)) {
        direct.add(child)
        downQueue.push(child)
      }
    }
  }

  // Add spouses
  const directCopy = [...direct]
  for (const id of directCopy) {
    for (const spouse of spouseMap.get(id) ?? []) {
      direct.add(spouse)
    }
  }

  return direct
}

/**
 * Convert person-level direct line IDs to unit-level IDs.
 */
export function personIdsToUnitIds(
  personIds: Set<string>,
  personToUnit: Map<string, string>,
): Set<string> {
  const unitIds = new Set<string>()
  for (const pid of personIds) {
    const uid = personToUnit.get(pid)
    if (uid) unitIds.add(uid)
  }
  return unitIds
}

import type { ApiTreeEdge, ApiTreeNode, TreeNodeData } from "./FamilyTreeCanvas"
import type { Node, Edge } from "@xyflow/react"

// --- Constants ---

export const NODE_WIDTH = 220
export const NODE_HEIGHT = 80
export const SPOUSE_GAP = 40
export const TIER_HEIGHT = 200
export const MIN_SIBLING_GAP = 60
export const FAMILY_GAP = 140

// --- Types ---

export type PersonNode = Node<TreeNodeData, "personNode">

export interface EdgeData extends Record<string, unknown> {
  isDirectLine?: boolean
}

export type TreeEdge = Edge<EdgeData>

interface LayoutNode {
  id: string
  x: number
  y: number
}

// --- Edge partitioning ---

export function partitionEdges(edges: ApiTreeEdge[]) {
  const parentChildEdges: ApiTreeEdge[] = []
  const spouseEdges: ApiTreeEdge[] = []

  for (const e of edges) {
    if (e.type === "spouse") {
      spouseEdges.push(e)
    } else {
      parentChildEdges.push(e)
    }
  }

  return { parentChildEdges, spouseEdges }
}

// --- Generation computation ---

/**
 * Compute generation levels for all nodes.
 *
 * Contracts spouse pairs into a single "super-node", computes the
 * longest path on the resulting DAG, then expands back so both
 * spouses share the same generation.
 */
export function computeGenerations(
  nodes: ApiTreeNode[],
  parentChildEdges: ApiTreeEdge[],
  spouseEdges: ApiTreeEdge[],
): Map<string, number> {
  const nodeIds = nodes.map((n) => n.id)

  // --- Spouse union-find: group spouses into a single representative ---
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

  // --- Build a contracted DAG of super-nodes ---
  // Each super-node = a set of spouses sharing the same generation.
  const superChildren = new Map<string, Set<string>>()  // super-parent → super-children
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
    if (parentSuper === childSuper) continue // self-loop after contraction
    if (!superChildren.get(parentSuper)!.has(childSuper)) {
      superChildren.get(parentSuper)!.add(childSuper)
      superInDeg.set(childSuper, (superInDeg.get(childSuper) ?? 0) + 1)
    }
  }

  // --- Longest-path via Kahn's topological sort on the super-graph ---
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

  // --- Expand back: every node gets its super-node's generation ---
  const gen = new Map<string, number>()
  for (const id of nodeIds) {
    gen.set(id, superGen.get(find(id)) ?? 0)
  }

  // --- Normalize to 0 ---
  let minG = Infinity
  for (const g of gen.values()) if (g < minG) minG = g
  if (minG > 0) for (const id of nodeIds) gen.set(id, gen.get(id)! - minG)

  return gen
}

// --- Spouse positioning ---

export function positionSpouses(
  nodes: LayoutNode[],
  spouseEdges: ApiTreeEdge[],
  parentChildEdges: ApiTreeEdge[],
): LayoutNode[] {
  const result = nodes.map((n) => ({ ...n }))
  const nodeMap = new Map(result.map((n) => [n.id, n]))

  // Track which nodes have parent-child connections
  const pcConnected = new Set<string>()
  for (const e of parentChildEdges) {
    pcConnected.add(e.source)
    pcConnected.add(e.target)
  }

  // Track already-placed spouses to handle multiple marriages
  const placedSpouses = new Set<string>()

  for (const edge of spouseEdges) {
    const nodeA = nodeMap.get(edge.source)
    const nodeB = nodeMap.get(edge.target)
    if (!nodeA || !nodeB) continue

    const aHasPC = pcConnected.has(nodeA.id)
    const bHasPC = pcConnected.has(nodeB.id)

    let anchor: LayoutNode
    let companion: LayoutNode

    if (aHasPC && !bHasPC) {
      anchor = nodeA
      companion = nodeB
    } else if (bHasPC && !aHasPC) {
      anchor = nodeB
      companion = nodeA
    } else {
      // Both (or neither) have parent-child edges — pick leftmost as anchor
      if (nodeA.x <= nodeB.x) {
        anchor = nodeA
        companion = nodeB
      } else {
        anchor = nodeB
        companion = nodeA
      }
    }

    // Count how many spouses already placed next to this anchor
    const existingOffset = placedSpouses.has(anchor.id) ? 1 : 0
    const offset = (1 + existingOffset) * (NODE_WIDTH + SPOUSE_GAP)

    companion.y = anchor.y
    companion.x = anchor.x + offset

    placedSpouses.add(anchor.id)
    placedSpouses.add(companion.id)
  }

  return result
}

// --- Grid snapping ---

export function snapToGrid(nodes: LayoutNode[], tierHeight: number): LayoutNode[] {
  const result = nodes.map((n) => ({ ...n }))

  // Collect all unique Y values and cluster them into tiers
  const yValues = result.map((n) => n.y)
  const minY = Math.min(...yValues)

  // Assign each node to a tier based on rounding
  for (const node of result) {
    const relativeY = node.y - minY
    const tier = Math.round(relativeY / tierHeight)
    node.y = tier * tierHeight
  }

  return result
}

// --- Overlap resolution ---

export function resolveOverlaps(
  nodes: LayoutNode[],
  nodeWidth: number,
  minGap: number,
): LayoutNode[] {
  const result = nodes.map((n) => ({ ...n }))

  // Group by Y tier
  const tiers = new Map<number, LayoutNode[]>()
  for (const node of result) {
    const tier = tiers.get(node.y) ?? []
    tier.push(node)
    tiers.set(node.y, tier)
  }

  // Within each tier, sort by X and push overlapping nodes right
  for (const [, tierNodes] of tiers) {
    tierNodes.sort((a, b) => a.x - b.x)
    for (let i = 1; i < tierNodes.length; i++) {
      const prev = tierNodes[i - 1]!
      const curr = tierNodes[i]!
      const minX = prev.x + nodeWidth + minGap
      if (curr.x < minX) {
        curr.x = minX
      }
    }
  }

  return result
}

// --- Family unit mapping ---

/**
 * Map each node to a "family key" derived from its sorted parent IDs.
 * Nodes with the same parents belong to the same family unit.
 * Nodes with no parents get a unique key.
 */
export function buildFamilyMap(
  nodeIds: string[],
  parentChildEdges: ApiTreeEdge[],
  spouseEdges: ApiTreeEdge[],
): Map<string, string> {
  // Build child → parents lookup
  const childToParents = new Map<string, string[]>()
  for (const edge of parentChildEdges) {
    const parents = childToParents.get(edge.target) ?? []
    parents.push(edge.source)
    childToParents.set(edge.target, parents)
  }

  const familyMap = new Map<string, string>()
  for (const id of nodeIds) {
    const parents = childToParents.get(id)
    if (parents && parents.length > 0) {
      familyMap.set(id, [...parents].sort().join("+"))
    } else {
      familyMap.set(id, `root:${id}`)
    }
  }

  // Normalize spouse pairs: married-in spouses inherit their partner's key
  for (const edge of spouseEdges) {
    const keyA = familyMap.get(edge.source)
    const keyB = familyMap.get(edge.target)
    if (keyA && keyB && keyA !== keyB) {
      if (keyA.startsWith("root:")) {
        familyMap.set(edge.source, keyB)
      } else {
        familyMap.set(edge.target, keyA)
      }
    }
  }

  return familyMap
}

// --- Family spacing ---

/**
 * Add extra horizontal spacing between nodes from different family units
 * within the same tier. Run after resolveOverlaps and before centerTree.
 */
export function applyFamilySpacing(
  nodes: LayoutNode[],
  familyMap: Map<string, string>,
  familyGap: number,
  nodeWidth: number,
): LayoutNode[] {
  const result = nodes.map((n) => ({ ...n }))

  // Group by Y tier
  const tiers = new Map<number, LayoutNode[]>()
  for (const node of result) {
    const tier = tiers.get(node.y) ?? []
    tier.push(node)
    tiers.set(node.y, tier)
  }

  for (const [, tierNodes] of tiers) {
    tierNodes.sort((a, b) => a.x - b.x)

    let cumulativeShift = 0
    for (let i = 1; i < tierNodes.length; i++) {
      const prevFamily = familyMap.get(tierNodes[i - 1]!.id)
      const currFamily = familyMap.get(tierNodes[i]!.id)

      if (prevFamily && currFamily && prevFamily !== currFamily) {
        const currentGap = tierNodes[i]!.x - tierNodes[i - 1]!.x
        const desiredMinGap = nodeWidth + familyGap
        if (currentGap < desiredMinGap) {
          cumulativeShift += desiredMinGap - currentGap
        }
      }

      tierNodes[i]!.x += cumulativeShift
    }
  }

  return result
}

// --- Flip Y axis (mirror vertically) ---

export function flipY(nodes: LayoutNode[]): LayoutNode[] {
  if (nodes.length === 0) return nodes

  const result = nodes.map((n) => ({ ...n }))
  const maxY = Math.max(...result.map((n) => n.y))

  for (const node of result) {
    node.y = maxY - node.y
  }

  return result
}

// --- Center tree horizontally ---

export function centerTree(nodes: LayoutNode[]): LayoutNode[] {
  if (nodes.length === 0) return nodes

  const result = nodes.map((n) => ({ ...n }))
  const minX = Math.min(...result.map((n) => n.x))

  // Shift so leftmost node starts at x=0
  for (const node of result) {
    node.x -= minX
  }

  return result
}

// --- Build React Flow nodes from layout ---

export function buildReactFlowNodes(
  layoutNodes: LayoutNode[],
  apiNodes: ApiTreeNode[],
): PersonNode[] {
  return layoutNodes.map((ln) => {
    const apiNode = apiNodes.find((n) => n.id === ln.id)!
    return {
      id: ln.id,
      type: "personNode" as const,
      position: { x: ln.x, y: ln.y },
      data: { ...apiNode.data },
      style: { width: NODE_WIDTH, height: NODE_HEIGHT },
    }
  })
}

// --- Build React Flow edges ---

export function buildReactFlowEdges(apiEdges: ApiTreeEdge[]): TreeEdge[] {
  return apiEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type === "spouse" ? "spouse" : "parentChild",
    sourceHandle: e.type === "spouse" ? "spouse-right" : "pc-source",
    targetHandle: e.type === "spouse" ? "spouse-left" : "pc-target",
    data: { isDirectLine: false },
  }))
}

// --- ELK layout options ---

export const ELK_LAYOUT_OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.spacing.nodeNode": "60",
  "elk.layered.spacing.nodeNodeBetweenLayers": "200",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
}

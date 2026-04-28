import type { ApiTreeEdge } from "./FamilyTreeCanvas"

export type BranchSide = "paternal" | "maternal" | "descendant" | "self" | "neutral"

export interface ClassifyOptions {
  fatherId?: string | null
  motherId?: string | null
  getGender?: (personId: string) => string | null
}

/**
 * Classify each person in `edges` relative to `focusPersonId`.
 * Returns a map: personId -> BranchSide.
 *
 * Algorithm:
 *   1. Identify focus's two parents (via fatherId/motherId hints, or by inferring from gender,
 *      or by alphabetical fallback).
 *   2. BFS up from each parent through parent_child edges; everyone reachable upward from the
 *      father is paternal, from the mother is maternal.
 *   3. BFS down from focus through parent_child edges; everyone reachable is descendant.
 *   4. focus itself is self.
 *   5. Anyone else is neutral.
 *
 * If focusPersonId is null, returns a map where every encountered person is "neutral".
 *
 * If a person appears in both lines (e.g. cousin marriage), the lane reached first in the walk wins.
 */
export function classifyBranchSides(
  edges: ApiTreeEdge[],
  focusPersonId: string | null,
  options: ClassifyOptions = {},
): Map<string, BranchSide> {
  const result = new Map<string, BranchSide>()

  // Collect all person ids referenced by edges.
  const allIds = new Set<string>()
  for (const e of edges) {
    allIds.add(e.source)
    allIds.add(e.target)
  }

  if (focusPersonId === null) {
    for (const id of allIds) result.set(id, "neutral")
    return result
  }

  // Build parent/child adjacency.
  const childToParents = new Map<string, string[]>()
  const parentToChildren = new Map<string, string[]>()
  for (const e of edges) {
    if (e.type !== "parent_child") continue
    if (!childToParents.has(e.target)) childToParents.set(e.target, [])
    childToParents.get(e.target)!.push(e.source)
    if (!parentToChildren.has(e.source)) parentToChildren.set(e.source, [])
    parentToChildren.get(e.source)!.push(e.target)
  }

  // Initialize all known ids to neutral.
  for (const id of allIds) result.set(id, "neutral")
  result.set(focusPersonId, "self")
  allIds.add(focusPersonId)

  // Identify focus's two parents.
  const parents = childToParents.get(focusPersonId) ?? []
  let fatherId: string | null = options.fatherId ?? null
  let motherId: string | null = options.motherId ?? null

  if (!fatherId && !motherId && parents.length > 0) {
    // Try to infer from gender.
    if (options.getGender) {
      for (const p of parents) {
        const g = options.getGender(p)
        if (g === "male" && !fatherId) fatherId = p
        else if (g === "female" && !motherId) motherId = p
      }
    }
    // Fallback: alphabetical assignment, first → paternal.
    const remaining = parents.filter((p) => p !== fatherId && p !== motherId).sort()
    for (const p of remaining) {
      if (!fatherId) fatherId = p
      else if (!motherId) motherId = p
    }
  }

  // BFS up from a starting parent, marking everyone with the side. Don't overwrite existing
  // non-neutral values (first-write-wins in case of cousin marriage).
  function walkUp(startId: string, side: BranchSide): void {
    const queue = [startId]
    const visited = new Set<string>()
    while (queue.length) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      if (result.get(id) === "neutral") result.set(id, side)
      const parents = childToParents.get(id) ?? []
      for (const p of parents) if (!visited.has(p)) queue.push(p)
    }
  }

  // BFS down from focus, marking descendants.
  function walkDown(startId: string): void {
    const queue: string[] = []
    const startChildren = parentToChildren.get(startId) ?? []
    for (const c of startChildren) queue.push(c)
    const visited = new Set<string>()
    while (queue.length) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      if (result.get(id) === "neutral") result.set(id, "descendant")
      const children = parentToChildren.get(id) ?? []
      for (const c of children) if (!visited.has(c)) queue.push(c)
    }
  }

  if (fatherId) walkUp(fatherId, "paternal")
  if (motherId) walkUp(motherId, "maternal")
  walkDown(focusPersonId)

  return result
}

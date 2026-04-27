import type {
  OrbitData,
  ControlOptions,
  LayoutResult,
  Slot,
  Ring,
  OrbitalEdge,
  OrbitAncestorNode,
} from "./orbitalTypes"
import {
  ORBITAL_HEMISPHERE_TOP_START,
  ORBITAL_HEMISPHERE_TOP_END,
} from "./orbitalConstants"
import { polarToCartesian, ringRadius, radialArcPath } from "./orbitalGeometry"

interface Wedge {
  start: number
  end: number
  branchKey: "paternal" | "maternal" | "descendant" | "self"
}

export function computeOrbitalLayout(
  data: OrbitData,
  _options: ControlOptions,
  _viewport: { width: number; height: number },
): LayoutResult {
  const slots: Slot[] = []
  const rings: Ring[] = []
  const edges: OrbitalEdge[] = []

  // 1) Focus at origin.
  slots.push({
    id: data.focus.id,
    personId: data.focus.id,
    ring: 0,
    angle: 0,
    x: 0,
    y: 0,
    branchKey: "self",
    parentSlotId: null,
    isSpouse: false,
    isSibling: false,
  })

  // 2) Ancestor wedges.
  // Track each ancestor's wedge so the next generation can subdivide it.
  const ancestorWedgeBySlotId = new Map<string, Wedge>()
  const focusFatherWedge: Wedge = {
    start: ORBITAL_HEMISPHERE_TOP_START,
    end: (ORBITAL_HEMISPHERE_TOP_START + ORBITAL_HEMISPHERE_TOP_END) / 2,
    branchKey: "paternal",
  }
  const focusMotherWedge: Wedge = {
    start: (ORBITAL_HEMISPHERE_TOP_START + ORBITAL_HEMISPHERE_TOP_END) / 2,
    end: ORBITAL_HEMISPHERE_TOP_END,
    branchKey: "maternal",
  }

  const generations = data.ancestorsByGeneration ?? []
  for (let g = 0; g < generations.length; g++) {
    const gen = generations[g]
    if (!gen) continue
    const r = ringRadius(g + 1)
    rings.push({ generation: g + 1, radius: r, hemisphere: "top" })

    // Group ancestors by parentId so we can subdivide each parent's wedge.
    const byParent = new Map<string, OrbitAncestorNode[]>()
    for (const a of gen) {
      const key = a.parentId ?? data.focus.id
      const list = byParent.get(key) ?? []
      list.push(a)
      byParent.set(key, list)
    }

    for (const [parentId, group] of byParent) {
      if (parentId === data.focus.id) {
        for (const a of group) {
          const w = a.parentSlot === "mother" ? focusMotherWedge : focusFatherWedge
          const slot = makeAncestorSlot(a, g + 1, w)
          slots.push(slot)
          ancestorWedgeBySlotId.set(slot.id, w)
        }
        continue
      }

      const parentWedge = ancestorWedgeBySlotId.get(parentId)
      if (!parentWedge) continue

      const mid = (parentWedge.start + parentWedge.end) / 2
      const fatherSub: Wedge = { start: parentWedge.start, end: mid, branchKey: parentWedge.branchKey }
      const motherSub: Wedge = { start: mid, end: parentWedge.end, branchKey: parentWedge.branchKey }

      for (const a of group) {
        const w = a.parentSlot === "mother" ? motherSub : fatherSub
        const slot = makeAncestorSlot(a, g + 1, w)
        slots.push(slot)
        ancestorWedgeBySlotId.set(slot.id, w)
      }
    }
  }

  // 3) Edges (ancestors): from each ancestor back to its parentSlotId.
  for (const slot of slots) {
    if (slot.parentSlotId) {
      const parent = slots.find((s) => s.id === slot.parentSlotId)
      if (!parent) continue
      const rP = Math.hypot(parent.x, parent.y)
      const rC = Math.hypot(slot.x, slot.y)
      const thetaP = Math.atan2(parent.y, parent.x)
      const thetaC = Math.atan2(slot.y, slot.x)
      const inner = rP < rC ? { r: rP, t: thetaP } : { r: rC, t: thetaC }
      const outer = rP < rC ? { r: rC, t: thetaC } : { r: rP, t: thetaP }
      const path = radialArcPath(inner.r, inner.t, outer.r, outer.t)
      edges.push({
        id: `${parent.id}->${slot.id}`,
        fromSlotId: parent.id,
        toSlotId: slot.id,
        type: "ancestor",
        path,
      })
    }
  }

  // 4) Bounds (rough): max ring radius * 2 for each axis, padded.
  const maxR = rings.reduce((m, r) => Math.max(m, r.radius), 0) + 80
  return {
    rings,
    slots,
    edges,
    bounds: { width: maxR * 2, height: maxR * 2 },
  }

  // ---- helpers ----
  function makeAncestorSlot(a: OrbitAncestorNode, ringGen: number, wedge: Wedge): Slot {
    const angle = (wedge.start + wedge.end) / 2
    const r = ringRadius(ringGen)
    const { x, y } = polarToCartesian(r, angle)
    return {
      id: a.id,
      personId: a.id,
      ring: ringGen,
      angle,
      x,
      y,
      branchKey: wedge.branchKey,
      parentSlotId: a.parentId,
      isSpouse: false,
      isSibling: false,
    }
  }
}

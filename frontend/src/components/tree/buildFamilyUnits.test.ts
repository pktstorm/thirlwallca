import { describe, it, expect } from "vitest"
import { buildFamilyUnits } from "./layoutUtils"
import type { ApiTreeNode, ApiTreeEdge } from "./FamilyTreeCanvas"

function person(id: string, gender: "male" | "female" | "other" | "unknown" = "unknown"): ApiTreeNode {
  return {
    id,
    label: id,
    data: {
      id,
      first_name: id,
      last_name: "X",
      gender,
      birth_date: null,
      death_date: null,
      is_living: true,
      profile_photo_url: null,
      occupation: null,
    },
  }
}

function pcEdge(parent: string, child: string): ApiTreeEdge {
  return { id: `${parent}-${child}`, source: parent, target: child, type: "parent_child" }
}

function spouseEdge(a: string, b: string): ApiTreeEdge {
  return { id: `${a}-${b}-sp`, source: a, target: b, type: "spouse" }
}

describe("buildFamilyUnits — spouseGenOffset", () => {
  it("computes 0 offset for same-generation couples", () => {
    // gp has child p1; gp2 has child p2; p1 and p2 marry. Both are gen 1 (or the same number).
    const nodes = [person("gp"), person("gp2"), person("p1", "male"), person("p2", "female")]
    const edges = [pcEdge("gp", "p1"), pcEdge("gp2", "p2"), spouseEdge("p1", "p2")]
    const { units } = buildFamilyUnits(nodes, edges)
    const couple = units.find((u) => u.spouseId !== null)!
    expect(couple.spouseGenOffset).toBe(0)
  })

  it("computes nonzero offset when spouse is in a different generation", () => {
    // p1 is gen 1; p2 is gen 2 (child of someone whose other parent is also gen 1).
    // Setup: gp -> p1; gp -> ancestorOfP2; ancestorOfP2 -> p2; p1 marries p2.
    const nodes = [
      person("gp"), person("p1", "male"),
      person("ancestor"), person("p2", "female"),
    ]
    const edges = [
      pcEdge("gp", "p1"),
      pcEdge("gp", "ancestor"),
      pcEdge("ancestor", "p2"),
      spouseEdge("p1", "p2"),
    ]
    const { units } = buildFamilyUnits(nodes, edges)
    const couple = units.find((u) => u.spouseId !== null && (u.primaryId === "p1" || u.spouseId === "p1"))
    expect(couple).toBeDefined()
    // Magnitude should be 1 (offset by exactly one generation).
    expect(Math.abs(couple!.spouseGenOffset)).toBe(1)
  })

  it("clamps offset to ±3", () => {
    // Build a deeply skewed couple.
    // gp -> p1 directly (gen 1); chain a1->a2->a3->a4->a5->p2 (gen 5+).
    const nodes = [
      person("gp"), person("p1", "male"),
      person("a1"), person("a2"), person("a3"), person("a4"), person("a5"),
      person("p2", "female"),
    ]
    const edges = [
      pcEdge("gp", "p1"),
      pcEdge("a1", "a2"), pcEdge("a2", "a3"), pcEdge("a3", "a4"), pcEdge("a4", "a5"), pcEdge("a5", "p2"),
      spouseEdge("p1", "p2"),
    ]
    const { units } = buildFamilyUnits(nodes, edges)
    const couple = units.find((u) => (u.primaryId === "p1" && u.spouseId === "p2") || (u.primaryId === "p2" && u.spouseId === "p1"))
    expect(couple).toBeDefined()
    expect(Math.abs(couple!.spouseGenOffset)).toBeLessThanOrEqual(3)
  })

  it("solo units (no spouse) have spouseGenOffset = 0", () => {
    const nodes = [person("solo")]
    const edges: ApiTreeEdge[] = []
    const { units } = buildFamilyUnits(nodes, edges)
    const solo = units.find((u) => u.primaryId === "solo")!
    expect(solo.spouseGenOffset).toBe(0)
  })
})

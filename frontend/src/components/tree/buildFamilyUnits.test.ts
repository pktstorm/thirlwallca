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
  // The spouse-generation-offset visual feature is currently disabled. The previous
  // implementation produced misleading badges whenever the two sides of a couple had
  // asymmetrically-traced ancestry depths. Until the feature is rebuilt around a
  // proper "generation relative to a common reference" metric, computeSpouseGenOffset
  // always returns 0. These tests pin that contract so the disable doesn't regress.

  it("returns 0 for same-generation couples", () => {
    const nodes = [person("gp"), person("gp2"), person("p1", "male"), person("p2", "female")]
    const edges = [pcEdge("gp", "p1"), pcEdge("gp2", "p2"), spouseEdge("p1", "p2")]
    const { units } = buildFamilyUnits(nodes, edges)
    const couple = units.find((u) => u.spouseId !== null)!
    expect(couple.spouseGenOffset).toBe(0)
  })

  it("returns 0 even when raw ancestry depths differ", () => {
    // p1 has 1 ancestor; p2 has 2 ancestors. Old impl would emit |offset| = 1.
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
    expect(couple!.spouseGenOffset).toBe(0)
  })

  it("returns 0 for solo units", () => {
    const nodes = [person("solo")]
    const edges: ApiTreeEdge[] = []
    const { units } = buildFamilyUnits(nodes, edges)
    const solo = units.find((u) => u.primaryId === "solo")!
    expect(solo.spouseGenOffset).toBe(0)
  })

  it("returns 0 for married-in spouses (one side has no recorded ancestry)", () => {
    const nodes = [person("gp"), person("p1", "male"), person("p2", "female")]
    const edges = [pcEdge("gp", "p1"), spouseEdge("p1", "p2")]
    const { units } = buildFamilyUnits(nodes, edges)
    const couple = units.find((u) => u.spouseId !== null)!
    expect(couple.spouseGenOffset).toBe(0)
  })
})

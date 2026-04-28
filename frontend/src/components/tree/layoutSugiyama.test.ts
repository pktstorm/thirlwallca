import { describe, it, expect } from "vitest"
import { computeRanks, expandVirtualNodes } from "./layoutSugiyama"
import type { FamilyUnit } from "./layoutUtils"

function unit(id: string, primaryId: string, spouseId: string | null, childIds: string[]): FamilyUnit {
  return { id, primaryId, spouseId, childIds, generation: 0, spouseGenOffset: 0 }
}

describe("computeRanks", () => {
  it("assigns rank 0 to root units (no parents)", () => {
    // u1 has no parents in any other unit's childIds.
    const units = [unit("u1", "p1", null, [])]
    const personToUnit = new Map<string, string>([["p1", "u1"]])
    const ranks = computeRanks(units, personToUnit)
    expect(ranks.get("u1")).toBe(0)
  })

  it("assigns increasing ranks to descendants", () => {
    // u1's child p2 is the primary of u2.
    const units = [
      unit("u1", "p1", null, ["p2"]),
      unit("u2", "p2", null, ["p3"]),
      unit("u3", "p3", null, []),
    ]
    const personToUnit = new Map<string, string>([
      ["p1", "u1"], ["p2", "u2"], ["p3", "u3"],
    ])
    const ranks = computeRanks(units, personToUnit)
    expect(ranks.get("u1")).toBe(0)
    expect(ranks.get("u2")).toBe(1)
    expect(ranks.get("u3")).toBe(2)
  })

  it("uses longest path so siblings of the same parent are at the same rank", () => {
    // u1 has children p2 and p3. p2 has child p4. p3 has no children.
    // u2 (p2's family) is rank 1; u3 (p3's family) is rank 1; u4 (p4's family) is rank 2.
    const units = [
      unit("u1", "p1", null, ["p2", "p3"]),
      unit("u2", "p2", null, ["p4"]),
      unit("u3", "p3", null, []),
      unit("u4", "p4", null, []),
    ]
    const personToUnit = new Map<string, string>([
      ["p1", "u1"], ["p2", "u2"], ["p3", "u3"], ["p4", "u4"],
    ])
    const ranks = computeRanks(units, personToUnit)
    expect(ranks.get("u1")).toBe(0)
    expect(ranks.get("u2")).toBe(1)
    expect(ranks.get("u3")).toBe(1)
    expect(ranks.get("u4")).toBe(2)
  })
})

describe("expandVirtualNodes", () => {
  it("inserts virtual units when a parent-child edge spans more than 1 rank", () => {
    // u1 (rank 0) has child p2 in u2 at rank 2 (skip-generation case).
    const units = [
      unit("u1", "p1", null, ["p2"]),
      unit("u2", "p2", null, []),
    ]
    const personToUnit = new Map<string, string>([["p1", "u1"], ["p2", "u2"]])
    const ranks = new Map<string, number>([["u1", 0], ["u2", 2]])
    const result = expandVirtualNodes(units, personToUnit, ranks)
    // Expect: 1 virtual unit at rank 1 between u1 and u2.
    expect(result.virtualUnits).toHaveLength(1)
    const vUnit = result.virtualUnits[0]!
    expect(result.virtualRanks.get(vUnit.id)).toBe(1)
    // Expect: edge mapping shows u1 → virtual → u2 (the original edge u1->u2 is replaced).
    const segment1 = result.virtualEdges.find((e) => e.from === "u1")!
    const segment2 = result.virtualEdges.find((e) => e.to === "u2")!
    expect(segment1.to).toBe(vUnit.id)
    expect(segment2.from).toBe(vUnit.id)
  })

  it("does nothing when all edges are single-rank", () => {
    const units = [unit("u1", "p1", null, ["p2"]), unit("u2", "p2", null, [])]
    const personToUnit = new Map<string, string>([["p1", "u1"], ["p2", "u2"]])
    const ranks = new Map<string, number>([["u1", 0], ["u2", 1]])
    const result = expandVirtualNodes(units, personToUnit, ranks)
    expect(result.virtualUnits).toHaveLength(0)
  })
})

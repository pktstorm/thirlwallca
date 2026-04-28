import { describe, it, expect } from "vitest"
import { computeRanks, expandVirtualNodes, layoutByLanes } from "./layoutSugiyama"
import type { FamilyUnit } from "./layoutUtils"
import type { BranchSide } from "./branchSide"

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

describe("layoutByLanes", () => {
  it("places all units in the same rank at the same Y", () => {
    const units = [
      unit("u1", "p1", null, ["p2", "p3"]),
      unit("u2", "p2", null, []),
      unit("u3", "p3", null, []),
    ]
    const personToUnit = new Map([["p1", "u1"], ["p2", "u2"], ["p3", "u3"]])
    const branchSides = new Map<string, BranchSide>([
      ["p1", "neutral"], ["p2", "neutral"], ["p3", "neutral"],
    ])
    const result = layoutByLanes(units, personToUnit, { branchSides, useLanes: false })
    expect(result.positions.get("u2")?.y).toBe(result.positions.get("u3")?.y)
  })

  it("respects compression tier for 8 siblings (tight gap)", () => {
    const childIds = Array.from({ length: 8 }, (_, i) => `c${i}`)
    const units: FamilyUnit[] = [
      { id: "u_parent", primaryId: "parent", spouseId: null, childIds, generation: 0, spouseGenOffset: 0 },
      ...childIds.map((c) => ({ id: `u_${c}`, primaryId: c, spouseId: null, childIds: [], generation: 0, spouseGenOffset: 0 })),
    ]
    const personToUnit = new Map([["parent", "u_parent"], ...childIds.map((c) => [c, `u_${c}`] as [string, string])])
    const branchSides = new Map<string, BranchSide>(
      [...personToUnit.keys()].map((k) => [k, "neutral" as BranchSide])
    )
    const result = layoutByLanes(units, personToUnit, { branchSides, useLanes: false })
    // Verify all 8 children are at the same Y.
    const ys = childIds.map((c) => result.positions.get(`u_${c}`)?.y)
    expect(new Set(ys).size).toBe(1)
    // Verify siblings are flagged as compact = false (count is 7-11, so tight gap but not compact).
    const compactFlags = childIds.map((c) => result.positions.get(`u_${c}`)?.compact)
    expect(compactFlags.every((f) => f === false)).toBe(true)
  })

  it("flags compact tile for 12+ siblings", () => {
    const childIds = Array.from({ length: 13 }, (_, i) => `c${i}`)
    const units: FamilyUnit[] = [
      { id: "u_parent", primaryId: "parent", spouseId: null, childIds, generation: 0, spouseGenOffset: 0 },
      ...childIds.map((c) => ({ id: `u_${c}`, primaryId: c, spouseId: null, childIds: [], generation: 0, spouseGenOffset: 0 })),
    ]
    const personToUnit = new Map([["parent", "u_parent"], ...childIds.map((c) => [c, `u_${c}`] as [string, string])])
    const branchSides = new Map<string, BranchSide>(
      [...personToUnit.keys()].map((k) => [k, "neutral" as BranchSide])
    )
    const result = layoutByLanes(units, personToUnit, { branchSides, useLanes: false })
    const compactFlags = childIds.map((c) => result.positions.get(`u_${c}`)?.compact)
    expect(compactFlags.every((f) => f === true)).toBe(true)
  })

  it("with lanes enabled, paternal units have x < 0 and maternal have x > 0", () => {
    // focus + paternal grandfather + paternal grandmother + maternal grandfather + maternal grandmother + dad + mom
    const units: FamilyUnit[] = [
      { id: "u_pg", primaryId: "pgf", spouseId: "pgm", childIds: ["dad"], generation: 0, spouseGenOffset: 0 },
      { id: "u_mg", primaryId: "mgf", spouseId: "mgm", childIds: ["mom"], generation: 0, spouseGenOffset: 0 },
      { id: "u_p",  primaryId: "dad", spouseId: "mom", childIds: ["focus"], generation: 1, spouseGenOffset: 0 },
      { id: "u_f",  primaryId: "focus", spouseId: null, childIds: [], generation: 2, spouseGenOffset: 0 },
    ]
    const personToUnit = new Map([
      ["pgf", "u_pg"], ["pgm", "u_pg"],
      ["mgf", "u_mg"], ["mgm", "u_mg"],
      ["dad", "u_p"], ["mom", "u_p"],
      ["focus", "u_f"],
    ])
    const branchSides = new Map<string, BranchSide>([
      ["pgf", "paternal"], ["pgm", "paternal"],
      ["mgf", "maternal"], ["mgm", "maternal"],
      ["dad", "paternal"], ["mom", "maternal"],
      ["focus", "self"],
    ])
    const result = layoutByLanes(units, personToUnit, { branchSides, useLanes: true })
    expect(result.positions.get("u_pg")!.x).toBeLessThan(0)
    expect(result.positions.get("u_mg")!.x).toBeGreaterThan(0)
    // Focus is at center (within the lane center column).
    expect(Math.abs(result.positions.get("u_f")!.x)).toBeLessThan(100)
  })
})

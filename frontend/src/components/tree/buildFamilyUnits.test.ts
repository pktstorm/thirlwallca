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

describe("buildFamilyUnits — multi-marriage support", () => {
  it("emits separate couple units for a person with two marriages", () => {
    // Thomas marries Emma (children: Edmund, Effie); Thomas marries Agnes (children: Agnes2, Francis)
    const nodes = [
      person("thomas", "male"),
      person("emma", "female"),
      person("agnes", "female"),
      person("edmund"),
      person("effie"),
      person("agnes2"),
      person("francis"),
    ]
    const edges = [
      spouseEdge("thomas", "emma"),
      pcEdge("thomas", "edmund"), pcEdge("emma", "edmund"),
      pcEdge("thomas", "effie"), pcEdge("emma", "effie"),
      spouseEdge("thomas", "agnes"),
      pcEdge("thomas", "agnes2"), pcEdge("agnes", "agnes2"),
      pcEdge("thomas", "francis"), pcEdge("agnes", "francis"),
    ]
    const { units } = buildFamilyUnits(nodes, edges)
    // Expect 2 couple units: Thomas+Emma and Thomas+Agnes.
    const coupleUnits = units.filter((u) => u.spouseId !== null)
    expect(coupleUnits).toHaveLength(2)
    const thomasEmma = coupleUnits.find(
      (u) => (u.primaryId === "thomas" && u.spouseId === "emma") ||
             (u.primaryId === "emma" && u.spouseId === "thomas"),
    )
    const thomasAgnes = coupleUnits.find(
      (u) => (u.primaryId === "thomas" && u.spouseId === "agnes") ||
             (u.primaryId === "agnes" && u.spouseId === "thomas"),
    )
    expect(thomasEmma).toBeDefined()
    expect(thomasAgnes).toBeDefined()
    // Children correctly attributed
    expect(new Set(thomasEmma!.childIds)).toEqual(new Set(["edmund", "effie"]))
    expect(new Set(thomasAgnes!.childIds)).toEqual(new Set(["agnes2", "francis"]))
  })

  it("does not produce a solo unit for the second spouse who has children with the multi-married partner", () => {
    // Same setup as above. Agnes shouldn't be a separate solo unit — she's the spouse in Thomas+Agnes.
    const nodes = [
      person("thomas", "male"),
      person("emma", "female"),
      person("agnes", "female"),
      person("agnes2"),
    ]
    const edges = [
      spouseEdge("thomas", "emma"),
      spouseEdge("thomas", "agnes"),
      pcEdge("thomas", "agnes2"), pcEdge("agnes", "agnes2"),
    ]
    const { units } = buildFamilyUnits(nodes, edges)
    // Agnes should appear as the spouse of a couple unit, NOT as a standalone solo unit.
    const agnesAsSolo = units.find((u) => u.primaryId === "agnes" && u.spouseId === null)
    expect(agnesAsSolo).toBeUndefined()
    const agnesAsSpouse = units.find(
      (u) => (u.primaryId === "agnes" && u.spouseId === "thomas") ||
             (u.spouseId === "agnes" && u.primaryId === "thomas"),
    )
    expect(agnesAsSpouse).toBeDefined()
  })

  it("personToUnit returns the first marriage's unit for a multi-married person", () => {
    // Order matters: Thomas+Emma is added first, so personToUnit[thomas] points to that.
    const nodes = [
      person("thomas", "male"),
      person("emma", "female"),
      person("agnes", "female"),
    ]
    const edges = [
      spouseEdge("thomas", "emma"),
      spouseEdge("thomas", "agnes"),
    ]
    const { units, personToUnit } = buildFamilyUnits(nodes, edges)
    const thomasUnitId = personToUnit.get("thomas")
    expect(thomasUnitId).toBeDefined()
    const thomasUnit = units.find((u) => u.id === thomasUnitId)
    // Emma is the spouse in Thomas's first marriage.
    expect(thomasUnit?.spouseId).toBe("emma")
  })

  it("a child with both parents in a couple is attributed to that couple, not separately", () => {
    const nodes = [person("dad", "male"), person("mom", "female"), person("kid")]
    const edges = [
      spouseEdge("dad", "mom"),
      pcEdge("dad", "kid"), pcEdge("mom", "kid"),
    ]
    const { units, personToUnit } = buildFamilyUnits(nodes, edges)
    const couple = units.find((u) => u.spouseId !== null)
    expect(couple?.childIds).toEqual(["kid"])
    // The kid should still be a unit in the output (so they can be a primary of their own future couple),
    // but they shouldn't be DUPLICATED.
    const kidUnits = units.filter((u) => u.primaryId === "kid")
    expect(kidUnits.length).toBeLessThanOrEqual(1)
    // personToUnit for the kid points to a unit (the couple's unit, since they're a child there;
    // OR their own solo unit — both are acceptable).
    expect(personToUnit.has("kid")).toBe(true)
  })

  it("a child with only one recorded parent appears in that parent's solo unit", () => {
    const nodes = [person("mom", "female"), person("kid")]
    const edges = [pcEdge("mom", "kid")]
    const { units } = buildFamilyUnits(nodes, edges)
    const momUnit = units.find((u) => u.primaryId === "mom")
    expect(momUnit).toBeDefined()
    expect(momUnit!.childIds).toContain("kid")
  })
})

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

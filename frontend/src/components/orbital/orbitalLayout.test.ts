import { describe, it, expect } from "vitest"
import { computeOrbitalLayout } from "./orbitalLayout"
import type { OrbitData, ControlOptions } from "./orbitalTypes"

const baseOptions: ControlOptions = {
  ancestorDepth: 4,
  descendantDepth: 3,
  showSpouses: false,
  showPhotos: true,
  highlightDirectLine: false,
  livingDeceasedStyling: false,
  labelDensity: "names",
  showSiblings: false,
  colorByBranch: false,
  recenterOnSingleClick: false,
}

function person(id: string, sex: "male" | "female" | null = null): any {
  return {
    id, givenName: id, surname: null, birthYear: null, deathYear: null,
    isLiving: true, photoUrl: null, sex,
  }
}

describe("computeOrbitalLayout — focus only", () => {
  it("places focus at origin", () => {
    const data: OrbitData = {
      focus: person("focus"),
      ancestorsByGeneration: [],
      descendants: [],
      siblings: [],
      spouses: [],
    }
    const result = computeOrbitalLayout(data, baseOptions, { width: 800, height: 600 })
    const focusSlot = result.slots.find((s) => s.personId === "focus")!
    expect(focusSlot).toBeDefined()
    expect(focusSlot.x).toBeCloseTo(0)
    expect(focusSlot.y).toBeCloseTo(0)
    expect(focusSlot.ring).toBe(0)
  })
})

describe("computeOrbitalLayout — ancestors", () => {
  it("places father at center of left half (top hemisphere), mother at center of right half", () => {
    const data: OrbitData = {
      focus: person("focus"),
      ancestorsByGeneration: [[
        { ...person("dad", "male"), parentSlot: "father", parentId: "focus" },
        { ...person("mom", "female"), parentSlot: "mother", parentId: "focus" },
      ]],
      descendants: [], siblings: [], spouses: [],
    }
    const result = computeOrbitalLayout(data, baseOptions, { width: 800, height: 600 })
    const dad = result.slots.find((s) => s.personId === "dad")!
    const mom = result.slots.find((s) => s.personId === "mom")!
    // Top hemisphere = π..2π. Father owns [π, 3π/2] (left half), centered at 5π/4.
    // Mother owns [3π/2, 2π] (right half), centered at 7π/4.
    expect(dad.angle).toBeCloseTo((5 * Math.PI) / 4)
    expect(mom.angle).toBeCloseTo((7 * Math.PI) / 4)
    // Dad's x < 0, y < 0 (upper-left in math coords; we'll rely on screen-flip later)
    expect(dad.x).toBeLessThan(0)
    expect(mom.x).toBeGreaterThan(0)
    expect(dad.branchKey).toBe("paternal")
    expect(mom.branchKey).toBe("maternal")
  })

  it("recursively partitions: paternal grandfather sits in the left half of the father's wedge", () => {
    const data: OrbitData = {
      focus: person("focus"),
      ancestorsByGeneration: [
        [
          { ...person("dad", "male"), parentSlot: "father", parentId: "focus" },
          { ...person("mom", "female"), parentSlot: "mother", parentId: "focus" },
        ],
        [
          { ...person("pgf", "male"), parentSlot: "father", parentId: "dad" },
          { ...person("pgm", "female"), parentSlot: "mother", parentId: "dad" },
          { ...person("mgf", "male"), parentSlot: "father", parentId: "mom" },
          { ...person("mgm", "female"), parentSlot: "mother", parentId: "mom" },
        ],
      ],
      descendants: [], siblings: [], spouses: [],
    }
    const result = computeOrbitalLayout(data, baseOptions, { width: 800, height: 600 })
    // Father's wedge is [π, 3π/2]. Father's father (pgf) takes the left half [π, 5π/4], centered at 9π/8.
    const pgf = result.slots.find((s) => s.personId === "pgf")!
    expect(pgf.angle).toBeCloseTo((9 * Math.PI) / 8)
    expect(pgf.branchKey).toBe("paternal")
    // Mother's mother (mgm) is in the rightmost wedge [7π/4, 2π], centered at 15π/8.
    const mgm = result.slots.find((s) => s.personId === "mgm")!
    expect(mgm.angle).toBeCloseTo((15 * Math.PI) / 8)
    expect(mgm.branchKey).toBe("maternal")
  })

  it("preserves wedge alignment when an ancestor is missing", () => {
    // Same structure as above but mom has no parents.
    const data: OrbitData = {
      focus: person("focus"),
      ancestorsByGeneration: [
        [
          { ...person("dad", "male"), parentSlot: "father", parentId: "focus" },
          { ...person("mom", "female"), parentSlot: "mother", parentId: "focus" },
        ],
        [
          { ...person("pgf", "male"), parentSlot: "father", parentId: "dad" },
          { ...person("pgm", "female"), parentSlot: "mother", parentId: "dad" },
        ],
      ],
      descendants: [], siblings: [], spouses: [],
    }
    const result = computeOrbitalLayout(data, baseOptions, { width: 800, height: 600 })
    const pgf = result.slots.find((s) => s.personId === "pgf")!
    expect(pgf.angle).toBeCloseTo((9 * Math.PI) / 8) // unchanged from previous test
  })
})

describe("computeOrbitalLayout — descendants", () => {
  it("places single child at center of bottom hemisphere (π/2)", () => {
    const data: OrbitData = {
      focus: person("focus"),
      ancestorsByGeneration: [],
      descendants: [
        { ...person("c1"), parentId: "focus", children: [] },
      ],
      siblings: [], spouses: [],
    }
    const result = computeOrbitalLayout(data, baseOptions, { width: 800, height: 600 })
    const c1 = result.slots.find((s) => s.personId === "c1")!
    expect(c1.angle).toBeCloseTo(Math.PI / 2)
    expect(c1.branchKey).toBe("descendant")
    expect(c1.ring).toBe(-1)
  })

  it("divides hemisphere proportionally by subtree leaf count", () => {
    // c1 has 3 leaves (one child with 3 grandchildren)
    // c2 has 1 leaf (no children)
    // Total leaves = 4. c1 gets 3/4 of the bottom hemisphere [0, 3π/4]. c2 gets [3π/4, π].
    const data: OrbitData = {
      focus: person("focus"),
      ancestorsByGeneration: [],
      descendants: [
        {
          ...person("c1"), parentId: "focus", children: [
            {
              ...person("gc1"), parentId: "c1", children: [
                { ...person("ggc1"), parentId: "gc1", children: [] },
                { ...person("ggc2"), parentId: "gc1", children: [] },
                { ...person("ggc3"), parentId: "gc1", children: [] },
              ],
            },
          ],
        },
        { ...person("c2"), parentId: "focus", children: [] },
      ],
      siblings: [], spouses: [],
    }
    const result = computeOrbitalLayout(data, baseOptions, { width: 800, height: 600 })
    const c1 = result.slots.find((s) => s.personId === "c1")!
    const c2 = result.slots.find((s) => s.personId === "c2")!
    // c1 wedge = [0, 3π/4], center = 3π/8
    expect(c1.angle).toBeCloseTo((3 * Math.PI) / 8)
    // c2 wedge = [3π/4, π], center = 7π/8
    expect(c2.angle).toBeCloseTo((7 * Math.PI) / 8)
  })

  it("creates an edge from each descendant to its parent_id slot", () => {
    const data: OrbitData = {
      focus: person("focus"),
      ancestorsByGeneration: [],
      descendants: [
        {
          ...person("c1"), parentId: "focus", children: [
            { ...person("gc1"), parentId: "c1", children: [] },
          ],
        },
      ],
      siblings: [], spouses: [],
    }
    const result = computeOrbitalLayout(data, baseOptions, { width: 800, height: 600 })
    const edgeIds = result.edges.map((e) => e.id)
    expect(edgeIds).toContain("focus->c1")
    expect(edgeIds).toContain("c1->gc1")
    for (const e of result.edges.filter((e) => e.type === "descendant")) {
      expect(e.path.startsWith("M ")).toBe(true)
    }
  })
})

describe("computeOrbitalLayout — siblings", () => {
  it("places siblings on a small ring near focus when showSiblings is true", () => {
    const data: OrbitData = {
      focus: person("focus"),
      ancestorsByGeneration: [],
      descendants: [],
      siblings: [person("sib1"), person("sib2")],
      spouses: [],
    }
    const r = computeOrbitalLayout(data, { ...baseOptions, showSiblings: true }, { width: 800, height: 600 })
    const sibSlots = r.slots.filter((s) => s.isSibling)
    expect(sibSlots).toHaveLength(2)
    for (const s of sibSlots) {
      expect(Math.hypot(s.x, s.y)).toBeGreaterThan(0)
    }
  })

  it("does not place siblings when showSiblings is false", () => {
    const data: OrbitData = {
      focus: person("focus"),
      ancestorsByGeneration: [],
      descendants: [],
      siblings: [person("sib1")],
      spouses: [],
    }
    const r = computeOrbitalLayout(data, { ...baseOptions, showSiblings: false }, { width: 800, height: 600 })
    expect(r.slots.find((s) => s.personId === "sib1")).toBeUndefined()
  })
})

describe("computeOrbitalLayout — spouses", () => {
  it("places spouses radially offset from their partner when showSpouses is true", () => {
    const data: OrbitData = {
      focus: person("focus"),
      ancestorsByGeneration: [
        [{ ...person("dad", "male"), parentSlot: "father", parentId: "focus" }],
      ],
      descendants: [],
      siblings: [],
      spouses: [{ ...person("focusWife"), spouseOf: "focus" }, { ...person("dadWife"), spouseOf: "dad" }],
    }
    const r = computeOrbitalLayout(data, { ...baseOptions, showSpouses: true }, { width: 800, height: 600 })
    const fw = r.slots.find((s) => s.personId === "focusWife")!
    const dw = r.slots.find((s) => s.personId === "dadWife")!
    expect(fw.isSpouse).toBe(true)
    expect(dw.isSpouse).toBe(true)
    // Spouse-of-focus sits offset from origin
    expect(Math.hypot(fw.x, fw.y)).toBeGreaterThan(0)
    // Spouse-of-dad sits offset from dad's position
    const dad = r.slots.find((s) => s.personId === "dad")!
    expect(Math.hypot(dw.x - dad.x, dw.y - dad.y)).toBeGreaterThan(0)
  })

  it("does not place spouses when showSpouses is false", () => {
    const data: OrbitData = {
      focus: person("focus"),
      ancestorsByGeneration: [],
      descendants: [],
      siblings: [],
      spouses: [{ ...person("w"), spouseOf: "focus" }],
    }
    const r = computeOrbitalLayout(data, { ...baseOptions, showSpouses: false }, { width: 800, height: 600 })
    expect(r.slots.find((s) => s.personId === "w")).toBeUndefined()
  })
})

describe("density mode", () => {
  it("flags ring as dense when slot arc < MIN_SLOT_ANGLE", () => {
    // 8 generations -> 256 ancestors at deepest ring; 180° / 256 ≈ 0.7° each, well below 5°.
    const gens: any[][] = []
    let prev: string[] = ["focus"]
    for (let g = 0; g < 8; g++) {
      const layer: any[] = []
      const next: string[] = []
      for (const parentId of prev) {
        const fid = `${parentId}-f-${g}`
        const mid = `${parentId}-m-${g}`
        layer.push({ ...person(fid, "male"), parentSlot: "father", parentId })
        layer.push({ ...person(mid, "female"), parentSlot: "mother", parentId })
        next.push(fid, mid)
      }
      gens.push(layer)
      prev = next
    }
    const data: OrbitData = {
      focus: person("focus"),
      ancestorsByGeneration: gens,
      descendants: [], siblings: [], spouses: [],
    }
    const result = computeOrbitalLayout(data, { ...baseOptions, ancestorDepth: 8 }, { width: 800, height: 600 })
    // The deepest ring (generation 8) should be marked dense.
    const deepRing = result.rings.find((r) => r.generation === 8)
    expect(deepRing?.dense).toBe(true)
    // The first ring (parents) should NOT be dense.
    const firstRing = result.rings.find((r) => r.generation === 1)
    expect(firstRing?.dense).toBeFalsy()
  })
})

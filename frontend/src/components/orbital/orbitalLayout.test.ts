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

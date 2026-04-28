import { describe, it, expect } from "vitest"
import { classifyBranchSides } from "./branchSide"
import type { ApiTreeEdge } from "./FamilyTreeCanvas"

function pcEdge(parent: string, child: string): ApiTreeEdge {
  return { id: `${parent}-${child}`, source: parent, target: child, type: "parent_child" }
}

function spouseEdge(a: string, b: string): ApiTreeEdge {
  return { id: `${a}-${b}-sp`, source: a, target: b, type: "spouse" }
}

describe("classifyBranchSides", () => {
  it("returns all 'neutral' when focusPersonId is null", () => {
    const edges = [pcEdge("dad", "focus"), pcEdge("mom", "focus"), spouseEdge("dad", "mom")]
    const result = classifyBranchSides(edges, null)
    expect(result.get("focus")).toBe("neutral")
    expect(result.get("dad")).toBe("neutral")
    expect(result.get("mom")).toBe("neutral")
  })

  it("classifies a 3-generation pedigree", () => {
    // focus has father (dad), mother (mom). dad has father (pgf) and mother (pgm). mom has father (mgf) and mother (mgm).
    const edges = [
      pcEdge("dad", "focus"), pcEdge("mom", "focus"),
      pcEdge("pgf", "dad"), pcEdge("pgm", "dad"),
      pcEdge("mgf", "mom"), pcEdge("mgm", "mom"),
      spouseEdge("dad", "mom"), spouseEdge("pgf", "pgm"), spouseEdge("mgf", "mgm"),
    ]
    const result = classifyBranchSides(edges, "focus", { fatherId: "dad", motherId: "mom" })
    expect(result.get("focus")).toBe("self")
    expect(result.get("dad")).toBe("paternal")
    expect(result.get("mom")).toBe("maternal")
    expect(result.get("pgf")).toBe("paternal")
    expect(result.get("pgm")).toBe("paternal")
    expect(result.get("mgf")).toBe("maternal")
    expect(result.get("mgm")).toBe("maternal")
  })

  it("classifies descendants of focus as 'descendant'", () => {
    const edges = [pcEdge("focus", "child"), pcEdge("child", "grandchild")]
    const result = classifyBranchSides(edges, "focus")
    expect(result.get("focus")).toBe("self")
    expect(result.get("child")).toBe("descendant")
    expect(result.get("grandchild")).toBe("descendant")
  })

  it("classifies sibling of focus as 'neutral'", () => {
    // focus and sib share parent 'dad'
    const edges = [pcEdge("dad", "focus"), pcEdge("dad", "sib")]
    const result = classifyBranchSides(edges, "focus", { fatherId: "dad" })
    expect(result.get("focus")).toBe("self")
    expect(result.get("dad")).toBe("paternal")
    expect(result.get("sib")).toBe("neutral")
  })

  it("classifies focus's spouse and spouse's parents as neutral", () => {
    const edges = [
      spouseEdge("focus", "spouse"),
      pcEdge("inlawDad", "spouse"),
    ]
    const result = classifyBranchSides(edges, "focus")
    expect(result.get("focus")).toBe("self")
    expect(result.get("spouse")).toBe("neutral")
    expect(result.get("inlawDad")).toBe("neutral")
  })

  it("when only one parent is known (only fatherId hint), classifies that side", () => {
    const edges = [pcEdge("dad", "focus"), pcEdge("pgf", "dad")]
    const result = classifyBranchSides(edges, "focus", { fatherId: "dad" })
    expect(result.get("dad")).toBe("paternal")
    expect(result.get("pgf")).toBe("paternal")
  })

  it("falls back to inferring father/mother by sex if hint not provided", () => {
    // Without explicit fatherId/motherId hint, the classifier infers from gender via getGender callback.
    const edges = [pcEdge("dad", "focus"), pcEdge("mom", "focus")]
    const getGender = (id: string) => (id === "dad" ? "male" : id === "mom" ? "female" : null)
    const result = classifyBranchSides(edges, "focus", { getGender })
    expect(result.get("dad")).toBe("paternal")
    expect(result.get("mom")).toBe("maternal")
  })

  it("when both parents have unknown sex and no hint, marks them as paternal/maternal arbitrarily but consistently", () => {
    // Deterministic tiebreaker: alphabetical first parent → paternal, second → maternal.
    const edges = [pcEdge("p1", "focus"), pcEdge("p2", "focus")]
    const result = classifyBranchSides(edges, "focus")
    // p1 < p2 alphabetically → p1 paternal
    expect(result.get("p1")).toBe("paternal")
    expect(result.get("p2")).toBe("maternal")
  })
})

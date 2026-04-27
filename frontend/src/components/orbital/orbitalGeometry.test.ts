import { describe, it, expect } from "vitest"
import {
  polarToCartesian,
  ringRadius,
  arcPath,
  radialArcPath,
} from "./orbitalGeometry"
import { ORBITAL_R0 } from "./orbitalConstants"

describe("polarToCartesian", () => {
  it("converts (r=10, θ=0) to (10, 0)", () => {
    const { x, y } = polarToCartesian(10, 0)
    expect(x).toBeCloseTo(10)
    expect(y).toBeCloseTo(0)
  })
  it("converts (r=10, θ=π/2) to (0, 10)", () => {
    const { x, y } = polarToCartesian(10, Math.PI / 2)
    expect(x).toBeCloseTo(0)
    expect(y).toBeCloseTo(10)
  })
  it("converts (r=10, θ=π) to (-10, 0)", () => {
    const { x, y } = polarToCartesian(10, Math.PI)
    expect(x).toBeCloseTo(-10)
    expect(y).toBeCloseTo(0)
  })
})

describe("ringRadius", () => {
  it("generation 0 = 0", () => {
    expect(ringRadius(0)).toBe(0)
  })
  it("generation 1 = R0", () => {
    expect(ringRadius(1)).toBe(ORBITAL_R0)
  })
  it("generation 2 > generation 1, but step is smaller (logarithmic decay)", () => {
    const r1 = ringRadius(1)
    const r2 = ringRadius(2)
    const r3 = ringRadius(3)
    expect(r2).toBeGreaterThan(r1)
    expect(r3).toBeGreaterThan(r2)
    expect(r3 - r2).toBeLessThan(r2 - r1)
  })
  it("treats negative generations symmetrically", () => {
    expect(ringRadius(-2)).toBe(ringRadius(2))
  })
})

describe("arcPath", () => {
  it("returns empty string when start == end", () => {
    expect(arcPath(50, 0, 0)).toBe("")
  })
  it("constructs valid SVG arc path between two angles", () => {
    const path = arcPath(50, 0, Math.PI / 2)
    // Should start with "M 50 0" then "A 50 50 0 ..."
    expect(path).toMatch(/^M /)
    expect(path).toContain(" A 50 50 0 ")
  })
})

describe("radialArcPath", () => {
  it("connects parent on inner ring to child on outer ring via spoke + arc", () => {
    // Parent at (r=50, θ=0), child at (r=100, θ=π/4).
    // Expected: M 50 0 (parent) L 100 0 (radial out) A 100 100 0 0 sweep child.x child.y
    const path = radialArcPath(50, 0, 100, Math.PI / 4)
    expect(path.startsWith("M ")).toBe(true)
    expect(path).toContain("L ")
    expect(path).toContain("A 100 100 0 ")
  })
})

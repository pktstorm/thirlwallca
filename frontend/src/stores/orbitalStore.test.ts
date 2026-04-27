import { describe, it, expect, beforeEach, vi } from "vitest"

describe("orbitalStore", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it("has expected defaults", async () => {
    const { useOrbitalStore } = await import("./orbitalStore")
    const s = useOrbitalStore.getState()
    expect(s.showSiblings).toBe(false)
    expect(s.colorByBranch).toBe(false)
    expect(s.recenterOnSingleClick).toBe(false)
  })

  it("persists changes", async () => {
    const { useOrbitalStore } = await import("./orbitalStore")
    useOrbitalStore.getState().setColorByBranch(true)
    const raw = localStorage.getItem("orbitalOptions")
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.colorByBranch).toBe(true)
  })
})

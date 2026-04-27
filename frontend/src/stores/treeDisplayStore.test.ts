import { describe, it, expect, beforeEach, vi } from "vitest"

describe("treeDisplayStore", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it("has expected defaults", async () => {
    const { useTreeDisplayStore } = await import("./treeDisplayStore")
    const s = useTreeDisplayStore.getState()
    expect(s.ancestorDepth).toBe(4)
    expect(s.descendantDepth).toBe(3)
    expect(s.showSpouses).toBe(false)
    expect(s.showPhotos).toBe(true)
    expect(s.highlightDirectLine).toBe(false)
    expect(s.livingDeceasedStyling).toBe(false)
    expect(s.labelDensity).toBe("names")
  })

  it("clamps depth to 1..10", async () => {
    const { useTreeDisplayStore } = await import("./treeDisplayStore")
    useTreeDisplayStore.getState().setAncestorDepth(99)
    expect(useTreeDisplayStore.getState().ancestorDepth).toBe(10)
    useTreeDisplayStore.getState().setAncestorDepth(0)
    expect(useTreeDisplayStore.getState().ancestorDepth).toBe(1)
  })

  it("persists to localStorage under key treeDisplayOptions", async () => {
    const { useTreeDisplayStore } = await import("./treeDisplayStore")
    useTreeDisplayStore.getState().setShowSpouses(true)
    const raw = localStorage.getItem("treeDisplayOptions")
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.showSpouses).toBe(true)
  })
})

import { describe, it, expect, beforeEach, vi } from "vitest"

describe("treeStore — orbital mode", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it("accepts 'orbital' as a TreeViewMode and persists it", async () => {
    const { useTreeStore } = await import("./treeStore")
    useTreeStore.getState().setTreeViewMode("orbital")
    expect(useTreeStore.getState().treeViewMode).toBe("orbital")
    expect(localStorage.getItem("treeViewMode")).toBe("orbital")
  })

  it("reads 'orbital' from localStorage on init", async () => {
    localStorage.setItem("treeViewMode", "orbital")
    vi.resetModules()
    const { useTreeStore } = await import("./treeStore")
    expect(useTreeStore.getState().treeViewMode).toBe("orbital")
  })
})

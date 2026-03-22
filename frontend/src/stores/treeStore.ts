import { create } from "zustand"

export type TreeViewMode = "branch" | "full-tree"

interface TreeState {
  focusedPersonId: string | null
  viewport: { x: number; y: number; zoom: number }
  timeFilter: { from: number; to: number } | null
  centerOnPerson: ((personId: string) => void) | null
  treeViewMode: TreeViewMode
  branchPersonId: string | null
  pendingCenterPersonId: string | null
  /** IDs of nodes that are at the boundary and can be expanded */
  expandableNodeIds: Set<string>
  /** IDs of nodes that have been expanded (to avoid re-fetching) */
  expandedNodeIds: Set<string>
  setFocusedPerson: (id: string | null) => void
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void
  setTimeFilter: (from: number, to: number) => void
  clearTimeFilter: () => void
  setCenterOnPerson: (fn: ((personId: string) => void) | null) => void
  setTreeViewMode: (mode: TreeViewMode) => void
  setBranchPersonId: (id: string | null) => void
  setPendingCenterPersonId: (id: string | null) => void
  setExpandableNodeIds: (ids: Set<string>) => void
  markNodeExpanded: (id: string) => void
  resetExpansion: () => void
}

function getInitialTreeViewMode(): TreeViewMode {
  try {
    const stored = localStorage.getItem("treeViewMode")
    if (stored === "branch" || stored === "full-tree") return stored
    if (stored === "my-branch") return "branch"
  } catch {
    // localStorage unavailable
  }
  return "branch"
}

export const useTreeStore = create<TreeState>((set) => ({
  focusedPersonId: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  timeFilter: null,
  centerOnPerson: null,
  treeViewMode: getInitialTreeViewMode(),
  branchPersonId: null,
  pendingCenterPersonId: null,
  expandableNodeIds: new Set(),
  expandedNodeIds: new Set(),
  setFocusedPerson: (id) => set({ focusedPersonId: id }),
  setViewport: (viewport) => set({ viewport }),
  setTimeFilter: (from, to) => set({ timeFilter: { from, to } }),
  clearTimeFilter: () => set({ timeFilter: null }),
  setCenterOnPerson: (fn) => set({ centerOnPerson: fn }),
  setTreeViewMode: (mode) => {
    try {
      localStorage.setItem("treeViewMode", mode)
    } catch {
      // localStorage unavailable
    }
    set({ treeViewMode: mode, expandableNodeIds: new Set(), expandedNodeIds: new Set() })
  },
  setBranchPersonId: (id) => set({ branchPersonId: id }),
  setPendingCenterPersonId: (id) => set({ pendingCenterPersonId: id }),
  setExpandableNodeIds: (ids) => set({ expandableNodeIds: ids }),
  markNodeExpanded: (id) =>
    set((s) => {
      const next = new Set(s.expandedNodeIds)
      next.add(id)
      return { expandedNodeIds: next }
    }),
  resetExpansion: () => set({ expandableNodeIds: new Set(), expandedNodeIds: new Set() }),
}))

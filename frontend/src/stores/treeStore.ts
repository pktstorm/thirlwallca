import { create } from "zustand"

interface TreeState {
  focusedPersonId: string | null
  viewport: { x: number; y: number; zoom: number }
  timeFilter: { from: number; to: number } | null
  centerOnPerson: ((personId: string) => void) | null
  setFocusedPerson: (id: string | null) => void
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void
  setTimeFilter: (from: number, to: number) => void
  clearTimeFilter: () => void
  setCenterOnPerson: (fn: ((personId: string) => void) | null) => void
}

export const useTreeStore = create<TreeState>((set) => ({
  focusedPersonId: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  timeFilter: null,
  centerOnPerson: null,
  setFocusedPerson: (id) => set({ focusedPersonId: id }),
  setViewport: (viewport) => set({ viewport }),
  setTimeFilter: (from, to) => set({ timeFilter: { from, to } }),
  clearTimeFilter: () => set({ timeFilter: null }),
  setCenterOnPerson: (fn) => set({ centerOnPerson: fn }),
}))

import { create } from "zustand"

interface MapState {
  yearRange: [number, number] | null
  selectedPersonIds: Set<string> | null
  showMigrations: boolean
  showBirths: boolean
  showDeaths: boolean
  showResidences: boolean
  personPanelOpen: boolean

  setYearRange: (range: [number, number] | null) => void
  togglePerson: (id: string) => void
  selectAllPersons: () => void
  deselectAllPersons: () => void
  setShowMigrations: (v: boolean) => void
  setShowBirths: (v: boolean) => void
  setShowDeaths: (v: boolean) => void
  setShowResidences: (v: boolean) => void
  setPersonPanelOpen: (v: boolean) => void
  resetFilters: () => void
}

export const useMapStore = create<MapState>((set) => ({
  yearRange: null,
  selectedPersonIds: null,
  showMigrations: true,
  showBirths: true,
  showDeaths: true,
  showResidences: true,
  personPanelOpen: false,

  setYearRange: (range) => set({ yearRange: range }),

  togglePerson: (id) =>
    set((state) => {
      const current = state.selectedPersonIds
      if (current === null) {
        // Switching from "all" to a specific selection — deselect this one person
        // But we don't know all IDs here, so instead: select only this person
        return { selectedPersonIds: new Set([id]) }
      }
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { selectedPersonIds: next.size === 0 ? next : next }
    }),

  selectAllPersons: () => set({ selectedPersonIds: null }),
  deselectAllPersons: () => set({ selectedPersonIds: new Set() }),

  setShowMigrations: (v) => set({ showMigrations: v }),
  setShowBirths: (v) => set({ showBirths: v }),
  setShowDeaths: (v) => set({ showDeaths: v }),
  setShowResidences: (v) => set({ showResidences: v }),
  setPersonPanelOpen: (v) => set({ personPanelOpen: v }),

  resetFilters: () =>
    set({
      yearRange: null,
      selectedPersonIds: null,
      showMigrations: true,
      showBirths: true,
      showDeaths: true,
      showResidences: true,
    }),
}))

import { create } from "zustand"

export type MapMode = "all" | "my-journey" | "ancestor-trail"

interface MapState {
  yearRange: [number, number] | null
  selectedPersonIds: Set<string> | null
  showMigrations: boolean
  showBirths: boolean
  showDeaths: boolean
  showResidences: boolean
  personPanelOpen: boolean
  /** Current map mode */
  mapMode: MapMode
  /** Person ID for journey/ancestor trail modes */
  focusPersonId: string | null
  /** Whether timeline playback is active */
  isPlaying: boolean
  /** Current playback year (when playing) */
  playbackYear: number | null

  setYearRange: (range: [number, number] | null) => void
  togglePerson: (id: string) => void
  selectAllPersons: () => void
  deselectAllPersons: () => void
  setShowMigrations: (v: boolean) => void
  setShowBirths: (v: boolean) => void
  setShowDeaths: (v: boolean) => void
  setShowResidences: (v: boolean) => void
  setPersonPanelOpen: (v: boolean) => void
  setMapMode: (mode: MapMode, personId?: string | null) => void
  setIsPlaying: (v: boolean) => void
  setPlaybackYear: (year: number | null) => void
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
  mapMode: "all",
  focusPersonId: null,
  isPlaying: false,
  playbackYear: null,

  setYearRange: (range) => set({ yearRange: range }),

  togglePerson: (id) =>
    set((state) => {
      const current = state.selectedPersonIds
      if (current === null) {
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

  setMapMode: (mode, personId = null) =>
    set({
      mapMode: mode,
      focusPersonId: personId ?? null,
      // Reset filters when changing modes
      selectedPersonIds: null,
      yearRange: null,
      isPlaying: false,
      playbackYear: null,
    }),

  setIsPlaying: (v) => set({ isPlaying: v }),
  setPlaybackYear: (year) => set({ playbackYear: year }),

  resetFilters: () =>
    set({
      yearRange: null,
      selectedPersonIds: null,
      showMigrations: true,
      showBirths: true,
      showDeaths: true,
      showResidences: true,
      mapMode: "all",
      focusPersonId: null,
      isPlaying: false,
      playbackYear: null,
    }),
}))

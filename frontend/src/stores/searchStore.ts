import { create } from "zustand"

interface SearchFilters {
  places: string[]
  eraFrom: number | null
  eraTo: number | null
  occupations: string[]
  relationshipType: string | null
}

interface SearchState {
  query: string
  filters: SearchFilters
  setQuery: (query: string) => void
  setFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void
  resetFilters: () => void
}

const defaultFilters: SearchFilters = {
  places: [],
  eraFrom: null,
  eraTo: null,
  occupations: [],
  relationshipType: null,
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  filters: { ...defaultFilters },
  setQuery: (query) => set({ query }),
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
}))

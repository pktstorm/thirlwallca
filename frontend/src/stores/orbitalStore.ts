import { create } from "zustand"

const STORAGE_KEY = "orbitalOptions"

interface OrbitalState {
  showSiblings: boolean
  colorByBranch: boolean
  recenterOnSingleClick: boolean
  setShowSiblings: (v: boolean) => void
  setColorByBranch: (v: boolean) => void
  setRecenterOnSingleClick: (v: boolean) => void
  reset: () => void
}

const DEFAULTS = {
  showSiblings: false,
  colorByBranch: false,
  recenterOnSingleClick: false,
}

function load(): typeof DEFAULTS {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

function persist(patch: Partial<typeof DEFAULTS>): void {
  try {
    const current = load()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...patch }))
  } catch {
    // ignore
  }
}

export const useOrbitalStore = create<OrbitalState>((set) => ({
  ...load(),
  setShowSiblings: (v) => { persist({ showSiblings: v }); set({ showSiblings: v }) },
  setColorByBranch: (v) => { persist({ colorByBranch: v }); set({ colorByBranch: v }) },
  setRecenterOnSingleClick: (v) => { persist({ recenterOnSingleClick: v }); set({ recenterOnSingleClick: v }) },
  reset: () => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    set(DEFAULTS)
  },
}))

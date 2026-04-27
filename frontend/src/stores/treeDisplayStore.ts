import { create } from "zustand"
import type { LabelDensity } from "../components/orbital/orbitalTypes"

const STORAGE_KEY = "treeDisplayOptions"

interface TreeDisplayState {
  ancestorDepth: number
  descendantDepth: number
  showSpouses: boolean
  showPhotos: boolean
  highlightDirectLine: boolean
  livingDeceasedStyling: boolean
  labelDensity: LabelDensity
  setAncestorDepth: (n: number) => void
  setDescendantDepth: (n: number) => void
  setShowSpouses: (v: boolean) => void
  setShowPhotos: (v: boolean) => void
  setHighlightDirectLine: (v: boolean) => void
  setLivingDeceasedStyling: (v: boolean) => void
  setLabelDensity: (v: LabelDensity) => void
  reset: () => void
}

const DEFAULTS = {
  ancestorDepth: 4,
  descendantDepth: 3,
  showSpouses: false,
  showPhotos: true,
  highlightDirectLine: false,
  livingDeceasedStyling: false,
  labelDensity: "names" as LabelDensity,
}

function clampDepth(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)))
}

function load(): typeof DEFAULTS {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return DEFAULTS
  }
}

function persist(state: Partial<typeof DEFAULTS>): void {
  try {
    const current = load()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...state }))
  } catch {
    // ignore
  }
}

export const useTreeDisplayStore = create<TreeDisplayState>((set) => {
  const initial = load()
  return {
    ...initial,
    setAncestorDepth: (n) => {
      const v = clampDepth(n)
      persist({ ancestorDepth: v })
      set({ ancestorDepth: v })
    },
    setDescendantDepth: (n) => {
      const v = clampDepth(n)
      persist({ descendantDepth: v })
      set({ descendantDepth: v })
    },
    setShowSpouses: (v) => { persist({ showSpouses: v }); set({ showSpouses: v }) },
    setShowPhotos: (v) => { persist({ showPhotos: v }); set({ showPhotos: v }) },
    setHighlightDirectLine: (v) => { persist({ highlightDirectLine: v }); set({ highlightDirectLine: v }) },
    setLivingDeceasedStyling: (v) => { persist({ livingDeceasedStyling: v }); set({ livingDeceasedStyling: v }) },
    setLabelDensity: (v) => { persist({ labelDensity: v }); set({ labelDensity: v }) },
    reset: () => {
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
      set(DEFAULTS)
    },
  }
})

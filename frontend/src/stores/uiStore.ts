import { create } from "zustand"

function getInitialTheme(): "light" | "dark" {
  const stored = localStorage.getItem("theme")
  if (stored === "dark" || stored === "light") return stored
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark")
  localStorage.setItem("theme", theme)
}

interface UiState {
  sidebarOpen: boolean
  detailPanelOpen: boolean
  theme: "light" | "dark"
  activeModal: string | null
  toggleSidebar: () => void
  toggleDetailPanel: () => void
  setTheme: (theme: "light" | "dark") => void
  openModal: (id: string) => void
  closeModal: () => void
}

const initialTheme = getInitialTheme()
applyTheme(initialTheme)

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  detailPanelOpen: false,
  theme: initialTheme,
  activeModal: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleDetailPanel: () => set((s) => ({ detailPanelOpen: !s.detailPanelOpen })),
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
}))

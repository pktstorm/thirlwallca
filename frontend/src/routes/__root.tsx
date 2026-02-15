import { useEffect } from "react"
import { createRootRoute, Outlet } from "@tanstack/react-router"
import { useUiStore } from "../stores/uiStore"
import { ErrorBoundary } from "../components/ErrorBoundary"
import { ToastContainer } from "../components/ui/Toast"

const THEME_KEY = "thirlwall-theme"

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)

  // On initial load, read saved theme or fallback to system preference
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as
      | "light"
      | "dark"
      | null
    if (saved) {
      setTheme(saved)
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark")
    }
  }, [setTheme])

  // Apply the dark class and persist whenever theme changes
  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") {
      root.classList.add("dark")
      root.classList.remove("light")
    } else {
      root.classList.add("light")
      root.classList.remove("dark")
    }
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  return (
    <ErrorBoundary>
      <Outlet />
      <ToastContainer />
    </ErrorBoundary>
  )
}

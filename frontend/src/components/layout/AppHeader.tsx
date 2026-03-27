import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Menu, Search, LogOut, Sun, Moon, UserCircle, TreePine, Settings } from "lucide-react"
import { useAuthStore } from "../../stores/authStore"
import { useUiStore } from "../../stores/uiStore"
import { APP_NAME } from "../../lib/constants"

export function AppHeader({ hideSearch = false }: { hideSearch?: boolean } = {}) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const [searchQuery, setSearchQuery] = useState("")
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate({ to: "/search", search: { q: searchQuery.trim() } } as any)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate({ to: "/login" })
  }

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  return (
    <header className="absolute top-0 left-0 w-full z-40 pointer-events-none px-3 sm:px-4 py-2 sm:py-3 flex justify-between items-start">
      {/* Left: Logo + menu */}
      <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 bg-white/80 dark:bg-dark-card/80 backdrop-blur-md p-2 pr-3 sm:pr-4 rounded-xl shadow-sm border border-sage-200 dark:border-dark-border">
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-sage-100 dark:hover:bg-dark-surface rounded-lg text-earth-800 dark:text-dark-text"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/logo-small.png" alt="Thirlwall Family Crest" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
          <span className="hidden sm:inline font-bold text-lg text-earth-900 dark:text-dark-text tracking-tight">
            {APP_NAME}
          </span>
        </div>
      </div>

      {/* Center: Search */}
      {!hideSearch && (
        <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 top-3 w-full max-w-lg px-4 hidden sm:block">
          <form onSubmit={handleSearch} className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sage-300 dark:text-dark-text-muted group-focus-within:text-primary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ancestors..."
              className="block w-full pl-10 pr-4 py-2.5 border-0 bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-full shadow-lg text-earth-900 dark:text-dark-text placeholder-sage-300 dark:placeholder-dark-text-muted ring-1 ring-sage-200 dark:ring-dark-border focus:ring-2 focus:ring-primary focus:outline-none text-sm"
            />
          </form>
        </div>
      )}

      {/* Right: Theme toggle + User avatar */}
      <div className="pointer-events-auto relative flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/80 dark:bg-dark-surface backdrop-blur-md flex items-center justify-center shadow-lg hover:bg-sage-100 dark:hover:bg-sage-800 transition-colors text-earth-800 dark:text-dark-text"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </button>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary text-earth-900 flex items-center justify-center shadow-lg hover:bg-primary-dark transition-colors font-bold text-xs sm:text-sm"
        >
          {initials}
        </button>
        {showUserMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowUserMenu(false)}
            />
            <div className="absolute right-0 top-12 w-48 max-w-[calc(100vw-2rem)] bg-white dark:bg-dark-card rounded-xl shadow-xl border border-sage-200 dark:border-dark-border z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-sage-100 dark:border-dark-border">
                <p className="text-sm font-medium text-earth-900 dark:text-dark-text truncate">
                  {user?.displayName}
                </p>
                <p className="text-xs text-sage-400 dark:text-dark-text-muted truncate">{user?.email}</p>
              </div>
              {user?.linkedPersonId && (
                <>
                  <button
                    onClick={() => {
                      setShowUserMenu(false)
                      navigate({ to: "/person/$personId", params: { personId: user.linkedPersonId! } } as any)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-earth-800 dark:text-dark-text hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors"
                  >
                    <UserCircle className="h-4 w-4 text-sage-400 dark:text-dark-text-muted" />
                    My Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowUserMenu(false)
                      navigate({ to: "/tree/$personId", params: { personId: user.linkedPersonId! } } as any)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-earth-800 dark:text-dark-text hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors"
                  >
                    <TreePine className="h-4 w-4 text-sage-400 dark:text-dark-text-muted" />
                    My Tree
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setShowUserMenu(false)
                  navigate({ to: "/settings" } as any)
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-earth-800 dark:text-dark-text hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors"
              >
                <Settings className="h-4 w-4 text-sage-400 dark:text-dark-text-muted" />
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

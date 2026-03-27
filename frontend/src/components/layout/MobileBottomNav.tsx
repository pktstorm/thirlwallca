import { useNavigate, useRouterState } from "@tanstack/react-router"
import { Home, TreePine, Globe, Search, Menu } from "lucide-react"
import { useUiStore } from "../../stores/uiStore"
import { cn } from "../../lib/utils"

const navItems = [
  { label: "Home", icon: Home, to: "/home" },
  { label: "Tree", icon: TreePine, to: "/tree" },
  { label: "Map", icon: Globe, to: "/map" },
  { label: "Search", icon: Search, to: "/search" },
] as const

export function MobileBottomNav() {
  const navigate = useNavigate()
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const isActive = (to: string) => currentPath === to || currentPath.startsWith(to + "/")

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white/95 dark:bg-dark-card/95 backdrop-blur-md border-t border-sage-200 dark:border-dark-border safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map(({ label, icon: Icon, to }) => {
          const active = isActive(to)
          return (
            <button
              key={to}
              onClick={() => navigate({ to } as any)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[56px]",
                active
                  ? "text-primary-dark dark:text-primary"
                  : "text-sage-400 dark:text-dark-text-muted",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-primary")} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          )
        })}
        {/* More button opens the sidebar */}
        <button
          onClick={toggleSidebar}
          className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors min-w-[56px] text-sage-400 dark:text-dark-text-muted"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
    </nav>
  )
}

import { useNavigate, useRouterState } from "@tanstack/react-router"
import {
  TreePine,
  Search,
  Map,
  Images,
  LogOut,
  UserCircle,
  Settings,
  Home,
  MessageCircle,
  FileSearch,
  Calendar,
  BookOpen,
  GitBranch,
  BarChart3,
  UtensilsCrossed,
  ShieldCheck,
} from "lucide-react"
import { useAuthStore } from "../../stores/authStore"
import { useUiStore } from "../../stores/uiStore"
import { APP_NAME } from "../../lib/constants"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../ui/sheet"
import { Separator } from "../ui/separator"

const mainNavItems = [
  { label: "Home", icon: Home, to: "/home" },
  { label: "Family Tree", icon: TreePine, to: "/tree" },
  { label: "Family Map", icon: Map, to: "/map" },
  { label: "Search People", icon: Search, to: "/search" },
] as const

const discoverNavItems = [
  { label: "How Related?", icon: GitBranch, to: "/related" },
  { label: "Family Calendar", icon: Calendar, to: "/calendar" },
  { label: "Ask the Family", icon: MessageCircle, to: "/questions" },
  { label: "Research Notes", icon: FileSearch, to: "/research" },
  { label: "Family Stories", icon: BookOpen, to: "/family-stories" },
  { label: "Statistics", icon: BarChart3, to: "/stats" },
  { label: "Recipes & Traditions", icon: UtensilsCrossed, to: "/traditions" },
  { label: "Media Gallery", icon: Images, to: "/media" },
] as const

export function NavSidebar() {
  const navigate = useNavigate()
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const handleNav = (to: string) => {
    navigate({ to } as any)
    toggleSidebar()
  }

  const handleLogout = async () => {
    toggleSidebar()
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

  const roleBadgeColor =
    user?.role === "admin"
      ? "bg-primary/20 text-primary-dark dark:text-primary"
      : user?.role === "editor"
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
        : "bg-sage-100 text-sage-800 dark:bg-dark-surface dark:text-dark-text-muted"

  const isActive = (to: string) => currentPath === to || currentPath.startsWith(to + "/")

  function NavButton({ label, icon: Icon, to }: { label: string; icon: typeof Home; to: string }) {
    const active = isActive(to)
    return (
      <button
        type="button"
        onClick={() => handleNav(to)}
        className={`
          w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
          transition-colors duration-150
          ${active
            ? "bg-primary/15 text-primary-dark dark:text-primary"
            : "text-earth-800 dark:text-dark-text hover:bg-sage-50 dark:hover:bg-dark-surface hover:text-earth-900 dark:hover:text-dark-text"
          }
        `}
      >
        <Icon className={`h-5 w-5 shrink-0 ${active ? "text-primary-dark dark:text-primary" : "text-sage-400 dark:text-dark-text-muted"}`} />
        {label}
        {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
      </button>
    )
  }

  return (
    <Sheet open={sidebarOpen} onOpenChange={toggleSidebar}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-72 sm:max-w-72 p-0 flex flex-col bg-white dark:bg-dark-card border-sage-200 dark:border-dark-border"
      >
        {/* Header */}
        <SheetHeader className="p-5 pb-4">
          <div className="flex items-center gap-3">
            <img src="/logo-small.png" alt="Thirlwall Family Crest" className="w-10 h-10 object-contain" />
            <div>
              <SheetTitle className="text-lg font-bold tracking-tight text-earth-900 dark:text-dark-text">
                {APP_NAME}
              </SheetTitle>
              <SheetDescription className="text-xs text-sage-400 dark:text-dark-text-muted">
                Explore your family history
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Separator className="bg-sage-200 dark:bg-dark-border" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {/* Main nav */}
          <ul className="space-y-1">
            {mainNavItems.map(({ label, icon, to }) => (
              <li key={to}><NavButton label={label} icon={icon} to={to} /></li>
            ))}
          </ul>

          {/* Discover section */}
          <div className="mt-5 mb-2 px-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-sage-300 dark:text-dark-text-muted/50">Discover</p>
          </div>
          <ul className="space-y-1">
            {discoverNavItems.map(({ label, icon, to }) => (
              <li key={to}><NavButton label={label} icon={icon} to={to} /></li>
            ))}
          </ul>

          {/* My Profile */}
          {user?.linkedPersonId && (
            <>
              <Separator className="my-3 bg-sage-200 dark:bg-dark-border" />
              <ul className="space-y-1">
                <li>
                  <NavButton label="My Profile" icon={UserCircle} to={`/person/${user.linkedPersonId}`} />
                </li>
              </ul>
            </>
          )}

          {/* Admin section */}
          {user?.role === "admin" && (
            <>
              <div className="mt-5 mb-2 px-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-sage-300 dark:text-dark-text-muted/50">Admin</p>
              </div>
              <ul className="space-y-1">
                <li>
                  <NavButton label="Administration" icon={ShieldCheck} to="/admin" />
                </li>
              </ul>
            </>
          )}
        </nav>

        {/* Settings */}
        <div className="px-3 pb-2">
          <NavButton label="Settings" icon={Settings} to="/settings" />
        </div>

        <Separator className="bg-sage-200 dark:bg-dark-border" />

        {/* Footer — user info */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary text-earth-900 flex items-center justify-center font-bold text-sm shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-earth-900 dark:text-dark-text truncate">
                {user?.displayName ?? "Loading..."}
              </p>
              <span
                className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${roleBadgeColor}`}
              >
                {user?.role ?? "..."}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-lg text-sage-400 dark:text-dark-text-muted hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

import { Navigation, GitBranch, Globe, Loader2 } from "lucide-react"
import { useMapStore, type MapMode } from "../../stores/mapStore"
import { useAuthStore } from "../../stores/authStore"
import { cn } from "../../lib/utils"

interface MapQuickActionsProps {
  isLoadingTrail?: boolean
}

export function MapQuickActions({ isLoadingTrail }: MapQuickActionsProps) {
  const linkedPersonId = useAuthStore((s) => s.user?.linkedPersonId)
  const mapMode = useMapStore((s) => s.mapMode)
  const setMapMode = useMapStore((s) => s.setMapMode)

  const buttons: { mode: MapMode; label: string; icon: typeof Globe; personId?: string | null; disabled?: boolean; tooltip?: string }[] = [
    {
      mode: "all",
      label: "Everyone",
      icon: Globe,
    },
    {
      mode: "my-journey",
      label: "My Journey",
      icon: Navigation,
      personId: linkedPersonId,
      disabled: !linkedPersonId,
      tooltip: !linkedPersonId ? "Link your profile to a person first" : undefined,
    },
    {
      mode: "ancestor-trail",
      label: "My Ancestors",
      icon: GitBranch,
      personId: linkedPersonId,
      disabled: !linkedPersonId,
      tooltip: !linkedPersonId ? "Link your profile to a person first" : undefined,
    },
  ]

  return (
    <div className="flex items-center bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-xl border border-sage-200 dark:border-dark-border shadow-lg overflow-hidden">
      {buttons.map((btn, i) => {
        const Icon = btn.icon
        const isActive = mapMode === btn.mode
        const isLoading = isLoadingTrail && isActive && btn.mode !== "all"

        return (
          <button
            key={btn.mode}
            onClick={() => setMapMode(btn.mode, btn.personId)}
            disabled={btn.disabled}
            title={btn.tooltip}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors",
              i > 0 && "border-l border-sage-200 dark:border-dark-border",
              isActive
                ? "bg-primary/10 text-primary-dark dark:text-primary"
                : "text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text",
              btn.disabled && "opacity-40 cursor-not-allowed",
            )}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{btn.label}</span>
          </button>
        )
      })}
    </div>
  )
}

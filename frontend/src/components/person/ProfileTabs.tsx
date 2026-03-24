import { cn } from "../../lib/utils"
import { BookOpen, Image, Info, Users } from "lucide-react"

export type ProfileTab = "overview" | "story" | "gallery" | "details"

interface ProfileTabsProps {
  activeTab: ProfileTab
  onTabChange: (tab: ProfileTab) => void
  storyCount: number
  mediaCount: number
}

const tabs: { id: ProfileTab; label: string; icon: typeof Info }[] = [
  { id: "overview", label: "Overview", icon: Users },
  { id: "story", label: "Story & Timeline", icon: BookOpen },
  { id: "gallery", label: "Gallery", icon: Image },
  { id: "details", label: "Details", icon: Info },
]

export function ProfileTabs({ activeTab, onTabChange, storyCount, mediaCount }: ProfileTabsProps) {
  return (
    <div className="sticky top-0 z-20 bg-sage-50/95 dark:bg-bg-dark/95 backdrop-blur-sm border-b border-sage-200 dark:border-dark-border">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <nav className="flex gap-0 overflow-x-auto" aria-label="Profile sections">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const badge =
              tab.id === "story" && storyCount > 0 ? storyCount :
              tab.id === "gallery" && mediaCount > 0 ? mediaCount :
              null

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-primary text-primary-dark dark:text-primary"
                    : "border-transparent text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text hover:border-sage-300",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {badge !== null && (
                  <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                    isActive ? "bg-primary/10 text-primary-dark" : "bg-sage-100 dark:bg-dark-surface text-sage-400",
                  )}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

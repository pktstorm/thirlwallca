import { Image, FileText, Video, Music, ArrowUpDown } from "lucide-react"
import type { MediaType } from "../../types/media"

export type MediaFilterType = MediaType | "all"
export type MediaSortOption = "chronological" | "date_added"

interface MediaFilterBarProps {
  activeFilter: MediaFilterType
  onFilterChange: (filter: MediaFilterType) => void
  sortBy: MediaSortOption
  onSortChange: (sort: MediaSortOption) => void
  counts: {
    all: number
    photo: number
    document: number
    video: number
    audio: number
  }
}

const filterTabs: {
  key: MediaFilterType
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { key: "all", label: "All Items", icon: Image },
  { key: "photo", label: "Photos", icon: Image },
  { key: "document", label: "Documents", icon: FileText },
  { key: "video", label: "Videos", icon: Video },
  { key: "audio", label: "Audio", icon: Music },
]

export function MediaFilterBar({
  activeFilter,
  onFilterChange,
  sortBy,
  onSortChange,
  counts,
}: MediaFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {filterTabs.map(({ key, label, icon: Icon }) => {
          const count = counts[key]
          const isActive = activeFilter === key
          return (
            <button
              key={key}
              onClick={() => onFilterChange(key)}
              className={
                isActive
                  ? "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-primary text-earth-900 shadow-sm transition-colors"
                  : "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white dark:bg-dark-card border border-sage-200 dark:border-dark-border text-sage-800 dark:text-dark-text hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors"
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              <span
                className={
                  isActive
                    ? "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-earth-900/20 text-xs font-semibold"
                    : "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-sage-100 dark:bg-dark-surface text-sage-800 dark:text-dark-text text-xs font-semibold"
                }
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Sort dropdown */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-sage-400 dark:text-dark-text-muted" />
          <select
            value={sortBy}
            onChange={(e) =>
              onSortChange(e.target.value as MediaSortOption)
            }
            className="appearance-none bg-white dark:bg-dark-card border border-sage-200 dark:border-dark-border rounded-lg pl-3 pr-8 py-2 text-sm text-earth-900 dark:text-dark-text hover:border-sage-300 dark:hover:border-dark-border focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
          >
            <option value="chronological">Chronological</option>
            <option value="date_added">Date Added</option>
          </select>
        </div>
      </div>
    </div>
  )
}

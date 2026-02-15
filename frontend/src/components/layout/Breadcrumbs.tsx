import { ChevronRight, Home } from "lucide-react"

export interface BreadcrumbItem {
  label: string
  onClick?: () => void
  active?: boolean
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  if (items.length === 0) return null

  return (
    <nav className="flex items-center text-xs sm:text-sm font-medium text-sage-400 dark:text-dark-text-muted bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-full border border-sage-200 dark:border-dark-border shadow-sm">
      <button className="hover:text-primary dark:hover:text-primary transition-colors flex items-center gap-1">
        <Home className="h-4 w-4" />
        <span>Roots</span>
      </button>
      {items.map((item, i) => (
        <span key={i} className="flex items-center">
          <ChevronRight className="h-4 w-4 text-sage-300 dark:text-dark-text-muted mx-1" />
          {item.active ? (
            <span className="text-earth-900 dark:text-dark-text font-bold flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded-md text-primary-dark max-w-[200px]">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block animate-pulse flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </span>
          ) : (
            <button
              onClick={item.onClick}
              className="hover:text-primary dark:hover:text-primary transition-colors max-w-[200px] truncate"
            >
              {item.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  )
}

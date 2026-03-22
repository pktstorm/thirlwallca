import { ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"

interface ExpandButtonProps {
  direction: "up" | "down"
  onClick: () => void
  loading?: boolean
}

export function ExpandButton({ direction, onClick, loading }: ExpandButtonProps) {
  const Icon = direction === "up" ? ChevronUp : ChevronDown

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      disabled={loading}
      className={cn(
        "absolute left-1/2 -translate-x-1/2 z-10",
        "flex items-center justify-center",
        "w-7 h-7 rounded-full",
        "bg-white dark:bg-dark-card",
        "border border-sage-200 dark:border-dark-border",
        "shadow-sm dark:shadow-none",
        "text-sage-400 dark:text-dark-text-muted",
        "hover:bg-primary/10 hover:border-primary hover:text-primary-dark dark:hover:text-primary",
        "transition-all duration-150",
        "cursor-pointer",
        direction === "up" ? "-top-4" : "-bottom-4",
        loading && "animate-pulse opacity-60",
      )}
      title={`Load ${direction === "up" ? "ancestors" : "descendants"}`}
    >
      {loading ? (
        <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
    </button>
  )
}

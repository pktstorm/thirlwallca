import { useCallback, useState } from "react"
import { Clock, ChevronDown } from "lucide-react"
import { useTreeStore } from "../../stores/treeStore"

interface GenerationFilterProps {
  minYear: number
  maxYear: number
}

const GENERATION_SPANS = [
  { label: "All Generations", from: 0, to: 9999 },
  { label: "Before 1900", from: 0, to: 1899 },
  { label: "1900\u20131930", from: 1900, to: 1930 },
  { label: "1930\u20131960", from: 1930, to: 1960 },
  { label: "1960\u20131990", from: 1960, to: 1990 },
  { label: "1990\u2013Present", from: 1990, to: 9999 },
]

export function GenerationFilter({ minYear, maxYear }: GenerationFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const timeFilter = useTreeStore((s) => s.timeFilter)
  const setTimeFilter = useTreeStore((s) => s.setTimeFilter)
  const clearTimeFilter = useTreeStore((s) => s.clearTimeFilter)

  const activeLabel = timeFilter
    ? GENERATION_SPANS.find((s) => s.from === timeFilter.from && s.to === timeFilter.to)?.label ?? `${timeFilter.from}\u2013${timeFilter.to}`
    : "All Generations"

  const handleSelect = useCallback(
    (span: typeof GENERATION_SPANS[0]) => {
      if (span.from === 0 && span.to === 9999) {
        clearTimeFilter()
      } else {
        setTimeFilter(
          Math.max(span.from, minYear),
          Math.min(span.to, maxYear),
        )
      }
      setIsOpen(false)
    },
    [minYear, maxYear, setTimeFilter, clearTimeFilter],
  )

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm rounded-xl border border-sage-200 dark:border-dark-border shadow-sm dark:shadow-black/20 px-3 py-2 text-xs font-medium text-earth-900 dark:text-dark-text"
      >
        <Clock className="w-3.5 h-3.5 text-sage-400 dark:text-dark-text-muted" />
        <span className="max-w-24 truncate">{activeLabel}</span>
        <ChevronDown className="w-3 h-3 text-sage-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <ul className="absolute bottom-full mb-1 left-0 z-50 bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-lg dark:shadow-black/30 py-1 min-w-[160px]">
            {GENERATION_SPANS.map((span) => (
              <li key={span.label}>
                <button
                  onClick={() => handleSelect(span)}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    activeLabel === span.label
                      ? "bg-primary/10 text-primary-dark dark:text-primary font-medium"
                      : "text-earth-900 dark:text-dark-text hover:bg-sage-50 dark:hover:bg-dark-surface"
                  }`}
                >
                  {span.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

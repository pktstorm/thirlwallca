import { useCallback, useEffect, useRef, useState } from "react"
import { X, Clock } from "lucide-react"
import { useTreeStore } from "../../stores/treeStore"

interface TimeSliderProps {
  /** Minimum year present in the tree data */
  minYear: number
  /** Maximum year present in the tree data */
  maxYear: number
}

export function TimeSlider({ minYear, maxYear }: TimeSliderProps) {
  const timeFilter = useTreeStore((s) => s.timeFilter)
  const setTimeFilter = useTreeStore((s) => s.setTimeFilter)
  const clearTimeFilter = useTreeStore((s) => s.clearTimeFilter)

  // Local state for smooth dragging before committing to the store
  const [localFrom, setLocalFrom] = useState(timeFilter?.from ?? minYear)
  const [localTo, setLocalTo] = useState(timeFilter?.to ?? maxYear)

  // Sync local state when store changes externally (e.g. clear)
  useEffect(() => {
    if (timeFilter) {
      setLocalFrom(timeFilter.from)
      setLocalTo(timeFilter.to)
    } else {
      setLocalFrom(minYear)
      setLocalTo(maxYear)
    }
  }, [timeFilter, minYear, maxYear])

  const commitFilter = useCallback(
    (from: number, to: number) => {
      // Only set the filter if the range is narrower than the full span
      if (from === minYear && to === maxYear) {
        clearTimeFilter()
      } else {
        setTimeFilter(from, to)
      }
    },
    [minYear, maxYear, setTimeFilter, clearTimeFilter],
  )

  const handleFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Math.min(Number(e.target.value), localTo)
      setLocalFrom(val)
      commitFilter(val, localTo)
    },
    [localTo, commitFilter],
  )

  const handleToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Math.max(Number(e.target.value), localFrom)
      setLocalTo(val)
      commitFilter(localFrom, val)
    },
    [localFrom, commitFilter],
  )

  const handleClear = useCallback(() => {
    clearTimeFilter()
  }, [clearTimeFilter])

  // Calculate percentages for the track fill
  const range = maxYear - minYear || 1
  const fromPercent = ((localFrom - minYear) / range) * 100
  const toPercent = ((localTo - minYear) / range) * 100

  const trackRef = useRef<HTMLDivElement>(null)

  // Don't render if there's no meaningful range
  if (maxYear - minYear < 2) return null

  return (
    <div className="flex items-center gap-3 bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm rounded-xl shadow-lg dark:shadow-black/20 border border-sage-200 dark:border-dark-border px-4 py-3">
      {/* Clock icon */}
      <Clock className="w-4 h-4 text-sage-400 dark:text-dark-text-muted shrink-0" />

      {/* Min year label */}
      <span className="text-xs text-sage-400 dark:text-dark-text-muted tabular-nums shrink-0 w-8 text-right">
        {minYear}
      </span>

      {/* Slider track */}
      <div className="relative w-56 h-8 flex items-center" ref={trackRef}>
        {/* Background track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-sage-100 dark:bg-dark-surface" />

        {/* Active range fill */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-primary"
          style={{
            left: `${fromPercent}%`,
            width: `${toPercent - fromPercent}%`,
          }}
        />

        {/* From range input */}
        <input
          type="range"
          min={minYear}
          max={maxYear}
          value={localFrom}
          onChange={handleFromChange}
          className="time-slider-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none z-10"
          style={{ zIndex: localFrom > minYear + range / 2 ? 20 : 10 }}
          aria-label="Start year"
        />

        {/* To range input */}
        <input
          type="range"
          min={minYear}
          max={maxYear}
          value={localTo}
          onChange={handleToChange}
          className="time-slider-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none z-10"
          style={{ zIndex: localTo < minYear + range / 2 ? 20 : 10 }}
          aria-label="End year"
        />
      </div>

      {/* Max year label */}
      <span className="text-xs text-sage-400 dark:text-dark-text-muted tabular-nums shrink-0 w-8">
        {maxYear}
      </span>

      {/* Current selected range display */}
      <div className="flex items-center gap-1.5 bg-sage-50 dark:bg-dark-surface rounded-lg px-2.5 py-1 border border-sage-200 dark:border-dark-border shrink-0">
        <span className="text-sm font-semibold text-earth-900 dark:text-dark-text tabular-nums">
          {localFrom}
        </span>
        <span className="text-sage-300 dark:text-dark-text-muted">&ndash;</span>
        <span className="text-sm font-semibold text-earth-900 dark:text-dark-text tabular-nums">
          {localTo}
        </span>
      </div>

      {/* Clear button */}
      {timeFilter && (
        <button
          onClick={handleClear}
          className="p-1 rounded-md text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text hover:bg-sage-100 dark:hover:bg-dark-surface transition-colors shrink-0"
          aria-label="Clear time filter"
          title="Clear time filter"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

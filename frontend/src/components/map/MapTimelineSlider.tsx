import { useCallback, useEffect, useRef, useState } from "react"
import { X, Clock, Play, Pause } from "lucide-react"
import { useMapStore } from "../../stores/mapStore"

interface MapTimelineSliderProps {
  minYear: number
  maxYear: number
}

export function MapTimelineSlider({ minYear, maxYear }: MapTimelineSliderProps) {
  const yearRange = useMapStore((s) => s.yearRange)
  const setYearRange = useMapStore((s) => s.setYearRange)
  const isPlaying = useMapStore((s) => s.isPlaying)
  const setIsPlaying = useMapStore((s) => s.setIsPlaying)
  const playbackYear = useMapStore((s) => s.playbackYear)
  const setPlaybackYear = useMapStore((s) => s.setPlaybackYear)

  const [localFrom, setLocalFrom] = useState(yearRange?.[0] ?? minYear)
  const [localTo, setLocalTo] = useState(yearRange?.[1] ?? maxYear)
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (yearRange) {
      setLocalFrom(yearRange[0])
      setLocalTo(yearRange[1])
    } else {
      setLocalFrom(minYear)
      setLocalTo(maxYear)
    }
  }, [yearRange, minYear, maxYear])

  // Playback logic
  useEffect(() => {
    if (isPlaying) {
      const startYear = playbackYear ?? minYear
      let currentYear = startYear

      playIntervalRef.current = setInterval(() => {
        currentYear += 5
        if (currentYear > maxYear) {
          setIsPlaying(false)
          setPlaybackYear(null)
          return
        }
        setPlaybackYear(currentYear)
      }, 200)

      return () => {
        if (playIntervalRef.current) clearInterval(playIntervalRef.current)
      }
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current)
        playIntervalRef.current = null
      }
    }
  }, [isPlaying, minYear, maxYear, setIsPlaying, setPlaybackYear, playbackYear])

  const commitFilter = useCallback(
    (from: number, to: number) => {
      if (from === minYear && to === maxYear) {
        setYearRange(null)
      } else {
        setYearRange([from, to])
      }
    },
    [minYear, maxYear, setYearRange],
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
    setYearRange(null)
    setIsPlaying(false)
    setPlaybackYear(null)
  }, [setYearRange, setIsPlaying, setPlaybackYear])

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false)
    } else {
      setPlaybackYear(minYear)
      setIsPlaying(true)
    }
  }, [isPlaying, minYear, setIsPlaying, setPlaybackYear])

  const range = maxYear - minYear || 1
  const fromPercent = ((localFrom - minYear) / range) * 100
  const toPercent = ((localTo - minYear) / range) * 100

  if (maxYear - minYear < 2) return null

  return (
    <div className="flex items-center gap-2 bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-xl shadow-lg dark:shadow-black/20 border border-sage-200 dark:border-dark-border px-3 py-2.5">
      {/* Play/Pause button */}
      <button
        onClick={togglePlayback}
        className="p-1.5 rounded-lg hover:bg-sage-100 dark:hover:bg-dark-surface text-sage-400 dark:text-dark-text-muted hover:text-primary-dark transition-colors shrink-0"
        aria-label={isPlaying ? "Pause" : "Play timeline"}
        title={isPlaying ? "Pause" : "Play through time"}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      <Clock className="w-3.5 h-3.5 text-sage-400 dark:text-dark-text-muted shrink-0" />

      <span className="text-xs text-sage-400 dark:text-dark-text-muted tabular-nums shrink-0 w-8 text-right">
        {minYear}
      </span>

      <div className="relative w-48 h-8 flex items-center">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-sage-100 dark:bg-dark-surface" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-primary"
          style={{ left: `${fromPercent}%`, width: `${toPercent - fromPercent}%` }}
        />
        {playbackYear !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-primary-dark rounded-full z-20"
            style={{ left: `${((playbackYear - minYear) / range) * 100}%` }}
          />
        )}
        <input
          type="range" min={minYear} max={maxYear} value={localFrom}
          onChange={handleFromChange}
          className="time-slider-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none z-10"
          style={{ zIndex: localFrom > minYear + range / 2 ? 20 : 10 }}
          aria-label="Start year"
        />
        <input
          type="range" min={minYear} max={maxYear} value={localTo}
          onChange={handleToChange}
          className="time-slider-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none z-10"
          style={{ zIndex: localTo < minYear + range / 2 ? 20 : 10 }}
          aria-label="End year"
        />
      </div>

      <span className="text-xs text-sage-400 dark:text-dark-text-muted tabular-nums shrink-0 w-8">
        {maxYear}
      </span>

      <div className="flex items-center gap-1.5 bg-sage-50 dark:bg-dark-surface rounded-lg px-2 py-1 border border-sage-200 dark:border-dark-border shrink-0">
        {playbackYear !== null ? (
          <span className="text-sm font-semibold text-primary-dark dark:text-primary tabular-nums">{playbackYear}</span>
        ) : (
          <>
            <span className="text-sm font-semibold text-earth-900 dark:text-dark-text tabular-nums">{localFrom}</span>
            <span className="text-sage-300 dark:text-dark-text-muted">&ndash;</span>
            <span className="text-sm font-semibold text-earth-900 dark:text-dark-text tabular-nums">{localTo}</span>
          </>
        )}
      </div>

      {(yearRange || isPlaying) && (
        <button
          onClick={handleClear}
          className="p-1 rounded-md text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text hover:bg-sage-100 dark:hover:bg-dark-surface transition-colors shrink-0"
          aria-label="Clear"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

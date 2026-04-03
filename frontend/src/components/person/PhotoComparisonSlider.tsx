import { useState, useRef, useCallback } from "react"

interface PhotoComparisonSliderProps {
  oldImageUrl: string
  newImageUrl: string
  oldYear?: number | null
  newYear?: number | null
  title?: string
}

export function PhotoComparisonSlider({ oldImageUrl, newImageUrl, oldYear, newYear, title }: PhotoComparisonSliderProps) {
  const [sliderPos, setSliderPos] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setSliderPos(pct)
  }, [])

  const handleMouseDown = useCallback(() => { isDragging.current = true }, [])
  const handleMouseUp = useCallback(() => { isDragging.current = false }, [])
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging.current) handleMove(e.clientX)
  }, [handleMove])
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches[0]) handleMove(e.touches[0].clientX)
  }, [handleMove])

  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-medium text-earth-900 dark:text-dark-text">{title}</p>}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-sage-200 dark:border-dark-border cursor-col-resize select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        style={{ aspectRatio: "16/9" }}
      >
        {/* New image (full background) */}
        <img src={newImageUrl} alt="Current" className="absolute inset-0 w-full h-full object-cover" />

        {/* Old image (clipped by slider position) */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
          <img src={oldImageUrl} alt="Historical" className="absolute inset-0 w-full h-full object-cover" style={{ width: `${containerRef.current?.offsetWidth ?? 500}px` }} />
        </div>

        {/* Slider line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg cursor-col-resize z-10"
          style={{ left: `${sliderPos}%` }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          {/* Handle */}
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-sage-200">
            <div className="flex gap-0.5">
              <div className="w-0.5 h-3 bg-sage-400 rounded-full" />
              <div className="w-0.5 h-3 bg-sage-400 rounded-full" />
            </div>
          </div>
        </div>

        {/* Year labels */}
        {oldYear && (
          <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-lg z-5">{oldYear}</div>
        )}
        {newYear && (
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-lg z-5">{newYear}</div>
        )}
      </div>
    </div>
  )
}

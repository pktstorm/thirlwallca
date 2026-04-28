// site/frontend/src/components/orbital/OrbitalCanvas.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Plus, Minus, LocateFixed } from "lucide-react"
import { usePersonOrbit, buildControlOptions } from "../../hooks/usePersonOrbit"
import { useTreeDisplayStore } from "../../stores/treeDisplayStore"
import { useOrbitalStore } from "../../stores/orbitalStore"
import { useTreeStore } from "../../stores/treeStore"
import { computeOrbitalLayout } from "./orbitalLayout"
import { OrbitalRings } from "./OrbitalRings"
import { OrbitalEdges } from "./OrbitalEdges"
import { OrbitalPersonTile } from "./OrbitalPersonTile"
import type { Slot, OrbitalPersonRef } from "./orbitalTypes"

interface Props {
  focusPersonId: string
}

const MIN_ZOOM = 0.2
const MAX_ZOOM = 4
const ZOOM_STEP = 1.2  // multiplier per zoom-button click
const WHEEL_ZOOM_FACTOR = 0.0015  // sensitivity of wheel zoom

export function OrbitalCanvas({ focusPersonId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 800, height: 600 })
  const [transform, setTransform] = useState({ panX: 0, panY: 0, zoom: 1 })
  const dragStateRef = useRef<{
    startClientX: number
    startClientY: number
    startPanX: number
    startPanY: number
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const display = useTreeDisplayStore()
  const orbital = useOrbitalStore()
  const setFocusedPerson = useTreeStore((s) => s.setFocusedPerson)
  const setBranchPersonId = useTreeStore((s) => s.setBranchPersonId)

  const options = buildControlOptions(
    {
      ancestorDepth: display.ancestorDepth,
      descendantDepth: display.descendantDepth,
      showSpouses: display.showSpouses,
      showPhotos: display.showPhotos,
      highlightDirectLine: display.highlightDirectLine,
      livingDeceasedStyling: display.livingDeceasedStyling,
      labelDensity: display.labelDensity,
    },
    {
      showSiblings: orbital.showSiblings,
      colorByBranch: orbital.colorByBranch,
      recenterOnSingleClick: orbital.recenterOnSingleClick,
    },
  )

  const { data, isLoading, error } = usePersonOrbit(focusPersonId, {
    ancestorDepth: options.ancestorDepth,
    descendantDepth: options.descendantDepth,
    includeSiblings: options.showSiblings,
    includeSpouses: options.showSpouses,
  })

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const e = entries[0]
      if (!e) return
      setViewport({ width: e.contentRect.width, height: e.contentRect.height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Reset pan/zoom when the focus person changes — the orbit recomputes around a new center.
  useEffect(() => {
    setTransform({ panX: 0, panY: 0, zoom: 1 })
  }, [focusPersonId])

  const resetView = useCallback(() => {
    setTransform({ panX: 0, panY: 0, zoom: 1 })
  }, [])

  const zoomIn = useCallback(() => {
    setTransform((t) => ({ ...t, zoom: Math.min(MAX_ZOOM, t.zoom * ZOOM_STEP) }))
  }, [])

  const zoomOut = useCallback(() => {
    setTransform((t) => ({ ...t, zoom: Math.max(MIN_ZOOM, t.zoom / ZOOM_STEP) }))
  }, [])

  // Wheel zoom: pivots around the cursor position so the point under the cursor stays put.
  // Attached via addEventListener with { passive: false } in the effect below (React's synthetic
  // onWheel is passive by default, which makes preventDefault() a no-op and emits a console
  // warning). Without preventDefault(), the page would also scroll when wheeling inside the
  // canvas.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cursorX = e.clientX - rect.left - rect.width / 2
      const cursorY = e.clientY - rect.top - rect.height / 2
      setTransform((t) => {
        const factor = Math.exp(-e.deltaY * WHEEL_ZOOM_FACTOR)
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, t.zoom * factor))
        if (newZoom === t.zoom) return t
        // Keep the world-point under the cursor stationary:
        //   world = (cursor - pan) / zoom, must equal (cursor - newPan) / newZoom
        //   newPan = cursor - (cursor - pan) * (newZoom / zoom)
        const ratio = newZoom / t.zoom
        return {
          zoom: newZoom,
          panX: cursorX - (cursorX - t.panX) * ratio,
          panY: cursorY - (cursorY - t.panY) * ratio,
        }
      })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only start a drag on the canvas background (not on tiles or settings).
      // Tiles intercept clicks via their own onClick; this fires for clicks on the SVG/empty area.
      if (e.button !== 0) return
      dragStateRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: transform.panX,
        startPanY: transform.panY,
      }
      setIsDragging(true)
    },
    [transform.panX, transform.panY],
  )

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      const start = dragStateRef.current
      if (!start) return
      setTransform((t) => ({
        ...t,
        panX: start.startPanX + (e.clientX - start.startClientX),
        panY: start.startPanY + (e.clientY - start.startClientY),
      }))
    }
    const onUp = () => {
      dragStateRef.current = null
      setIsDragging(false)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [isDragging])

  const layout = useMemo(() => {
    if (!data) return null
    return computeOrbitalLayout(data, options, viewport)
  }, [data, options, viewport])

  const personById = useMemo(() => {
    const m = new Map<string, OrbitalPersonRef>()
    if (!data) return m
    const d = data
    m.set(d.focus.id, d.focus)
    for (const gen of d.ancestorsByGeneration) for (const a of gen) m.set(a.id, a)
    function walk(node: typeof d.descendants[number]) {
      m.set(node.id, node)
      node.children.forEach(walk)
    }
    d.descendants.forEach(walk)
    d.siblings.forEach((s) => m.set(s.id, s))
    d.spouses.forEach((s) => m.set(s.id, s))
    return m
  }, [data])

  function handleClick(slot: Slot) {
    setFocusedPerson(slot.personId)
    if (options.recenterOnSingleClick) {
      setBranchPersonId(slot.personId)
    }
  }

  function handleDoubleClick(slot: Slot) {
    setBranchPersonId(slot.personId)
    setFocusedPerson(slot.personId)
  }

  if (isLoading) return <div className="p-4 text-sage-500">Loading orbital view…</div>
  if (error) return <div className="p-4 text-red-500">Failed to load orbital view.</div>
  if (!data || !layout) return null

  // Combined transform applied to the rings/edges/tiles content. The viewBox is sized to the
  // viewport at zoom=1, so applying CSS transform pans/zooms naturally around the viewport center.
  const transformStyle = `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden text-earth-900 dark:text-dark-text select-none"
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
      onMouseDown={handleMouseDown}
    >
      {/* Pan/zoom wrapper — transforms both layers identically. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: transformStyle,
          transformOrigin: "center center",
        }}
      >
        {/* Centered SVG that draws rings + edges */}
        <svg
          width="100%"
          height="100%"
          viewBox={`${-viewport.width / 2} ${-viewport.height / 2} ${viewport.width} ${viewport.height}`}
          style={{ position: "absolute", inset: 0 }}
        >
          <OrbitalRings rings={layout.rings} />
          <OrbitalEdges edges={layout.edges} />
        </svg>

        {/* Tile layer — absolute-positioned div centered at viewport center */}
        <div
          style={{
            position: "absolute",
            left: viewport.width / 2,
            top: viewport.height / 2,
            width: 0,
            height: 0,
          }}
        >
          {layout.slots.map((slot) => {
            const person = personById.get(slot.personId)
            if (!person) return null
            return (
              <OrbitalPersonTile
                key={slot.id}
                slot={slot}
                person={person}
                options={options}
                isFocus={slot.personId === data.focus.id && !slot.isSpouse && !slot.isSibling}
                dense={layout.rings.find((r) => r.generation === slot.ring)?.dense ?? false}
                onClick={() => handleClick(slot)}
                onDoubleClick={() => handleDoubleClick(slot)}
              />
            )
          })}
        </div>
      </div>

      {/* Zoom + reset controls. Stop propagation so clicking them doesn't start a drag. */}
      <div
        className="absolute bottom-44 sm:bottom-32 right-3 sm:right-4 z-10 flex flex-col gap-0 rounded-xl overflow-hidden shadow-lg dark:shadow-black/20 border border-sage-200 dark:border-dark-border"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={zoomIn}
          className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm p-2.5 hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors text-earth-900 dark:text-dark-text border-b border-sage-200 dark:border-dark-border"
          aria-label="Zoom in"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={zoomOut}
          className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm p-2.5 hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors text-earth-900 dark:text-dark-text border-b border-sage-200 dark:border-dark-border"
          aria-label="Zoom out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={resetView}
          className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm p-2.5 hover:bg-primary/10 dark:hover:bg-primary/10 transition-colors text-primary-dark dark:text-primary"
          aria-label="Reset view"
          title="Reset view"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      </div>

      {layout.rings.filter((r) => r.hemisphere === "top").length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full bg-sage-50 dark:bg-dark-surface text-sage-500 border border-sage-200 dark:border-dark-border pointer-events-none">
          No ancestors recorded
        </div>
      )}
      {layout.rings.filter((r) => r.hemisphere === "bottom").length === 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full bg-sage-50 dark:bg-dark-surface text-sage-500 border border-sage-200 dark:border-dark-border pointer-events-none">
          No descendants recorded
        </div>
      )}
    </div>
  )
}

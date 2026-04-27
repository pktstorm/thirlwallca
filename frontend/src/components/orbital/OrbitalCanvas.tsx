// site/frontend/src/components/orbital/OrbitalCanvas.tsx
import { useEffect, useMemo, useRef, useState } from "react"
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

export function OrbitalCanvas({ focusPersonId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 800, height: 600 })

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

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden text-earth-900 dark:text-dark-text">
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

      {layout.rings.filter((r) => r.hemisphere === "top").length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full bg-sage-50 dark:bg-dark-surface text-sage-500 border border-sage-200 dark:border-dark-border">
          No ancestors recorded
        </div>
      )}
      {layout.rings.filter((r) => r.hemisphere === "bottom").length === 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs px-3 py-1 rounded-full bg-sage-50 dark:bg-dark-surface text-sage-500 border border-sage-200 dark:border-dark-border">
          No descendants recorded
        </div>
      )}
    </div>
  )
}

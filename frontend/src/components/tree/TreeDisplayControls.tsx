import { useState } from "react"
import { Sliders, X, RotateCcw } from "lucide-react"
import { useTreeDisplayStore } from "../../stores/treeDisplayStore"
import type { LabelDensity } from "../orbital/orbitalTypes"

export function TreeDisplayControls() {
  const [open, setOpen] = useState(false)
  const d = useTreeDisplayStore()

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-4 right-4 z-10 bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm p-2.5 rounded-xl border border-sage-200 dark:border-dark-border shadow-sm text-earth-900 dark:text-dark-text hover:bg-sage-50 dark:hover:bg-dark-surface"
        aria-label="Display settings"
      >
        <Sliders className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div className="absolute top-4 right-4 z-10 w-72 bg-white/95 dark:bg-dark-card/95 backdrop-blur-md rounded-xl border border-sage-200 dark:border-dark-border shadow-lg text-earth-900 dark:text-dark-text">
      <header className="flex items-center justify-between px-4 py-3 border-b border-sage-200 dark:border-dark-border">
        <h3 className="text-sm font-semibold">Display</h3>
        <button onClick={() => setOpen(false)} aria-label="Close" className="text-sage-500"><X className="w-4 h-4" /></button>
      </header>
      <section className="px-4 py-3 space-y-3 border-b border-sage-200 dark:border-dark-border">
        <label className="block text-xs">
          <div className="mb-1">Ancestors: {d.ancestorDepth}</div>
          <input type="range" min={1} max={10} value={d.ancestorDepth} onChange={(e) => d.setAncestorDepth(Number(e.target.value))} className="w-full"/>
        </label>
        <label className="block text-xs">
          <div className="mb-1">Descendants: {d.descendantDepth}</div>
          <input type="range" min={1} max={10} value={d.descendantDepth} onChange={(e) => d.setDescendantDepth(Number(e.target.value))} className="w-full"/>
        </label>
      </section>
      <section className="px-4 py-3 space-y-2 border-b border-sage-200 dark:border-dark-border">
        <Toggle label="Show spouses" checked={d.showSpouses} onChange={d.setShowSpouses} />
        <Toggle label="Show photos" checked={d.showPhotos} onChange={d.setShowPhotos} />
        <Toggle label="Highlight direct line" checked={d.highlightDirectLine} onChange={d.setHighlightDirectLine} />
        <Toggle label="Living/deceased styling" checked={d.livingDeceasedStyling} onChange={d.setLivingDeceasedStyling} />
      </section>
      <section className="px-4 py-3 space-y-2 border-b border-sage-200 dark:border-dark-border">
        <div className="text-xs uppercase tracking-wide text-sage-500">Labels</div>
        {(["none", "names", "names-dates"] as LabelDensity[]).map((v) => (
          <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="radio" name="labelDensity" checked={d.labelDensity === v} onChange={() => d.setLabelDensity(v)}/>
            <span>{v === "none" ? "None" : v === "names" ? "Names" : "Names + dates"}</span>
          </label>
        ))}
      </section>
      <footer className="px-4 py-3">
        <button className="text-xs text-sage-500 flex items-center gap-1" onClick={() => d.reset()}>
          <RotateCcw className="w-3 h-3"/> Reset to defaults
        </button>
      </footer>
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-sm cursor-pointer">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

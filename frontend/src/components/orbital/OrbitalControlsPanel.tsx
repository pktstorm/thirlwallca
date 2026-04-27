import { useState } from "react"
import { Settings, X, RotateCcw } from "lucide-react"
import { useTreeDisplayStore } from "../../stores/treeDisplayStore"
import { useOrbitalStore } from "../../stores/orbitalStore"
import type { LabelDensity } from "./orbitalTypes"

export function OrbitalControlsPanel() {
  const [open, setOpen] = useState(false)
  const display = useTreeDisplayStore()
  const orbital = useOrbitalStore()

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-4 right-4 z-10 bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm p-2.5 rounded-xl border border-sage-200 dark:border-dark-border shadow-sm dark:shadow-black/20 text-earth-900 dark:text-dark-text hover:bg-sage-50 dark:hover:bg-dark-surface"
        aria-label="Orbital settings"
        title="Orbital settings"
      >
        <Settings className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div className="absolute top-4 right-4 z-10 w-72 bg-white/95 dark:bg-dark-card/95 backdrop-blur-md rounded-xl border border-sage-200 dark:border-dark-border shadow-lg dark:shadow-black/30 text-earth-900 dark:text-dark-text">
      <header className="flex items-center justify-between px-4 py-3 border-b border-sage-200 dark:border-dark-border">
        <h3 className="text-sm font-semibold">Orbital settings</h3>
        <button onClick={() => setOpen(false)} aria-label="Close" className="text-sage-500 hover:text-earth-900 dark:hover:text-dark-text">
          <X className="w-4 h-4" />
        </button>
      </header>

      <section className="px-4 py-3 space-y-3 border-b border-sage-200 dark:border-dark-border">
        <Slider label={`Ancestors: ${display.ancestorDepth}`} value={display.ancestorDepth} onChange={display.setAncestorDepth} />
        <Slider label={`Descendants: ${display.descendantDepth}`} value={display.descendantDepth} onChange={display.setDescendantDepth} />
      </section>

      <section className="px-4 py-3 space-y-2 border-b border-sage-200 dark:border-dark-border">
        <Toggle label="Show spouses" checked={display.showSpouses} onChange={display.setShowSpouses} />
        <Toggle label="Show photos" checked={display.showPhotos} onChange={display.setShowPhotos} />
        <Toggle label="Show siblings of focus" checked={orbital.showSiblings} onChange={orbital.setShowSiblings} />
        <Toggle label="Highlight direct line" checked={display.highlightDirectLine} onChange={display.setHighlightDirectLine} />
        <Toggle label="Color by branch" checked={orbital.colorByBranch} onChange={orbital.setColorByBranch} />
        <Toggle label="Living/deceased styling" checked={display.livingDeceasedStyling} onChange={display.setLivingDeceasedStyling} />
      </section>

      <section className="px-4 py-3 space-y-2 border-b border-sage-200 dark:border-dark-border">
        <div className="text-xs uppercase tracking-wide text-sage-500">Labels</div>
        <Radio name="labelDensity" value="none" current={display.labelDensity} onChange={display.setLabelDensity} label="None" />
        <Radio name="labelDensity" value="names" current={display.labelDensity} onChange={display.setLabelDensity} label="Names" />
        <Radio name="labelDensity" value="names-dates" current={display.labelDensity} onChange={display.setLabelDensity} label="Names + dates" />
      </section>

      <section className="px-4 py-3 space-y-2 border-b border-sage-200 dark:border-dark-border">
        <Toggle label="Re-center on single click" checked={orbital.recenterOnSingleClick} onChange={orbital.setRecenterOnSingleClick} />
        <p className="text-[10px] text-sage-500">Default: double-click recenters</p>
      </section>

      <footer className="px-4 py-3">
        <button
          className="text-xs text-sage-500 hover:text-earth-900 dark:hover:text-dark-text flex items-center gap-1"
          onClick={() => { display.reset(); orbital.reset() }}
        >
          <RotateCcw className="w-3 h-3" />
          Reset to defaults
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

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-xs">
      <div className="mb-1">{label}</div>
      <input type="range" min={1} max={10} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </label>
  )
}

function Radio({ name, value, current, onChange, label }: { name: string; value: LabelDensity; current: LabelDensity; onChange: (v: LabelDensity) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <input type="radio" name={name} checked={current === value} onChange={() => onChange(value)} />
      <span>{label}</span>
    </label>
  )
}

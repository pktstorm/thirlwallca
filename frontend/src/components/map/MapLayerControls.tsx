import { useMapStore } from "../../stores/mapStore"

interface MapLayerControlsProps {
  migrationCount: number
  birthCount: number
  deathCount: number
  residenceCount: number
}

const checkboxClass =
  "rounded border-gray-300 dark:border-dark-border text-primary-dark focus:ring-primary-dark/20 dark:bg-dark-surface"

export function MapLayerControls({
  migrationCount,
  birthCount,
  deathCount,
  residenceCount,
}: MapLayerControlsProps) {
  const showMigrations = useMapStore((s) => s.showMigrations)
  const showBirths = useMapStore((s) => s.showBirths)
  const showDeaths = useMapStore((s) => s.showDeaths)
  const showResidences = useMapStore((s) => s.showResidences)
  const setShowMigrations = useMapStore((s) => s.setShowMigrations)
  const setShowBirths = useMapStore((s) => s.setShowBirths)
  const setShowDeaths = useMapStore((s) => s.setShowDeaths)
  const setShowResidences = useMapStore((s) => s.setShowResidences)

  return (
    <div className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-xl border border-sage-200 dark:border-dark-border shadow-lg px-4 py-3 min-w-[180px]">
      <p className="text-xs font-semibold text-earth-900 dark:text-dark-text mb-2">
        Layers
      </p>

      {/* Migrations toggle */}
      <label className="flex items-center gap-2 py-1 cursor-pointer group">
        <input
          type="checkbox"
          checked={showMigrations}
          onChange={(e) => setShowMigrations(e.target.checked)}
          className={checkboxClass}
        />
        <div className="w-5 h-0.5 border-t-2 border-dashed border-primary" />
        <span className="text-xs text-earth-900 dark:text-dark-text group-hover:text-primary-dark transition-colors flex-1">
          Migration paths
        </span>
        <span className="text-xs text-sage-400 dark:text-dark-text-muted tabular-nums">
          {migrationCount}
        </span>
      </label>

      <div className="border-t border-sage-100 dark:border-dark-border my-1.5" />

      {/* Birth toggle */}
      <label className="flex items-center gap-2 py-1 cursor-pointer group">
        <input
          type="checkbox"
          checked={showBirths}
          onChange={(e) => setShowBirths(e.target.checked)}
          className={checkboxClass}
        />
        <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
        <span className="text-xs text-earth-900 dark:text-dark-text group-hover:text-primary-dark transition-colors flex-1">
          Births
        </span>
        <span className="text-xs text-sage-400 dark:text-dark-text-muted tabular-nums">
          {birthCount}
        </span>
      </label>

      {/* Death toggle */}
      <label className="flex items-center gap-2 py-1 cursor-pointer group">
        <input
          type="checkbox"
          checked={showDeaths}
          onChange={(e) => setShowDeaths(e.target.checked)}
          className={checkboxClass}
        />
        <div className="w-3 h-3 rounded-full bg-gray-500 shrink-0" />
        <span className="text-xs text-earth-900 dark:text-dark-text group-hover:text-primary-dark transition-colors flex-1">
          Deaths
        </span>
        <span className="text-xs text-sage-400 dark:text-dark-text-muted tabular-nums">
          {deathCount}
        </span>
      </label>

      {/* Residence toggle */}
      <label className="flex items-center gap-2 py-1 cursor-pointer group">
        <input
          type="checkbox"
          checked={showResidences}
          onChange={(e) => setShowResidences(e.target.checked)}
          className={checkboxClass}
        />
        <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
        <span className="text-xs text-earth-900 dark:text-dark-text group-hover:text-primary-dark transition-colors flex-1">
          Residences
        </span>
        <span className="text-xs text-sage-400 dark:text-dark-text-muted tabular-nums">
          {residenceCount}
        </span>
      </label>
    </div>
  )
}

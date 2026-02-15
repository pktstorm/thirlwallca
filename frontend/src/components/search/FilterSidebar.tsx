import { X, SlidersHorizontal } from "lucide-react"
import { cn } from "../../lib/utils"

interface FilterSidebarProps {
  /** Available place options with counts */
  availablePlaces: { name: string; count: number }[]
  /** Currently selected places */
  selectedPlaces: string[]
  onPlaceToggle: (place: string) => void
  /** Era range */
  eraFrom: number | null
  eraTo: number | null
  onEraFromChange: (value: number | null) => void
  onEraToChange: (value: number | null) => void
  /** Available occupations */
  availableOccupations: string[]
  /** Currently selected occupations */
  selectedOccupations: string[]
  onOccupationToggle: (occupation: string) => void
  /** Reset all filters */
  onResetFilters: () => void
  /** Mobile visibility */
  isOpen: boolean
  onClose: () => void
}

export function FilterSidebar({
  availablePlaces,
  selectedPlaces,
  onPlaceToggle,
  eraFrom,
  eraTo,
  onEraFromChange,
  onEraToChange,
  availableOccupations,
  selectedOccupations,
  onOccupationToggle,
  onResetFilters,
  isOpen,
  onClose,
}: FilterSidebarProps) {
  const hasActiveFilters =
    selectedPlaces.length > 0 ||
    eraFrom !== null ||
    eraTo !== null ||
    selectedOccupations.length > 0

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "w-full sm:w-80 bg-white dark:bg-dark-card border-r border-sage-200 dark:border-dark-border h-full overflow-y-auto shrink-0",
          "fixed lg:relative z-50 lg:z-auto inset-y-0 left-0",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-earth-900 dark:text-dark-text">Filters</h2>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  onClick={onResetFilters}
                  className="text-xs text-sage-400 dark:text-dark-text-muted hover:text-primary transition-colors"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 hover:bg-sage-100 dark:hover:bg-dark-surface rounded-lg text-sage-400 dark:text-dark-text-muted lg:hidden"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Places section */}
          {availablePlaces.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-earth-900 dark:text-dark-text uppercase tracking-wider mb-3">
                Places
              </h3>
              <div className="space-y-2">
                {availablePlaces.map((place) => (
                  <label
                    key={place.name}
                    className="flex items-center gap-2.5 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlaces.includes(place.name)}
                      onChange={() => onPlaceToggle(place.name)}
                      className="w-4 h-4 rounded border-sage-300 dark:border-dark-border text-primary focus:ring-primary focus:ring-offset-0 dark:bg-dark-surface"
                    />
                    <span className="text-sm text-earth-900 dark:text-dark-text group-hover:text-primary transition-colors flex-1">
                      {place.name}
                    </span>
                    <span className="text-xs text-sage-300 dark:text-dark-text-muted bg-sage-50 dark:bg-dark-surface px-1.5 py-0.5 rounded">
                      {place.count}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Era section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-earth-900 dark:text-dark-text uppercase tracking-wider mb-3">
              Era
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs text-sage-400 dark:text-dark-text-muted mb-1">From</label>
                <input
                  type="number"
                  placeholder="1700"
                  value={eraFrom ?? ""}
                  onChange={(e) => {
                    const val = e.target.value
                    onEraFromChange(val ? parseInt(val, 10) : null)
                  }}
                  className="w-full border border-sage-200 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-earth-900 dark:text-dark-text bg-white dark:bg-dark-surface placeholder-sage-300 dark:placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <span className="text-sage-300 dark:text-dark-text-muted mt-5">--</span>
              <div className="flex-1">
                <label className="block text-xs text-sage-400 dark:text-dark-text-muted mb-1">To</label>
                <input
                  type="number"
                  placeholder="2024"
                  value={eraTo ?? ""}
                  onChange={(e) => {
                    const val = e.target.value
                    onEraToChange(val ? parseInt(val, 10) : null)
                  }}
                  className="w-full border border-sage-200 dark:border-dark-border rounded-lg px-3 py-2 text-sm text-earth-900 dark:text-dark-text bg-white dark:bg-dark-surface placeholder-sage-300 dark:placeholder-dark-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Occupations section */}
          {availableOccupations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-earth-900 dark:text-dark-text uppercase tracking-wider mb-3">
                Occupations
              </h3>
              <div className="flex flex-wrap gap-2">
                {availableOccupations.map((occ) => {
                  const isActive = selectedOccupations.includes(occ)
                  return (
                    <button
                      key={occ}
                      onClick={() => onOccupationToggle(occ)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/20 text-primary-dark border border-primary/30"
                          : "bg-sage-50 dark:bg-dark-surface text-sage-800 dark:text-dark-text border border-sage-200 dark:border-dark-border hover:border-primary/30 hover:bg-primary/10",
                      )}
                    >
                      {occ}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

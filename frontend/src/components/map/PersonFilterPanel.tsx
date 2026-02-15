import { useState, useMemo } from "react"
import { Users, X, Search } from "lucide-react"
import { useMapStore } from "../../stores/mapStore"

interface PersonEntry {
  id: string
  name: string
}

interface PersonFilterPanelProps {
  persons: PersonEntry[]
}

export function PersonFilterPanel({ persons }: PersonFilterPanelProps) {
  const personPanelOpen = useMapStore((s) => s.personPanelOpen)
  const setPersonPanelOpen = useMapStore((s) => s.setPersonPanelOpen)
  const selectedPersonIds = useMapStore((s) => s.selectedPersonIds)
  const togglePerson = useMapStore((s) => s.togglePerson)
  const selectAllPersons = useMapStore((s) => s.selectAllPersons)
  const deselectAllPersons = useMapStore((s) => s.deselectAllPersons)

  const [search, setSearch] = useState("")

  const filteredPersons = useMemo(() => {
    if (!search.trim()) return persons
    const q = search.toLowerCase()
    return persons.filter((p) => p.name.toLowerCase().includes(q))
  }, [persons, search])

  const isAllSelected = selectedPersonIds === null
  const selectedCount = isAllSelected ? persons.length : selectedPersonIds.size

  return (
    <>
      {/* Trigger button */}
      <div className="absolute top-24 left-6 z-30 pointer-events-auto">
        <button
          onClick={() => setPersonPanelOpen(!personPanelOpen)}
          className="flex items-center gap-2 bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-xl shadow-lg dark:shadow-black/20 border border-sage-200 dark:border-dark-border px-3 py-2.5 hover:bg-white dark:hover:bg-dark-card transition-colors"
        >
          <Users className="w-4 h-4 text-sage-600 dark:text-dark-text-muted" />
          <span className="text-sm font-medium text-earth-900 dark:text-dark-text">People</span>
          {!isAllSelected && (
            <span className="bg-primary/20 text-primary-dark text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {selectedCount}
            </span>
          )}
        </button>
      </div>

      {/* Slide-out panel */}
      <div
        className={`absolute top-16 left-0 bottom-0 z-30 w-80 pointer-events-auto transition-transform duration-300 ease-in-out ${
          personPanelOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full bg-white/95 dark:bg-dark-card/95 backdrop-blur-md border-r border-sage-200 dark:border-dark-border shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-sage-200 dark:border-dark-border">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-sage-400 dark:text-dark-text-muted" />
              <h3 className="text-sm font-semibold text-earth-900 dark:text-dark-text">
                People
              </h3>
              <span className="text-xs text-sage-400 dark:text-dark-text-muted">
                {isAllSelected ? "All" : `${selectedCount} of ${persons.length}`}
              </span>
            </div>
            <button
              onClick={() => setPersonPanelOpen(false)}
              className="p-1.5 rounded-lg hover:bg-sage-100 dark:hover:bg-dark-surface text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-2 border-b border-sage-100 dark:border-dark-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-sage-400 dark:text-dark-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-surface text-earth-900 dark:text-dark-text placeholder:text-sage-300 dark:placeholder:text-dark-text-muted/50 focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Select All / Deselect All */}
          <div className="px-4 py-2 border-b border-sage-100 dark:border-dark-border flex items-center gap-2">
            <button
              onClick={selectAllPersons}
              className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                isAllSelected
                  ? "bg-primary/10 text-primary-dark"
                  : "text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text hover:bg-sage-100 dark:hover:bg-dark-surface"
              }`}
            >
              Select All
            </button>
            <button
              onClick={deselectAllPersons}
              className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                !isAllSelected && selectedCount === 0
                  ? "bg-primary/10 text-primary-dark"
                  : "text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text hover:bg-sage-100 dark:hover:bg-dark-surface"
              }`}
            >
              Deselect All
            </button>
          </div>

          {/* Person list */}
          <div className="flex-1 overflow-y-auto px-2 py-1">
            {filteredPersons.length === 0 && (
              <p className="text-xs text-sage-400 dark:text-dark-text-muted text-center py-6">
                {search ? "No matching people" : "No people found"}
              </p>
            )}
            {filteredPersons.map((person) => {
              const isChecked = isAllSelected || selectedPersonIds.has(person.id)
              return (
                <label
                  key={person.id}
                  className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-sage-50 dark:hover:bg-dark-surface cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      if (isAllSelected) {
                        // Switching from "all" to "all except this one" — select all except this person
                        const allExcept = new Set(persons.map((p) => p.id))
                        allExcept.delete(person.id)
                        // We need direct store access to set the full set
                        useMapStore.setState({ selectedPersonIds: allExcept })
                      } else {
                        togglePerson(person.id)
                      }
                    }}
                    className="rounded border-gray-300 dark:border-dark-border text-primary-dark focus:ring-primary-dark/20 dark:bg-dark-surface"
                  />
                  <span className="text-sm text-earth-900 dark:text-dark-text truncate">
                    {person.name}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

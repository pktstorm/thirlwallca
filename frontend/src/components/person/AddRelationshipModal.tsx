import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { X, GitBranch, Loader2, CheckCircle } from "lucide-react"
import { api } from "../../lib/api"

type RelationshipType = "parent" | "child" | "spouse"

interface PersonListItem {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  birth_date: string | null
}

interface AddRelationshipModalProps {
  open: boolean
  onClose: () => void
  personId: string
  personName: string
}

function buildLabel(p: PersonListItem): string {
  const parts = [p.first_name]
  if (p.middle_name) parts.push(p.middle_name)
  parts.push(p.last_name)
  let label = parts.join(" ")
  if (p.birth_date) {
    const year = p.birth_date.split("-")[0]
    if (year) label += ` (b. ${year})`
  }
  return label
}

// ── Typeahead combobox ──

function PersonCombobox({
  persons,
  value,
  onChange,
  excludeId,
}: {
  persons: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  excludeId: string
}) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const available = useMemo(
    () => persons.filter((p) => p.id !== excludeId),
    [persons, excludeId],
  )

  const selectedPerson = useMemo(
    () => available.find((p) => p.id === value) ?? null,
    [available, value],
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return available
    const q = query.toLowerCase()
    return available.filter((p) => p.label.toLowerCase().includes(q))
  }, [available, query])

  useEffect(() => {
    setHighlightIndex(0)
  }, [filtered.length])

  useEffect(() => {
    if (!isOpen || !listRef.current) return
    const item = listRef.current.children[highlightIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: "nearest" })
  }, [highlightIndex, isOpen])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleSelect(person: { id: string; label: string }) {
    onChange(person.id)
    setQuery("")
    setIsOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightIndex((i) => Math.max(i - 1, 0))
        break
      case "Enter":
        e.preventDefault()
        if (filtered[highlightIndex]) handleSelect(filtered[highlightIndex])
        break
      case "Escape":
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(false)
        break
    }
  }

  if (selectedPerson) {
    return (
      <div className="flex items-center gap-2 w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-1.5 px-3">
        <span className="flex-1 text-sm text-earth-900 dark:text-dark-text truncate">
          {selectedPerson.label}
        </span>
        <button
          type="button"
          onClick={() => { onChange(""); setQuery("") }}
          className="p-0.5 rounded hover:bg-sage-100 dark:hover:bg-dark-surface text-sage-400 hover:text-earth-900 dark:hover:text-dark-text transition-colors shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setIsOpen(true); setHighlightIndex(0) }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search by name..."
        className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2 px-3 text-sm dark:text-dark-text dark:placeholder:text-dark-text-muted/50 focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
      />
      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-lg"
        >
          {filtered.length === 0 && query.trim() && (
            <li className="px-3 py-2 text-sm text-sage-300 dark:text-dark-text-muted">
              No matches
            </li>
          )}
          {filtered.map((person, i) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => handleSelect(person)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  i === highlightIndex
                    ? "bg-primary/10 text-primary-dark dark:text-primary"
                    : "text-earth-900 dark:text-dark-text hover:bg-sage-50 dark:hover:bg-dark-surface"
                }`}
              >
                {person.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Modal ──

export function AddRelationshipModal({
  open,
  onClose,
  personId,
  personName,
}: AddRelationshipModalProps) {
  const queryClient = useQueryClient()
  const [connectTo, setConnectTo] = useState("")
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("child")
  const [marriageDate, setMarriageDate] = useState("")
  const [marriagePlace, setMarriagePlace] = useState("")
  const [success, setSuccess] = useState(false)

  // Fetch all persons for the combobox
  const { data: personsList } = useQuery({
    queryKey: ["persons-list"],
    queryFn: async () => {
      const res = await api.get<PersonListItem[]>("/persons", {
        params: { limit: 1000 },
      })
      return res.data.map((p) => ({ id: p.id, label: buildLabel(p) }))
    },
    enabled: open,
  })

  // Reset form on open
  useEffect(() => {
    if (open) {
      setConnectTo("")
      setRelationshipType("child")
      setMarriageDate("")
      setMarriagePlace("")
      setSuccess(false)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  const mutation = useMutation({
    mutationFn: async () => {
      let payload: Record<string, unknown>
      switch (relationshipType) {
        case "parent":
          // connectTo is a parent of personId
          // Convention: person_id=child, related_person_id=parent
          payload = {
            person_id: personId,
            related_person_id: connectTo,
            relationship: "parent_child",
          }
          break
        case "child":
          // connectTo is a child of personId
          // Convention: person_id=child, related_person_id=parent
          payload = {
            person_id: connectTo,
            related_person_id: personId,
            relationship: "parent_child",
          }
          break
        case "spouse":
          payload = {
            person_id: personId,
            related_person_id: connectTo,
            relationship: "spouse",
            marriage_date: marriageDate || null,
            marriage_place_text: marriagePlace || null,
          }
          break
      }
      await api.post("/relationships", payload)
    },
    onSuccess: () => {
      setSuccess(true)
      queryClient.invalidateQueries({ queryKey: ["relationships", personId] })
      queryClient.invalidateQueries({ queryKey: ["relatedPersons", personId] })
      queryClient.invalidateQueries({ queryKey: ["tree"] })
      queryClient.invalidateQueries({ queryKey: ["relationship-path"] })
      setTimeout(() => {
        onClose()
      }, 800)
    },
  })

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!connectTo) return
      mutation.mutate()
    },
    [connectTo, mutation],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-white dark:bg-dark-card rounded-2xl shadow-2xl dark:shadow-black/30 p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-sage-100 dark:hover:bg-dark-surface text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary/10 rounded-lg p-2">
            <GitBranch className="h-5 w-5 text-primary-dark" />
          </div>
          <h2 className="text-xl font-bold text-earth-900 dark:text-dark-text">
            Add Relationship
          </h2>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle className="h-12 w-12 text-primary" />
            <p className="text-lg font-semibold text-earth-900 dark:text-dark-text">
              Relationship added!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-sm text-sage-400 dark:text-dark-text-muted">
              Add a family connection for <span className="font-medium text-earth-900 dark:text-dark-text">{personName}</span>.
            </p>

            {/* Person selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1.5">
                Connect to
              </label>
              <PersonCombobox
                persons={personsList ?? []}
                value={connectTo}
                onChange={setConnectTo}
                excludeId={personId}
              />
            </div>

            {/* Relationship type */}
            {connectTo && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1.5">
                    Relationship
                  </label>
                  {(() => {
                    const selectedLabel = (personsList ?? []).find((p) => p.id === connectTo)?.label ?? "Selected person"
                    return (
                      <select
                        value={relationshipType}
                        onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}
                        className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
                      >
                        <option value="parent">{selectedLabel} is a parent of {personName}</option>
                        <option value="child">{selectedLabel} is a child of {personName}</option>
                        <option value="spouse">{selectedLabel} is a spouse of {personName}</option>
                      </select>
                    )
                  })()}
                </div>

                {relationshipType === "spouse" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1.5">
                        Marriage Date
                      </label>
                      <input
                        type="date"
                        value={marriageDate}
                        onChange={(e) => setMarriageDate(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1.5">
                        Marriage Place
                      </label>
                      <input
                        type="text"
                        value={marriagePlace}
                        onChange={(e) => setMarriagePlace(e.target.value)}
                        placeholder="e.g. Holy Trinity Chelsea, London, England"
                        className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text dark:placeholder:text-dark-text-muted/50 focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Error */}
            {mutation.isError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {(mutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                  ?? (mutation.error as Error)?.message
                  ?? "Failed to add relationship"}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={mutation.isPending}
                className="flex-1 border border-gray-200 dark:border-dark-border rounded-lg py-2.5 font-medium text-gray-600 dark:text-dark-text-muted hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!connectTo || mutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-primary-dark text-white rounded-lg py-2.5 font-semibold hover:bg-primary hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Add Relationship"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

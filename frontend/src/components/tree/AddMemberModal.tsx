import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { X, TreePine, Loader2, CheckCircle, Plus, Trash2 } from "lucide-react"
import { api } from "../../lib/api"

interface ExistingPerson {
  id: string
  label: string
}

interface AddMemberModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
  existingPersons: ExistingPerson[]
  defaultConnectTo?: string | null
}

type Gender = "male" | "female" | "other" | "unknown"
type RelationshipType = "parent" | "child" | "spouse"

interface RelationshipEntry {
  connectTo: string
  relationshipType: RelationshipType
  marriageDate: string
}

interface FormState {
  firstName: string
  middleName: string
  lastName: string
  gender: Gender
  birthDate: string
  birthDateApprox: boolean
  deathDate: string
  deathDateApprox: boolean
  isLiving: boolean
  nicknames: string
  birthCity: string
  birthRegion: string
  birthCountry: string
}

const initialFormState: FormState = {
  firstName: "",
  middleName: "",
  lastName: "",
  gender: "unknown",
  birthDate: "",
  birthDateApprox: false,
  deathDate: "",
  deathDateApprox: false,
  isLiving: true,
  nicknames: "",
  birthCity: "",
  birthRegion: "",
  birthCountry: "",
}

function makeRelationshipEntry(connectTo = ""): RelationshipEntry {
  return { connectTo, relationshipType: "child", marriageDate: "" }
}

// ── Typeahead combobox for person selection ──

function PersonCombobox({
  persons,
  value,
  onChange,
}: {
  persons: ExistingPerson[]
  value: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedPerson = useMemo(
    () => persons.find((p) => p.id === value) ?? null,
    [persons, value],
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return persons
    const q = query.toLowerCase()
    return persons.filter((p) => p.label.toLowerCase().includes(q))
  }, [persons, query])

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(0)
  }, [filtered.length])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return
    const item = listRef.current.children[highlightIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: "nearest" })
  }, [highlightIndex, isOpen])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleSelect(person: ExistingPerson) {
    onChange(person.id)
    setQuery("")
    setIsOpen(false)
  }

  function handleClear() {
    onChange("")
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
        if (filtered[highlightIndex]) {
          handleSelect(filtered[highlightIndex])
        }
        break
      case "Escape":
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(false)
        break
    }
  }

  // If a person is selected, show a pill; otherwise show the search input
  if (selectedPerson) {
    return (
      <div className="flex items-center gap-2 w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-1.5 px-3">
        <span className="flex-1 text-sm text-earth-900 dark:text-dark-text truncate">
          {selectedPerson.label}
        </span>
        <button
          type="button"
          onClick={handleClear}
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
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setIsOpen(true)
          setHighlightIndex(0)
        }}
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
          <li>
            <button
              type="button"
              onClick={handleClear}
              className={`w-full text-left px-3 py-2 text-sm text-sage-400 dark:text-dark-text-muted hover:bg-sage-50 dark:hover:bg-dark-surface ${
                highlightIndex === 0 && filtered.length === 0
                  ? "bg-sage-50 dark:bg-dark-surface"
                  : ""
              }`}
            >
              None (no relationship)
            </button>
          </li>
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

export function AddMemberModal({
  open,
  onClose,
  onCreated,
  existingPersons,
  defaultConnectTo,
}: AddMemberModalProps) {
  const [form, setForm] = useState<FormState>(initialFormState)
  const [relationships, setRelationships] = useState<RelationshipEntry[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm(initialFormState)
      setRelationships(
        defaultConnectTo
          ? [makeRelationshipEntry(defaultConnectTo)]
          : [makeRelationshipEntry()],
      )
      setErrors({})
      setApiError(null)
      setSubmitting(false)
      setSuccess(false)
    }
  }, [open, defaultConnectTo])

  const updateRelationship = useCallback(
    (index: number, field: keyof RelationshipEntry, value: string) => {
      setRelationships((prev) =>
        prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
      )
    },
    [],
  )

  const addRelationship = useCallback(() => {
    setRelationships((prev) => [...prev, makeRelationshipEntry()])
  }, [])

  const removeRelationship = useCallback((index: number) => {
    setRelationships((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  const updateField = useCallback(
    <K extends keyof FormState>(field: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    },
    []
  )

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!form.firstName.trim()) {
      newErrors.firstName = "First name is required"
    }
    if (!form.lastName.trim()) {
      newErrors.lastName = "Last name is required"
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setApiError(null)

    try {
      // 1. Create the person
      const personPayload: Record<string, unknown> = {
        first_name: form.firstName.trim(),
        middle_name: form.middleName.trim() || null,
        last_name: form.lastName.trim(),
        gender: form.gender,
        birth_date: form.birthDate || null,
        birth_date_approx: form.birthDateApprox,
        death_date: form.isLiving ? null : form.deathDate || null,
        death_date_approx: form.isLiving ? false : form.deathDateApprox,
        is_living: form.isLiving,
        nicknames: form.nicknames.trim() || null,
      }

      // Structured birth place
      if (form.birthCity.trim()) {
        personPayload.birth_place = {
          city: form.birthCity.trim(),
          region: form.birthRegion.trim() || null,
          country: form.birthCountry.trim() || null,
        }
      }

      const personRes = await api.post("/persons", personPayload)
      const newPersonId: string = personRes.data.id

      // 2. Create all relationships
      for (const rel of relationships) {
        if (!rel.connectTo) continue

        let relationshipPayload: Record<string, unknown>

        switch (rel.relationshipType) {
          case "parent":
            relationshipPayload = {
              person_id: rel.connectTo,
              related_person_id: newPersonId,
              relationship: "parent_child",
            }
            break
          case "child":
            relationshipPayload = {
              person_id: newPersonId,
              related_person_id: rel.connectTo,
              relationship: "parent_child",
            }
            break
          case "spouse":
            relationshipPayload = {
              person_id: newPersonId,
              related_person_id: rel.connectTo,
              relationship: "spouse",
              marriage_date: rel.marriageDate || null,
            }
            break
        }

        await api.post("/relationships", relationshipPayload)
      }

      // 3. Show success briefly, then close
      setSuccess(true)
      setTimeout(() => {
        onCreated()
        onClose()
      }, 800)
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { detail?: string } } })?.response
                ?.data?.detail ?? "Failed to create family member"
      setApiError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-lg bg-white dark:bg-dark-card rounded-2xl shadow-2xl dark:shadow-black/30 p-8 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-sage-100 dark:hover:bg-dark-surface text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary/10 rounded-lg p-2">
            <TreePine className="h-5 w-5 text-primary-dark" />
          </div>
          <h2 className="text-xl font-bold text-earth-900 dark:text-dark-text">
            Add Family Member
          </h2>
        </div>

        {/* Success state */}
        {success && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle className="h-12 w-12 text-primary" />
            <p className="text-lg font-semibold text-earth-900 dark:text-dark-text">
              Member added!
            </p>
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1.5">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => updateField("firstName", e.target.value)}
                  className={`w-full rounded-lg border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text dark:placeholder:text-dark-text-muted/50 focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors ${
                    errors.firstName ? "border-red-400" : "border-gray-200 dark:border-dark-border"
                  }`}
                  placeholder="John"
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1.5">
                  Middle Name
                </label>
                <input
                  type="text"
                  value={form.middleName}
                  onChange={(e) => updateField("middleName", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text dark:placeholder:text-dark-text-muted/50 focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
                  placeholder="William"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1.5">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => updateField("lastName", e.target.value)}
                  className={`w-full rounded-lg border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text dark:placeholder:text-dark-text-muted/50 focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors ${
                    errors.lastName ? "border-red-400" : "border-gray-200 dark:border-dark-border"
                  }`}
                  placeholder="Thirlwall"
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.lastName}
                  </p>
                )}
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1.5">
                Gender
              </label>
              <select
                value={form.gender}
                onChange={(e) => updateField("gender", e.target.value as Gender)}
                className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            {/* Birth Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1.5">
                Birth Date
              </label>
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => updateField("birthDate", e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
              />
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-dark-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.birthDateApprox}
                  onChange={(e) =>
                    updateField("birthDateApprox", e.target.checked)
                  }
                  className="rounded border-gray-300 dark:border-dark-border text-primary-dark focus:ring-primary-dark/20 dark:bg-dark-surface"
                />
                Approximate date
              </label>
            </div>

            {/* Birth Place */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1.5">
                Birth Place
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form.birthCity}
                  onChange={(e) => updateField("birthCity", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text dark:placeholder:text-dark-text-muted/50 focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
                  placeholder="City"
                />
                <input
                  type="text"
                  value={form.birthRegion}
                  onChange={(e) => updateField("birthRegion", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text dark:placeholder:text-dark-text-muted/50 focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
                  placeholder="State/Province"
                />
                <input
                  type="text"
                  value={form.birthCountry}
                  onChange={(e) => updateField("birthCountry", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text dark:placeholder:text-dark-text-muted/50 focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
                  placeholder="Country"
                />
              </div>
            </div>

            {/* Nicknames */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1.5">
                Nicknames
              </label>
              <input
                type="text"
                value={form.nicknames}
                onChange={(e) => updateField("nicknames", e.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text dark:placeholder:text-dark-text-muted/50 focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
                placeholder="e.g. Jack, JT (comma-separated)"
              />
            </div>

            {/* Is Living */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-dark-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isLiving}
                  onChange={(e) => updateField("isLiving", e.target.checked)}
                  className="rounded border-gray-300 dark:border-dark-border text-primary-dark focus:ring-primary-dark/20 dark:bg-dark-surface"
                />
                Is Living
              </label>
            </div>

            {/* Death Date (hidden if living) */}
            {!form.isLiving && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-1.5">
                  Death Date
                </label>
                <input
                  type="date"
                  value={form.deathDate}
                  onChange={(e) => updateField("deathDate", e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
                />
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-dark-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.deathDateApprox}
                    onChange={(e) =>
                      updateField("deathDateApprox", e.target.checked)
                    }
                    className="rounded border-gray-300 dark:border-dark-border text-primary-dark focus:ring-primary-dark/20 dark:bg-dark-surface"
                  />
                  Approximate date
                </label>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-gray-100 dark:border-dark-border pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-earth-900 dark:text-dark-text">
                  Relationships
                </h3>
                <button
                  type="button"
                  onClick={addRelationship}
                  className="flex items-center gap-1 text-xs font-medium text-primary-dark hover:text-primary transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>

              <div className="space-y-4">
                {relationships.map((rel, index) => (
                  <div
                    key={index}
                    className="relative rounded-lg border border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-surface/50 p-3 space-y-3"
                  >
                    {relationships.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRelationship(index)}
                        className="absolute top-2 right-2 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-sage-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Connect to */}
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-dark-text-muted mb-1">
                        Connect to
                      </label>
                      <PersonCombobox
                        persons={existingPersons}
                        value={rel.connectTo}
                        onChange={(id) =>
                          updateRelationship(index, "connectTo", id)
                        }
                      />
                    </div>

                    {/* Relationship type (only when connected) */}
                    {rel.connectTo && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-dark-text-muted mb-1">
                            Relationship
                          </label>
                          <select
                            value={rel.relationshipType}
                            onChange={(e) =>
                              updateRelationship(
                                index,
                                "relationshipType",
                                e.target.value as RelationshipType,
                              )
                            }
                            className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2 px-3 text-sm dark:text-dark-text focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
                          >
                            <option value="parent">
                              Parent of selected person
                            </option>
                            <option value="child">
                              Child of selected person
                            </option>
                            <option value="spouse">
                              Spouse of selected person
                            </option>
                          </select>
                        </div>

                        {/* Marriage date (only for spouse) */}
                        {rel.relationshipType === "spouse" && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-dark-text-muted mb-1">
                              Marriage Date
                            </label>
                            <input
                              type="date"
                              value={rel.marriageDate}
                              onChange={(e) =>
                                updateRelationship(
                                  index,
                                  "marriageDate",
                                  e.target.value,
                                )
                              }
                              className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2 px-3 text-sm dark:text-dark-text focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* API error */}
            {apiError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {apiError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 border border-gray-200 dark:border-dark-border rounded-lg py-2.5 font-medium text-gray-600 dark:text-dark-text-muted hover:bg-gray-50 dark:hover:bg-dark-surface transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 bg-primary-dark text-white rounded-lg py-2.5 font-semibold hover:bg-primary hover:text-gray-900 transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Add Member"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

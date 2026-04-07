import { useState, useEffect, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { X, Edit, Loader2, Plus, Pencil, Trash2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../ui/sheet"
import { Separator } from "../ui/separator"
import { api } from "../../lib/api"
import { toast } from "../../stores/toastStore"
import type { Person } from "../../types/person"

interface EditPersonModalProps {
  person: Person
  personId: string
  open: boolean
  onClose: () => void
}

interface EditFormState {
  firstName: string
  preferredName: string
  middleName: string
  lastName: string
  maidenName: string
  suffix: string
  gender: "male" | "female" | "other" | "unknown"
  birthDate: string
  birthDateApprox: boolean
  deathDate: string
  deathDateApprox: boolean
  isLiving: boolean
  birthCity: string
  birthRegion: string
  birthCountry: string
  deathCity: string
  deathRegion: string
  deathCountry: string
  burialLocation: string
  occupation: string
  nicknames: string
  ethnicity: string
  religion: string
  education: string
  militaryService: string
  causeOfDeath: string
  bio: string
  notes: string
}

interface ResidenceLocationApi {
  id: string
  city: string
  region: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
}

interface ResidenceApi {
  id: string
  person_id: string
  location_id: string | null
  place_text: string | null
  location: ResidenceLocationApi | null
  from_date: string | null
  to_date: string | null
  is_current: boolean
  notes: string | null
}

interface ResidenceFormState {
  city: string
  region: string
  country: string
  fromDate: string
  toDate: string
  isCurrent: boolean
  notes: string
}

const emptyResidenceForm: ResidenceFormState = {
  city: "",
  region: "",
  country: "",
  fromDate: "",
  toDate: "",
  isCurrent: false,
  notes: "",
}

function personToFormState(person: Person): EditFormState {
  return {
    firstName: person.firstName,
    preferredName: person.preferredName ?? "",
    middleName: person.middleName ?? "",
    lastName: person.lastName,
    maidenName: person.maidenName ?? "",
    suffix: person.suffix ?? "",
    gender: person.gender,
    birthDate: person.birthDate ?? "",
    birthDateApprox: person.birthDateApprox,
    deathDate: person.deathDate ?? "",
    deathDateApprox: person.deathDateApprox,
    isLiving: person.isLiving,
    birthCity: person.birthLocation?.city ?? "",
    birthRegion: person.birthLocation?.region ?? "",
    birthCountry: person.birthLocation?.country ?? "",
    deathCity: person.deathLocation?.city ?? "",
    deathRegion: person.deathLocation?.region ?? "",
    deathCountry: person.deathLocation?.country ?? "",
    burialLocation: person.burialLocation ?? "",
    occupation: person.occupation ?? "",
    nicknames: person.nicknames ?? "",
    ethnicity: person.ethnicity ?? "",
    religion: person.religion ?? "",
    education: person.education ?? "",
    militaryService: person.militaryService ?? "",
    causeOfDeath: person.causeOfDeath ?? "",
    bio: person.bio ?? "",
    notes: person.notes ?? "",
  }
}

const inputClass = (hasError: boolean) =>
  `w-full rounded-lg border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text dark:placeholder:text-dark-text-muted/50 focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors ${
    hasError ? "border-red-400" : "border-gray-200 dark:border-dark-border"
  }`

const labelClass =
  "block text-sm font-medium text-gray-700 dark:text-dark-text mb-1.5"

const checkboxClass =
  "rounded border-gray-300 dark:border-dark-border text-primary-dark focus:ring-primary-dark/20 dark:bg-dark-surface"

const selectClass =
  "w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 px-4 text-sm dark:text-dark-text focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"

const sectionHeadingClass =
  "text-sm font-semibold text-earth-900 dark:text-dark-text"

export function EditPersonModal({
  person,
  personId,
  open,
  onClose,
}: EditPersonModalProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<EditFormState>(() =>
    personToFormState(person),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Residence state
  const [residenceForm, setResidenceForm] = useState<ResidenceFormState | null>(null)
  const [editingResidenceId, setEditingResidenceId] = useState<string | null>(null)
  const [residenceSaving, setResidenceSaving] = useState(false)

  // Fetch residences
  const { data: residences, refetch: refetchResidences } = useQuery<ResidenceApi[]>({
    queryKey: ["residences", personId],
    queryFn: async () => {
      const res = await api.get(`/persons/${personId}/residences`)
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: open,
  })

  useEffect(() => {
    if (open) {
      setForm(personToFormState(person))
      setErrors({})
      setApiError(null)
      setSubmitting(false)
      setResidenceForm(null)
      setEditingResidenceId(null)
    }
  }, [open, person])

  const updateField = useCallback(
    <K extends keyof EditFormState>(field: K, value: EditFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    },
    [],
  )

  const handleIsLivingChange = useCallback((checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      isLiving: checked,
      ...(checked
        ? {
            deathDate: "",
            deathDateApprox: false,
            deathCity: "",
            deathRegion: "",
            deathCountry: "",
            causeOfDeath: "",
            burialLocation: "",
          }
        : {}),
    }))
  }, [])

  const startAddResidence = useCallback(() => {
    setResidenceForm({ ...emptyResidenceForm })
    setEditingResidenceId(null)
  }, [])

  const startEditResidence = useCallback((r: ResidenceApi) => {
    setResidenceForm({
      city: r.location?.city ?? "",
      region: r.location?.region ?? "",
      country: r.location?.country ?? "",
      fromDate: r.from_date ?? "",
      toDate: r.to_date ?? "",
      isCurrent: r.is_current,
      notes: r.notes ?? "",
    })
    setEditingResidenceId(r.id)
  }, [])

  const cancelResidenceForm = useCallback(() => {
    setResidenceForm(null)
    setEditingResidenceId(null)
  }, [])

  const saveResidence = useCallback(async () => {
    if (!residenceForm || !residenceForm.city.trim()) return
    setResidenceSaving(true)
    try {
      const payload = {
        place: {
          city: residenceForm.city.trim(),
          region: residenceForm.region.trim() || null,
          country: residenceForm.country.trim() || null,
        },
        from_date: residenceForm.fromDate || null,
        to_date: residenceForm.toDate || null,
        is_current: residenceForm.isCurrent,
        notes: residenceForm.notes.trim() || null,
      }
      if (editingResidenceId) {
        await api.put(`/persons/${personId}/residences/${editingResidenceId}`, payload)
      } else {
        await api.post(`/persons/${personId}/residences`, payload)
      }
      await refetchResidences()
      setResidenceForm(null)
      setEditingResidenceId(null)
      toast.success(editingResidenceId ? "Residence updated" : "Residence added")
    } catch {
      toast.error("Failed to save residence")
    } finally {
      setResidenceSaving(false)
    }
  }, [residenceForm, editingResidenceId, personId, refetchResidences])

  const deleteResidence = useCallback(async (id: string) => {
    try {
      await api.delete(`/persons/${personId}/residences/${id}`)
      await refetchResidences()
      toast.success("Residence removed")
    } catch {
      toast.error("Failed to delete residence")
    }
  }, [personId, refetchResidences])

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
      const payload: Record<string, unknown> = {
        first_name: form.firstName.trim(),
        preferred_name: form.preferredName.trim() || null,
        middle_name: form.middleName.trim() || null,
        last_name: form.lastName.trim(),
        maiden_name: form.maidenName.trim() || null,
        suffix: form.suffix.trim() || null,
        gender: form.gender,
        birth_date: form.birthDate || null,
        birth_date_approx: form.birthDateApprox,
        is_living: form.isLiving,
        occupation: form.occupation.trim() || null,
        nicknames: form.nicknames.trim() || null,
        ethnicity: form.ethnicity.trim() || null,
        religion: form.religion.trim() || null,
        education: form.education.trim() || null,
        military_service: form.militaryService.trim() || null,
        bio: form.bio.trim() || null,
        notes: form.notes.trim() || null,
      }

      // Structured birth place
      if (form.birthCity.trim()) {
        payload.birth_place = {
          city: form.birthCity.trim(),
          region: form.birthRegion.trim() || null,
          country: form.birthCountry.trim() || null,
        }
      } else {
        payload.birth_place_text = null
      }

      if (form.isLiving) {
        payload.death_date = null
        payload.death_date_approx = false
        payload.death_place = null
        payload.death_place_text = null
        payload.cause_of_death = null
        payload.burial_location = null
      } else {
        payload.death_date = form.deathDate || null
        payload.death_date_approx = form.deathDateApprox
        payload.cause_of_death = form.causeOfDeath.trim() || null
        payload.burial_location = form.burialLocation.trim() || null

        // Structured death place
        if (form.deathCity.trim()) {
          payload.death_place = {
            city: form.deathCity.trim(),
            region: form.deathRegion.trim() || null,
            country: form.deathCountry.trim() || null,
          }
        } else {
          payload.death_place_text = null
        }
      }

      await api.put(`/persons/${personId}`, payload)
      await queryClient.invalidateQueries({ queryKey: ["person", personId] })
      await queryClient.invalidateQueries({ queryKey: ["map-places"] })

      toast.success("Profile updated")
      onClose()
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { detail?: string } } })?.response
                ?.data?.detail ?? "Failed to update profile"
      setApiError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-xl dark:bg-dark-card dark:border-dark-border"
      >
        <SheetHeader className="border-b border-sage-200 dark:border-dark-border pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg p-2">
                <Edit className="h-5 w-5 text-primary-dark" />
              </div>
              <div>
                <SheetTitle className="text-xl font-bold text-earth-900 dark:text-dark-text">
                  Edit Profile
                </SheetTitle>
                <SheetDescription className="text-sage-400 dark:text-dark-text-muted">
                  {person.firstName} {person.lastName}
                </SheetDescription>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-sage-100 dark:hover:bg-dark-surface text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </SheetHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            {/* Section 1: Basic Information */}
            <div className="space-y-4">
              <h3 className={sectionHeadingClass}>Basic Information</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    className={inputClass(!!errors.firstName)}
                    placeholder="John"
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>
                    Preferred Name
                    <span className="text-sage-300 font-normal ml-1">(goes by)</span>
                  </label>
                  <input
                    type="text"
                    value={form.preferredName}
                    onChange={(e) => updateField("preferredName", e.target.value)}
                    className={inputClass(false)}
                    placeholder="e.g., Lee, Bobby, etc."
                  />
                  <p className="mt-0.5 text-[10px] text-sage-300">If this person goes by a different name, it will be shown instead of their first name.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Middle Name</label>
                  <input
                    type="text"
                    value={form.middleName}
                    onChange={(e) => updateField("middleName", e.target.value)}
                    className={inputClass(false)}
                    placeholder="William"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    className={inputClass(!!errors.lastName)}
                    placeholder="Thirlwall"
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.lastName}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Maiden Name</label>
                  <input
                    type="text"
                    value={form.maidenName}
                    onChange={(e) => updateField("maidenName", e.target.value)}
                    className={inputClass(false)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Suffix</label>
                  <input
                    type="text"
                    value={form.suffix}
                    onChange={(e) => updateField("suffix", e.target.value)}
                    className={inputClass(false)}
                    placeholder="Jr., Sr., III"
                  />
                </div>
                <div>
                  <label className={labelClass}>Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) =>
                      updateField(
                        "gender",
                        e.target.value as EditFormState["gender"],
                      )
                    }
                    className={selectClass}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Nicknames</label>
                <input
                  type="text"
                  value={form.nicknames}
                  onChange={(e) => updateField("nicknames", e.target.value)}
                  className={inputClass(false)}
                  placeholder="e.g. Jack, JT (comma-separated)"
                />
              </div>
            </div>

            <Separator className="dark:bg-dark-border" />

            {/* Section 2: Dates & Status */}
            <div className="space-y-4">
              <h3 className={sectionHeadingClass}>Dates & Status</h3>

              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-dark-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isLiving}
                  onChange={(e) => handleIsLivingChange(e.target.checked)}
                  className={checkboxClass}
                />
                Is Living
              </label>

              <div>
                <label className={labelClass}>Birth Date</label>
                <input
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => updateField("birthDate", e.target.value)}
                  className={inputClass(false)}
                />
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-dark-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.birthDateApprox}
                    onChange={(e) =>
                      updateField("birthDateApprox", e.target.checked)
                    }
                    className={checkboxClass}
                  />
                  Approximate date
                </label>
              </div>

              {!form.isLiving && (
                <div>
                  <label className={labelClass}>Death Date</label>
                  <input
                    type="date"
                    value={form.deathDate}
                    onChange={(e) => updateField("deathDate", e.target.value)}
                    className={inputClass(false)}
                  />
                  <label className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-dark-text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.deathDateApprox}
                      onChange={(e) =>
                        updateField("deathDateApprox", e.target.checked)
                      }
                      className={checkboxClass}
                    />
                    Approximate date
                  </label>
                </div>
              )}
            </div>

            <Separator className="dark:bg-dark-border" />

            {/* Section 3: Places */}
            <div className="space-y-4">
              <h3 className={sectionHeadingClass}>Places</h3>

              <div>
                <label className={labelClass}>Birth Place</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={form.birthCity}
                    onChange={(e) => updateField("birthCity", e.target.value)}
                    className={inputClass(false)}
                    placeholder="City"
                  />
                  <input
                    type="text"
                    value={form.birthRegion}
                    onChange={(e) => updateField("birthRegion", e.target.value)}
                    className={inputClass(false)}
                    placeholder="State/Province"
                  />
                  <input
                    type="text"
                    value={form.birthCountry}
                    onChange={(e) =>
                      updateField("birthCountry", e.target.value)
                    }
                    className={inputClass(false)}
                    placeholder="Country"
                  />
                </div>
              </div>

              {!form.isLiving && (
                <>
                  <div>
                    <label className={labelClass}>Death Place</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={form.deathCity}
                        onChange={(e) =>
                          updateField("deathCity", e.target.value)
                        }
                        className={inputClass(false)}
                        placeholder="City"
                      />
                      <input
                        type="text"
                        value={form.deathRegion}
                        onChange={(e) =>
                          updateField("deathRegion", e.target.value)
                        }
                        className={inputClass(false)}
                        placeholder="State/Province"
                      />
                      <input
                        type="text"
                        value={form.deathCountry}
                        onChange={(e) =>
                          updateField("deathCountry", e.target.value)
                        }
                        className={inputClass(false)}
                        placeholder="Country"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Burial Location</label>
                    <input
                      type="text"
                      value={form.burialLocation}
                      onChange={(e) =>
                        updateField("burialLocation", e.target.value)
                      }
                      className={inputClass(false)}
                      placeholder="e.g. Mount Pleasant Cemetery"
                    />
                  </div>
                </>
              )}
            </div>

            <Separator className="dark:bg-dark-border" />

            {/* Section 3b: Residences */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className={sectionHeadingClass}>Residences</h3>
                {!residenceForm && (
                  <button
                    type="button"
                    onClick={startAddResidence}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary-dark hover:text-primary transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Residence
                  </button>
                )}
              </div>

              {/* Existing residences list */}
              {residences && residences.length > 0 && (
                <div className="space-y-2">
                  {residences.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between bg-sage-50 dark:bg-dark-surface rounded-lg border border-sage-100 dark:border-dark-border px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-earth-900 dark:text-dark-text truncate">
                          {[r.location?.city, r.location?.region, r.location?.country].filter(Boolean).join(", ") || r.place_text || "Unknown location"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {(r.from_date || r.to_date) && (
                            <span className="text-xs text-sage-400 dark:text-dark-text-muted">
                              {r.from_date ?? "?"} {"\u2013"} {r.to_date ?? "present"}
                            </span>
                          )}
                          {r.is_current && (
                            <span className="text-xs font-semibold text-primary-dark bg-primary/10 px-1.5 py-0.5 rounded">
                              Current
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditResidence(r)}
                          className="p-1.5 rounded-md hover:bg-sage-200 dark:hover:bg-dark-border text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteResidence(r.id)}
                          className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/20 text-sage-400 dark:text-dark-text-muted hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Inline add/edit form */}
              {residenceForm && (
                <div className="bg-sage-50 dark:bg-dark-surface rounded-lg border border-sage-200 dark:border-dark-border p-4 space-y-3">
                  <p className="text-xs font-semibold text-earth-900 dark:text-dark-text">
                    {editingResidenceId ? "Edit Residence" : "Add Residence"}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={residenceForm.city}
                      onChange={(e) => setResidenceForm((f) => f ? { ...f, city: e.target.value } : f)}
                      className={inputClass(false)}
                      placeholder="City"
                    />
                    <input
                      type="text"
                      value={residenceForm.region}
                      onChange={(e) => setResidenceForm((f) => f ? { ...f, region: e.target.value } : f)}
                      className={inputClass(false)}
                      placeholder="State/Province"
                    />
                    <input
                      type="text"
                      value={residenceForm.country}
                      onChange={(e) => setResidenceForm((f) => f ? { ...f, country: e.target.value } : f)}
                      className={inputClass(false)}
                      placeholder="Country"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-sage-400 dark:text-dark-text-muted mb-1">From</label>
                      <input
                        type="date"
                        value={residenceForm.fromDate}
                        onChange={(e) => setResidenceForm((f) => f ? { ...f, fromDate: e.target.value } : f)}
                        className={inputClass(false)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-sage-400 dark:text-dark-text-muted mb-1">To</label>
                      <input
                        type="date"
                        value={residenceForm.toDate}
                        onChange={(e) => setResidenceForm((f) => f ? { ...f, toDate: e.target.value } : f)}
                        className={inputClass(false)}
                        disabled={residenceForm.isCurrent}
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-dark-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={residenceForm.isCurrent}
                      onChange={(e) => setResidenceForm((f) => f ? { ...f, isCurrent: e.target.checked, toDate: e.target.checked ? "" : f.toDate } : f)}
                      className={checkboxClass}
                    />
                    Current residence
                  </label>

                  <div>
                    <label className="block text-xs text-sage-400 dark:text-dark-text-muted mb-1">Notes</label>
                    <textarea
                      value={residenceForm.notes}
                      onChange={(e) => setResidenceForm((f) => f ? { ...f, notes: e.target.value } : f)}
                      className={inputClass(false)}
                      rows={2}
                      placeholder="Optional notes..."
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={cancelResidenceForm}
                      className="flex-1 border border-gray-200 dark:border-dark-border rounded-lg py-2 text-sm font-medium text-gray-600 dark:text-dark-text-muted hover:bg-gray-50 dark:hover:bg-dark-card transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveResidence}
                      disabled={residenceSaving || !residenceForm.city.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-primary-dark text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary hover:text-gray-900 transition-colors disabled:opacity-50"
                    >
                      {residenceSaving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Residence"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {(!residences || residences.length === 0) && !residenceForm && (
                <p className="text-xs text-sage-400 dark:text-dark-text-muted">
                  No residences recorded. Click "Add Residence" to add one.
                </p>
              )}
            </div>

            <Separator className="dark:bg-dark-border" />

            {/* Section 4: Details */}
            <div className="space-y-4">
              <h3 className={sectionHeadingClass}>Details</h3>

              <div>
                <label className={labelClass}>Occupation</label>
                <input
                  type="text"
                  value={form.occupation}
                  onChange={(e) => updateField("occupation", e.target.value)}
                  className={inputClass(false)}
                  placeholder="e.g. Coal Miner, Teacher"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Ethnicity</label>
                  <input
                    type="text"
                    value={form.ethnicity}
                    onChange={(e) => updateField("ethnicity", e.target.value)}
                    className={inputClass(false)}
                    placeholder="e.g. English, Irish"
                  />
                </div>
                <div>
                  <label className={labelClass}>Religion</label>
                  <input
                    type="text"
                    value={form.religion}
                    onChange={(e) => updateField("religion", e.target.value)}
                    className={inputClass(false)}
                    placeholder="e.g. Anglican, Catholic"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Education</label>
                  <input
                    type="text"
                    value={form.education}
                    onChange={(e) => updateField("education", e.target.value)}
                    className={inputClass(false)}
                    placeholder="e.g. Oxford University"
                  />
                </div>
                <div>
                  <label className={labelClass}>Military Service</label>
                  <input
                    type="text"
                    value={form.militaryService}
                    onChange={(e) =>
                      updateField("militaryService", e.target.value)
                    }
                    className={inputClass(false)}
                    placeholder="e.g. Royal Navy, 1914-1918"
                  />
                </div>
              </div>

              {!form.isLiving && (
                <div>
                  <label className={labelClass}>Cause of Death</label>
                  <input
                    type="text"
                    value={form.causeOfDeath}
                    onChange={(e) =>
                      updateField("causeOfDeath", e.target.value)
                    }
                    className={inputClass(false)}
                  />
                </div>
              )}
            </div>

            <Separator className="dark:bg-dark-border" />

            {/* Section 5: Bio & Notes */}
            <div className="space-y-4">
              <h3 className={sectionHeadingClass}>Bio & Notes</h3>

              <div>
                <label className={labelClass}>Bio</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => updateField("bio", e.target.value)}
                  className={inputClass(false)}
                  rows={4}
                  placeholder="A brief biography..."
                />
              </div>

              <div>
                <label className={labelClass}>Private Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  className={inputClass(false)}
                  rows={3}
                  placeholder="Internal notes (not shown to viewers)"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <SheetFooter className="border-t border-sage-200 dark:border-dark-border pt-4">
            {apiError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-3 text-sm text-red-700 dark:text-red-400 mb-2">
                {apiError}
              </div>
            )}
            <div className="flex items-center gap-3">
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
                  "Save Changes"
                )}
              </button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

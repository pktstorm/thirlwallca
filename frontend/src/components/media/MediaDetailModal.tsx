import { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { X, RotateCw, RotateCcw, Save, Trash2, Calendar, FileText, Users, Plus, Search, Loader2, Check, MapPin } from "lucide-react"
import { api } from "../../lib/api"
import { useAuthStore } from "../../stores/authStore"
import type { Media } from "../../types/media"

interface MediaDetailModalProps {
  media: Media
  onClose: () => void
}

interface PersonResult {
  id: string; first_name: string; last_name: string
  birth_date: string | null; death_date: string | null
  birth_place_text: string | null; is_living: boolean
}

interface MediaTag {
  person_id: string; person_name: string
}

export function MediaDetailModal({ media, onClose }: MediaDetailModalProps) {
  const user = useAuthStore((s) => s.user)
  const canEdit = user?.role === "admin" || user?.role === "editor"
  const queryClient = useQueryClient()

  const [rotation, setRotation] = useState(0)
  const [imageVersion, setImageVersion] = useState(0)
  const [title, setTitle] = useState(media.title ?? "")
  const [description, setDescription] = useState(media.description ?? "")
  const [dateTaken, setDateTaken] = useState(media.dateTaken ?? "")
  const [dateApprox, setDateApprox] = useState(media.dateTakenApprox)
  const [editing, setEditing] = useState(false)
  const [personSearch, setPersonSearch] = useState("")
  const [saved, setSaved] = useState(false)
  const [locationCity, setLocationCity] = useState("")
  const [locationRegion, setLocationRegion] = useState("")
  const [locationCountry, setLocationCountry] = useState("")
  const [locationName, setLocationName] = useState<string | null>(null)

  // Fetch location if exists
  useQuery({
    queryKey: ["media-location", media.locationId],
    queryFn: async () => {
      const res = await api.get(`/locations/${media.locationId}`)
      const loc = res.data
      setLocationName([loc.name, loc.region, loc.country].filter(Boolean).join(", "))
      setLocationCity(loc.name ?? "")
      setLocationRegion(loc.region ?? "")
      setLocationCountry(loc.country ?? "")
      return loc
    },
    enabled: !!media.locationId,
  })

  // Fetch persons tagged in this media
  const { data: tags } = useQuery<MediaTag[]>({
    queryKey: ["media-tags", media.id],
    queryFn: async () => {
      const res = await api.get(`/media/${media.id}/tags`)
      return res.data
    },
  })

  // Search persons for tagging
  const { data: searchResults } = useQuery<PersonResult[]>({
    queryKey: ["media-tag-search", personSearch],
    queryFn: async () => {
      const res = await api.get("/search", { params: { q: personSearch, limit: 5 } })
      return res.data
    },
    enabled: personSearch.trim().length >= 2 && editing,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Create or find location if city is provided
      let locationId = media.locationId
      if (locationCity.trim()) {
        const locRes = await api.post("/locations", {
          name: locationCity.trim(),
          region: locationRegion.trim() || null,
          country: locationCountry.trim() || null,
        })
        locationId = locRes.data.id
      }

      await api.put(`/media/${media.id}`, {
        title: title.trim() || null,
        description: description.trim() || null,
        date_taken: dateTaken || null,
        date_taken_approx: dateApprox,
        location_id: locationId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] })
      queryClient.invalidateQueries({ queryKey: ["person-media"] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/media/${media.id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] })
      queryClient.invalidateQueries({ queryKey: ["person-media"] })
      onClose()
    },
  })

  const tagMutation = useMutation({
    mutationFn: async (personId: string) => {
      try {
        await api.post(`/media/${media.id}/tag`, { person_id: personId })
      } catch (err: any) {
        // 409 = already tagged — not an error, just refresh
        if (err.response?.status === 409) return
        throw err
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-tags", media.id] })
      setPersonSearch("")
    },
    onError: () => {
      // Also refresh on error in case tag exists
      queryClient.invalidateQueries({ queryKey: ["media-tags", media.id] })
    },
  })

  const untagMutation = useMutation({
    mutationFn: async (personId: string) => {
      await api.delete(`/media/${media.id}/tag/${personId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media-tags", media.id] })
    },
  })

  const rotateMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/media/${media.id}/rotate`, null, { params: { degrees: rotation } })
    },
    onSuccess: () => {
      setRotation(0)
      setImageVersion((v) => v + 1)
      // Force refetch all media queries so gallery thumbnails update
      queryClient.invalidateQueries({ queryKey: ["media"] })
      queryClient.invalidateQueries({ queryKey: ["person-media"] })
      queryClient.invalidateQueries({ queryKey: ["media", "all-counts"] })
      // Close and reopen to force image reload in the gallery
      onClose()
    },
  })

  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose()
  }, [onClose])

  // Register keyboard handler
  useState(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  })

  const taggedIds = new Set((tags ?? []).map((t) => t.person_id))

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex" onClick={onClose}>
      <div className="flex flex-col lg:flex-row w-full h-full" onClick={(e) => e.stopPropagation()}>
        {/* Image area */}
        <div className="flex-1 flex items-center justify-center p-4 relative min-h-[300px] lg:min-h-0">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10">
            <X className="h-5 w-5" />
          </button>

          {/* Rotation controls — top-left, always visible */}
          {canEdit && (
            <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
              <button onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                className="p-2.5 rounded-xl bg-black/50 hover:bg-black/70 text-white transition-colors backdrop-blur-sm" title="Rotate left">
                <RotateCcw className="h-5 w-5" />
              </button>
              <button onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-2.5 rounded-xl bg-black/50 hover:bg-black/70 text-white transition-colors backdrop-blur-sm" title="Rotate right">
                <RotateCw className="h-5 w-5" />
              </button>
              {rotation !== 0 && (
                <button onClick={() => rotateMutation.mutate()}
                  disabled={rotateMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary/90 hover:bg-primary text-earth-900 text-xs font-bold transition-colors backdrop-blur-sm">
                  {rotateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Rotation
                </button>
              )}
            </div>
          )}

          <img
            src={`${media.url}${imageVersion ? `?v=${imageVersion}` : ""}`}
            alt={media.title ?? "Photo"}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </div>

        {/* Details panel */}
        <div className="w-full lg:w-96 bg-white dark:bg-dark-card border-t lg:border-t-0 lg:border-l border-sage-200 dark:border-dark-border overflow-y-auto flex-shrink-0">
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-earth-900 dark:text-dark-text">Details</h2>
              {canEdit && !editing && (
                <button onClick={() => setEditing(true)}
                  className="text-xs font-medium text-primary-dark hover:text-primary transition-colors">Edit</button>
              )}
              {editing && (
                <div className="flex items-center gap-2">
                  <button onClick={() => { saveMutation.mutate(); setEditing(false) }}
                    className="flex items-center gap-1 text-xs font-medium text-primary-dark hover:text-primary transition-colors">
                    {saved ? <Check className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                    {saved ? "Saved" : "Save"}
                  </button>
                  <button onClick={() => setEditing(false)} className="text-xs text-sage-400">Cancel</button>
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-sage-400 mb-1 block">Title</label>
              {editing ? (
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
              ) : (
                <p className="text-sm text-earth-900 dark:text-dark-text">{media.title || "Untitled"}</p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-sage-400 mb-1 block flex items-center gap-1">
                <FileText className="h-3 w-3" /> Notes
              </label>
              {editing ? (
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  placeholder="Add notes about this photo..."
                  className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20 resize-none" />
              ) : (
                <p className="text-sm text-sage-400 dark:text-dark-text-muted">{media.description || "No notes"}</p>
              )}
            </div>

            {/* Date taken */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-sage-400 mb-1 block flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Date Taken
              </label>
              {editing ? (
                <div className="flex items-center gap-2">
                  <input type="date" value={dateTaken} onChange={(e) => setDateTaken(e.target.value)}
                    className="flex-1 rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none" />
                  <label className="flex items-center gap-1 text-xs text-sage-400">
                    <input type="checkbox" checked={dateApprox} onChange={(e) => setDateApprox(e.target.checked)}
                      className="rounded border-sage-300 text-primary-dark" /> Approx
                  </label>
                </div>
              ) : (
                <p className="text-sm text-sage-400 dark:text-dark-text-muted">
                  {media.dateTaken ? `${media.dateTakenApprox ? "~" : ""}${new Date(media.dateTaken).toLocaleDateString()}` : "Unknown"}
                </p>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-sage-400 mb-1 block flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Location
              </label>
              {editing ? (
                <div className="grid grid-cols-3 gap-1.5">
                  <input type="text" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} placeholder="City"
                    className="rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-2.5 py-1.5 text-xs focus:outline-none" />
                  <input type="text" value={locationRegion} onChange={(e) => setLocationRegion(e.target.value)} placeholder="Region"
                    className="rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-2.5 py-1.5 text-xs focus:outline-none" />
                  <input type="text" value={locationCountry} onChange={(e) => setLocationCountry(e.target.value)} placeholder="Country"
                    className="rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-2.5 py-1.5 text-xs focus:outline-none" />
                </div>
              ) : (
                <p className="text-sm text-sage-400 dark:text-dark-text-muted">{locationName || "Unknown"}</p>
              )}
            </div>

            {/* People tagged */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-sage-400 mb-1 block flex items-center gap-1">
                <Users className="h-3 w-3" /> People
              </label>
              {tags && tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((t) => (
                    <span key={t.person_id} className="flex items-center gap-1 bg-primary/10 text-primary-dark text-xs font-medium px-2 py-0.5 rounded-full">
                      {t.person_name}
                      {editing && (
                        <button onClick={() => untagMutation.mutate(t.person_id)} className="hover:text-red-500">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {editing && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sage-400" />
                  <input type="text" value={personSearch} onChange={(e) => setPersonSearch(e.target.value)}
                    placeholder="Tag a person..."
                    className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface pl-9 pr-3 py-2 text-sm focus:outline-none" />
                  {searchResults && searchResults.filter((p) => !taggedIds.has(p.id)).length > 0 && (
                    <div className="absolute z-10 mt-1 w-full border border-sage-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card overflow-hidden shadow-lg">
                      {searchResults.filter((p) => !taggedIds.has(p.id)).map((p) => {
                        const birthYear = p.birth_date?.split("-")[0]
                        const deathYear = p.death_date?.split("-")[0]
                        const dateHint = birthYear ? (p.is_living ? `b. ${birthYear}` : `${birthYear}\u2013${deathYear ?? "?"}`) : null
                        return (
                          <button key={p.id} onClick={() => tagMutation.mutate(p.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-sage-50 dark:hover:bg-dark-surface">
                            <Plus className="h-3 w-3 text-primary flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-earth-900 dark:text-dark-text">{p.first_name} {p.last_name}</p>
                              {(dateHint || p.birth_place_text) && (
                                <p className="text-[10px] text-sage-400 truncate">{[dateHint, p.birth_place_text].filter(Boolean).join(" \u2022 ")}</p>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              {!editing && (!tags || tags.length === 0) && (
                <p className="text-sm text-sage-300">No people tagged</p>
              )}
            </div>

            {/* File info */}
            <div className="pt-3 border-t border-sage-100 dark:border-dark-border space-y-1">
              <p className="text-[10px] text-sage-300">
                {media.mimeType} {media.fileSizeBytes ? `\u2022 ${Math.round(media.fileSizeBytes / 1024)}KB` : ""}
              </p>
              <p className="text-[10px] text-sage-300">
                Uploaded {new Date(media.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Delete */}
            {canEdit && (
              <div className="pt-3 border-t border-sage-100 dark:border-dark-border">
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => deleteMutation.mutate()}
                      className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600">
                      {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm Delete"}
                    </button>
                    <button onClick={() => setConfirmDelete(false)} className="text-xs text-sage-400">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors">
                    <Trash2 className="h-3 w-3" /> Delete Photo
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

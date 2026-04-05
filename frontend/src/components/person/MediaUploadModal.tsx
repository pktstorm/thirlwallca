import { useState, useRef, useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { X, Upload, Loader2, Plus, Search, MapPin, Calendar, FileText } from "lucide-react"
import { api } from "../../lib/api"
import { useAuthStore } from "../../stores/authStore"

interface MediaUploadModalProps {
  open: boolean
  onClose: () => void
  defaultPersonId?: string
  defaultPersonName?: string
}

interface PersonResult {
  id: string; first_name: string; last_name: string; profile_photo_url: string | null
}

export function MediaUploadModal({ open, onClose, defaultPersonId }: MediaUploadModalProps) {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dateTaken, setDateTaken] = useState("")
  const [dateApprox, setDateApprox] = useState(false)
  const [locationCity, setLocationCity] = useState("")
  const [locationRegion, setLocationRegion] = useState("")
  const [locationCountry, setLocationCountry] = useState("")
  const [personIds, setPersonIds] = useState<string[]>(defaultPersonId ? [defaultPersonId] : [])
  const [personSearch, setPersonSearch] = useState("")
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Search persons to tag
  const { data: searchResults } = useQuery<PersonResult[]>({
    queryKey: ["media-person-search", personSearch],
    queryFn: async () => {
      const res = await api.get("/search", { params: { q: personSearch, limit: 5 } })
      return res.data
    },
    enabled: personSearch.trim().length >= 2,
  })

  // Get names for tagged persons
  const { data: taggedPersons } = useQuery<PersonResult[]>({
    queryKey: ["media-tagged-persons", personIds],
    queryFn: async () => {
      const results = await Promise.all(
        personIds.map((id) => api.get(`/persons/${id}`).then((r) => r.data))
      )
      return results
    },
    enabled: personIds.length > 0,
  })

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }, [])

  const handleUpload = useCallback(async () => {
    if (!file || !user) return
    setUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      // 1. Get presigned URL
      const { data: uploadData } = await api.post("/media/upload-url", {
        filename: file.name,
        content_type: file.type,
      })

      // 2. Upload to S3
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", uploadData.upload_url)
        xhr.setRequestHeader("Content-Type", file.type)
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100))
        }
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`))
        xhr.onerror = () => reject(new Error("Upload failed"))
        xhr.send(file)
      })

      // 3. Resolve location if provided
      let locationId: string | null = null
      if (locationCity.trim()) {
        const locRes = await api.post("/locations", {
          name: locationCity.trim(),
          region: locationRegion.trim() || null,
          country: locationCountry.trim() || null,
        })
        locationId = locRes.data.id
      }

      // 4. Create media record
      const { data: media } = await api.post("/media", {
        title: title.trim() || file.name,
        description: description.trim() || null,
        media_type: file.type.startsWith("image/") ? "photo" : "document",
        s3_key: uploadData.s3_key,
        s3_bucket: "thirlwall-media",
        file_size_bytes: file.size,
        mime_type: file.type,
        date_taken: dateTaken || null,
        date_taken_approx: dateApprox,
        location_id: locationId,
        status: "ready",
        uploaded_by: user.id,
      })

      // 5. Tag persons
      for (const pid of personIds) {
        await api.post(`/media/${media.id}/tag`, { person_id: pid })
      }

      // 6. Invalidate and close
      queryClient.invalidateQueries({ queryKey: ["person-media"] })
      queryClient.invalidateQueries({ queryKey: ["media"] })
      resetForm()
      onClose()
    } catch (err: any) {
      setError(err.message || "Upload failed")
    } finally {
      setUploading(false)
    }
  }, [file, user, title, description, dateTaken, dateApprox, locationCity, locationRegion, locationCountry, personIds, queryClient, onClose])

  const resetForm = useCallback(() => {
    setFile(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setTitle("")
    setDescription("")
    setDateTaken("")
    setDateApprox(false)
    setLocationCity("")
    setLocationRegion("")
    setLocationCountry("")
    setPersonIds(defaultPersonId ? [defaultPersonId] : [])
    setPersonSearch("")
    setUploadProgress(0)
    setError(null)
  }, [preview, defaultPersonId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-dark-card rounded-2xl shadow-xl border border-sage-200 dark:border-dark-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sage-200 dark:border-dark-border">
          <h2 className="text-lg font-bold text-earth-900 dark:text-dark-text">Upload Photo</h2>
          <button onClick={onClose} className="p-1 text-sage-400 hover:text-earth-900 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-lg px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          {/* File picker */}
          {!file ? (
            <button onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-sage-200 dark:border-dark-border rounded-xl p-8 text-center hover:border-primary/40 transition-colors">
              <Upload className="h-8 w-8 text-sage-300 mx-auto mb-2" />
              <p className="text-sm text-sage-400">Click to select a photo or document</p>
            </button>
          ) : (
            <div className="relative">
              {preview && <img src={preview} alt="Preview" className="w-full max-h-48 object-contain rounded-lg border border-sage-200" />}
              <button onClick={resetForm} className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileChange} />

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-sage-600 dark:text-dark-text-muted mb-1">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Photo title or description"
              className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-sage-600 dark:text-dark-text-muted mb-1 flex items-center gap-1">
              <FileText className="h-3 w-3" /> Notes
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="Any additional notes about this photo..."
              className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20 resize-none" />
          </div>

          {/* Date taken */}
          <div>
            <label className="block text-xs font-medium text-sage-600 dark:text-dark-text-muted mb-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Date Taken
            </label>
            <div className="flex items-center gap-2">
              <input type="date" value={dateTaken} onChange={(e) => setDateTaken(e.target.value)}
                className="flex-1 rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
              <label className="flex items-center gap-1.5 text-xs text-sage-400">
                <input type="checkbox" checked={dateApprox} onChange={(e) => setDateApprox(e.target.checked)}
                  className="rounded border-sage-300 text-primary-dark" />
                Approx
              </label>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-medium text-sage-600 dark:text-dark-text-muted mb-1 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Location
            </label>
            <div className="grid grid-cols-3 gap-2">
              <input type="text" value={locationCity} onChange={(e) => setLocationCity(e.target.value)} placeholder="City"
                className="rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none" />
              <input type="text" value={locationRegion} onChange={(e) => setLocationRegion(e.target.value)} placeholder="Region"
                className="rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none" />
              <input type="text" value={locationCountry} onChange={(e) => setLocationCountry(e.target.value)} placeholder="Country"
                className="rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none" />
            </div>
          </div>

          {/* Tag people */}
          <div>
            <label className="block text-xs font-medium text-sage-600 dark:text-dark-text-muted mb-1">People in this Photo</label>
            {taggedPersons && taggedPersons.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {taggedPersons.map((p) => (
                  <span key={p.id} className="flex items-center gap-1 bg-primary/10 text-primary-dark text-xs font-medium px-2 py-0.5 rounded-full">
                    {p.first_name} {p.last_name}
                    <button onClick={() => setPersonIds(personIds.filter((id) => id !== p.id))} className="hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sage-400" />
              <input type="text" value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} placeholder="Search to tag people..."
                className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
            </div>
            {searchResults && searchResults.filter((p) => !personIds.includes(p.id)).length > 0 && (
              <div className="mt-1 border border-sage-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card overflow-hidden">
                {searchResults.filter((p) => !personIds.includes(p.id)).slice(0, 5).map((p) => (
                  <button key={p.id} onClick={() => { setPersonIds([...personIds, p.id]); setPersonSearch("") }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-sage-50 dark:hover:bg-dark-surface">
                    <Plus className="h-3 w-3 text-primary" />
                    {p.first_name} {p.last_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-sage-200 dark:border-dark-border flex items-center justify-between">
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-sage-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading {uploadProgress}%
            </div>
          )}
          {!uploading && <div />}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm text-sage-400">Cancel</button>
            <button onClick={handleUpload} disabled={!file || uploading}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-dark text-white text-sm font-medium rounded-lg hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50">
              <Upload className="h-4 w-4" />
              Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

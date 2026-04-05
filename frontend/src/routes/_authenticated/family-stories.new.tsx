import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Save, Plus, X, Search, Loader2 } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"

export const Route = createFileRoute("/_authenticated/family-stories/new")({
  component: NewFamilyStoryPage,
})

interface PersonResult {
  id: string; first_name: string; last_name: string; profile_photo_url: string | null
}

function NewFamilyStoryPage() {
  const navigate = useNavigate()

  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [content, setContent] = useState("")
  const [category, setCategory] = useState("history")
  const [coverImageUrl, setCoverImageUrl] = useState("")
  const [externalUrl, setExternalUrl] = useState("")
  const [published, setPublished] = useState(false)
  const [personIds, setPersonIds] = useState<string[]>([])
  const [personSearch, setPersonSearch] = useState("")
  const [images, setImages] = useState<{ image_url: string; caption: string }[]>([])

  // Search persons to link
  const { data: searchResults } = useQuery<PersonResult[]>({
    queryKey: ["person-search-story", personSearch],
    queryFn: async () => {
      const res = await api.get("/search", { params: { q: personSearch, limit: 5 } })
      return res.data
    },
    enabled: personSearch.trim().length >= 2,
  })

  const filteredResults = searchResults?.filter((p) => !personIds.includes(p.id)) ?? []

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/family-stories", {
        title, subtitle: subtitle || null, content, category,
        cover_image_url: coverImageUrl || null,
        external_url: externalUrl || null,
        published, person_ids: personIds,
        images: images.filter((i) => i.image_url.trim()).map((i, idx) => ({
          image_url: i.image_url, caption: i.caption || null, sort_order: idx,
        })),
      })
      return res.data
    },
    onSuccess: (data) => {
      navigate({ to: "/family-stories/$storyId", params: { storyId: data.slug } } as any)
    },
  })

  // Get names of linked persons
  const { data: linkedPersons } = useQuery<PersonResult[]>({
    queryKey: ["linked-persons", personIds],
    queryFn: async () => {
      const results = await Promise.all(
        personIds.map((id) => api.get(`/persons/${id}`).then((r) => r.data))
      )
      return results
    },
    enabled: personIds.length > 0,
  })

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      <AppHeader />
      <div className="max-w-3xl mx-auto px-4 pt-20 pb-20 sm:pt-24 sm:pb-12">
        <h1 className="text-2xl font-bold text-earth-900 dark:text-dark-text mb-6">New Family Story</h1>

        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-sage-600 dark:text-dark-text-muted mb-1">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Thirlwall Castle"
              className="w-full rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-medium text-sage-600 dark:text-dark-text-muted mb-1">Subtitle</label>
            <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
              placeholder="A brief description"
              className="w-full rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-sage-600 dark:text-dark-text-muted mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-4 py-3 text-sm focus:outline-none">
                <option value="history">History</option>
                <option value="place">Place</option>
                <option value="event">Event</option>
                <option value="heritage">Heritage</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Published */}
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)}
                  className="rounded border-sage-300 text-primary-dark" />
                <span className="text-sm text-earth-900 dark:text-dark-text">Publish immediately</span>
              </label>
            </div>
          </div>

          {/* Cover image URL */}
          <div>
            <label className="block text-sm font-medium text-sage-600 dark:text-dark-text-muted mb-1">Cover Image URL</label>
            <input type="url" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
            {coverImageUrl && (
              <img src={coverImageUrl} alt="Preview" className="mt-2 rounded-lg max-h-40 object-cover border border-sage-200" />
            )}
          </div>

          {/* External URL */}
          <div>
            <label className="block text-sm font-medium text-sage-600 dark:text-dark-text-muted mb-1">External Link (Wikipedia, etc.)</label>
            <input type="url" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://en.wikipedia.org/wiki/..."
              className="w-full rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-sage-600 dark:text-dark-text-muted mb-1">Story Content *</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              rows={12} placeholder="Write the story... Use blank lines to separate paragraphs."
              className="w-full rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20 resize-y font-serif leading-relaxed" />
          </div>

          {/* Link People */}
          <div>
            <label className="block text-sm font-medium text-sage-600 dark:text-dark-text-muted mb-1">People Mentioned</label>
            {/* Linked persons */}
            {linkedPersons && linkedPersons.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {linkedPersons.map((p) => (
                  <span key={p.id} className="flex items-center gap-1.5 bg-primary/10 text-primary-dark text-xs font-medium px-2.5 py-1 rounded-full">
                    {p.first_name} {p.last_name}
                    <button onClick={() => setPersonIds(personIds.filter((id) => id !== p.id))} className="hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sage-400" />
              <input type="text" value={personSearch} onChange={(e) => setPersonSearch(e.target.value)}
                placeholder="Search for a person to link..."
                className="w-full rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
            </div>
            {filteredResults.length > 0 && (
              <div className="mt-1 border border-sage-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-card overflow-hidden">
                {filteredResults.map((p) => (
                  <button key={p.id} onClick={() => { setPersonIds([...personIds, p.id]); setPersonSearch("") }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-sage-50 dark:hover:bg-dark-surface">
                    <Plus className="h-3 w-3 text-primary" />
                    {p.first_name} {p.last_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Additional Images */}
          <div>
            <label className="block text-sm font-medium text-sage-600 dark:text-dark-text-muted mb-1">Additional Images</label>
            {images.map((img, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input type="url" value={img.image_url} onChange={(e) => { const u = [...images]; u[i] = { ...u[i]!, image_url: e.target.value }; setImages(u) }}
                  placeholder="Image URL" className="flex-1 rounded-lg border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-3 py-2 text-sm focus:outline-none" />
                <input type="text" value={img.caption} onChange={(e) => { const u = [...images]; u[i] = { ...u[i]!, caption: e.target.value }; setImages(u) }}
                  placeholder="Caption" className="flex-1 rounded-lg border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-3 py-2 text-sm focus:outline-none" />
                <button onClick={() => setImages(images.filter((_, j) => j !== i))} className="p-2 text-sage-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button onClick={() => setImages([...images, { image_url: "", caption: "" }])}
              className="text-xs text-primary-dark hover:text-primary flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add image
            </button>
          </div>

          {/* Save */}
          <div className="flex justify-end gap-3 pt-4 border-t border-sage-200 dark:border-dark-border">
            <button onClick={() => navigate({ to: "/family-stories" })}
              className="px-4 py-2.5 text-sm text-sage-400 hover:text-earth-900 transition-colors">Cancel</button>
            <button onClick={() => createMutation.mutate()}
              disabled={!title.trim() || !content.trim() || createMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-dark text-white font-medium text-sm rounded-xl hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {published ? "Publish Story" : "Save Draft"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

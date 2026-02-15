import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect, useCallback, useRef } from "react"
import {
  ArrowLeft,
  Save,
  Eye,
  Image,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { Breadcrumbs } from "../../components/layout/Breadcrumbs"
import { useAuthStore } from "../../stores/authStore"
import type { Story } from "../../types/story"

export const Route = createFileRoute(
  "/_authenticated/person/$personId_/story-edit",
)({
  component: StoryEditorPage,
})

// ── API response types (snake_case) ──

interface PersonApiResponse {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  maiden_name: string | null
  suffix: string | null
  gender: string
  birth_date: string | null
  birth_date_approx: boolean
  death_date: string | null
  death_date_approx: boolean
  is_living: boolean
  bio: string | null
  occupation: string | null
  profile_photo_url: string | null
  created_at: string
  updated_at: string
}

interface StoryApiResponse {
  id: string
  title: string
  subtitle: string | null
  content: unknown
  cover_image_url: string | null
  author_id: string
  published: boolean
  created_at: string
  updated_at: string
}

// ── Mappers ──

function mapApiStory(data: StoryApiResponse): Story {
  return {
    id: data.id,
    title: data.title,
    subtitle: data.subtitle,
    content: data.content,
    coverImageUrl: data.cover_image_url,
    authorId: data.author_id,
    published: data.published,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

function buildPersonName(data: PersonApiResponse): string {
  return [data.first_name, data.middle_name, data.last_name, data.suffix]
    .filter(Boolean)
    .join(" ")
}

// ── Content helpers ──

function extractTextFromContent(content: unknown): string {
  if (!content) return ""
  if (typeof content === "string") return content
  if (typeof content === "object" && content !== null && "text" in content) {
    return String((content as { text: string }).text)
  }
  // Fallback: try to stringify for display
  try {
    return JSON.stringify(content)
  } catch {
    return ""
  }
}

function wrapTextAsContent(text: string): { text: string } {
  return { text }
}

// ── Toast notification ──

type ToastType = "success" | "error"

interface Toast {
  message: string
  type: ToastType
}

function ToastNotification({
  toast,
  onClose,
}: {
  toast: Toast
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg border backdrop-blur-sm transition-all ${
        toast.type === "success"
          ? "bg-primary/10 border-primary/30 text-primary-dark dark:text-primary"
          : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
      }`}
    >
      {toast.type === "success" ? (
        <Check className="h-5 w-5 flex-shrink-0" />
      ) : (
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
      )}
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  )
}

// ── Auto-save indicator ──

type SaveStatus = "idle" | "saving" | "saved" | "error"

function AutoSaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null

  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      {status === "saving" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-sage-400" />
          <span className="text-sage-400">Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3.5 w-3.5 text-primary" />
          <span className="text-primary-dark">Saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-3.5 w-3.5 text-red-500" />
          <span className="text-red-500">Save failed</span>
        </>
      )}
    </div>
  )
}

// ── Main Page ──

function StoryEditorPage() {
  const { personId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  // Redirect viewers away
  useEffect(() => {
    if (user && user.role === "viewer") {
      navigate({ to: "/person/$personId", params: { personId } })
    }
  }, [user, navigate, personId])

  // ── Form state ──
  const [title, setTitle] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [coverImageUrl, setCoverImageUrl] = useState("")
  const [contentText, setContentText] = useState("")
  const [published, setPublished] = useState(false)
  const [formInitialized, setFormInitialized] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch person for breadcrumbs ──
  const { data: person } = useQuery({
    queryKey: ["person", personId],
    queryFn: async () => {
      const res = await api.get<PersonApiResponse>(`/persons/${personId}`)
      return res.data
    },
  })

  const personName = person ? buildPersonName(person) : "..."

  // ── Fetch existing story for this person ──
  const {
    data: existingStory,
    isLoading: storyLoading,
    isError: storyError,
  } = useQuery({
    queryKey: ["stories", "person", personId],
    queryFn: async () => {
      const res = await api.get<StoryApiResponse[]>("/stories/", {
        params: { person_id: personId },
      })
      if (res.data.length > 0) {
        return mapApiStory(res.data[0]!)
      }
      return null
    },
  })

  // Initialize form when existing story loads
  useEffect(() => {
    if (formInitialized) return
    if (storyLoading) return

    if (existingStory) {
      setTitle(existingStory.title ?? "")
      setSubtitle(existingStory.subtitle ?? "")
      setCoverImageUrl(existingStory.coverImageUrl ?? "")
      setContentText(extractTextFromContent(existingStory.content))
      setPublished(existingStory.published)
    }
    setFormInitialized(true)
  }, [existingStory, storyLoading, formInitialized])

  // ── Create story mutation ──
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated")

      const res = await api.post<StoryApiResponse>("/stories/", {
        title,
        subtitle: subtitle || null,
        content: wrapTextAsContent(contentText),
        cover_image_url: coverImageUrl || null,
        author_id: user.id,
        published,
      })
      const story = mapApiStory(res.data)

      // Link story to person
      await api.post(`/stories/${story.id}/persons/${personId}`)

      return story
    },
    onSuccess: (story) => {
      queryClient.invalidateQueries({
        queryKey: ["stories", "person", personId],
      })
      setSaveStatus("saved")
      setToast({ message: "Story created successfully!", type: "success" })
      // Re-fetch so further saves become updates
      queryClient.setQueryData(["stories", "person", personId], story)
    },
    onError: () => {
      setSaveStatus("error")
      setToast({ message: "Failed to create story.", type: "error" })
    },
  })

  // ── Update story mutation ──
  const updateMutation = useMutation({
    mutationFn: async (storyId: string) => {
      const res = await api.put<StoryApiResponse>(`/stories/${storyId}`, {
        title,
        subtitle: subtitle || null,
        content: wrapTextAsContent(contentText),
        cover_image_url: coverImageUrl || null,
        published,
      })
      return mapApiStory(res.data)
    },
    onSuccess: (story) => {
      queryClient.invalidateQueries({
        queryKey: ["stories", "person", personId],
      })
      setSaveStatus("saved")
      setToast({ message: "Story saved successfully!", type: "success" })
      queryClient.setQueryData(["stories", "person", personId], story)
    },
    onError: () => {
      setSaveStatus("error")
      setToast({ message: "Failed to save story.", type: "error" })
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  // ── Save handler ──
  const handleSave = useCallback(() => {
    if (!(title ?? "").trim()) {
      setToast({ message: "Title is required.", type: "error" })
      return
    }

    setSaveStatus("saving")

    if (existingStory) {
      updateMutation.mutate(existingStory.id)
    } else {
      createMutation.mutate()
    }
  }, [title, existingStory, updateMutation, createMutation])

  // ── Auto-save (debounced, only for existing stories) ──
  useEffect(() => {
    if (!formInitialized || !existingStory) return
    if (isSaving) return

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    autoSaveTimerRef.current = setTimeout(() => {
      if ((title ?? "").trim()) {
        setSaveStatus("saving")
        updateMutation.mutate(existingStory.id)
      }
    }, 5000)

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
    // Only trigger auto-save when form fields change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle, coverImageUrl, contentText, published])

  // ── Preview handler ──
  const handlePreview = () => {
    if (existingStory) {
      window.open(`/person/${personId}/story`, "_blank")
    }
  }

  // ── Loading state ──
  if (storyLoading) {
    return (
      <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
        <AppHeader />
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sage-400 dark:text-dark-text-muted text-sm">Loading story editor...</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (storyError) {
    return (
      <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
        <AppHeader />
        <div className="flex items-center justify-center h-screen">
          <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm px-8 py-6 max-w-md text-center space-y-3">
            <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
            <p className="text-red-600 font-semibold text-lg">
              Could not load story
            </p>
            <p className="text-sage-400 dark:text-dark-text-muted text-sm">
              There was a problem loading the story editor. Please try again.
            </p>
            <Link
              to="/person/$personId"
              params={{ personId }}
              className="mt-2 inline-flex items-center gap-2 bg-primary text-earth-900 font-bold text-sm uppercase tracking-wider px-5 py-2.5 rounded-lg hover:bg-primary-dark hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Profile
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Viewer guard (render nothing while redirecting) ──
  if (user?.role === "viewer") {
    return null
  }

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      <AppHeader />

      {/* Spacer for fixed header */}
      <div className="pt-20" />

      {/* ── Top bar: breadcrumbs + actions ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Breadcrumbs
            items={[
              {
                label: "Family Tree",
                onClick: () => navigate({ to: "/tree" }),
              },
              {
                label: personName,
                onClick: () =>
                  navigate({
                    to: "/person/$personId",
                    params: { personId },
                  }),
              },
              { label: "Edit Story", active: true },
            ]}
          />

          <div className="flex items-center gap-3">
            <AutoSaveIndicator status={saveStatus} />

            {existingStory && (
              <button
                onClick={handlePreview}
                className="inline-flex items-center gap-2 bg-white dark:bg-dark-card border border-sage-200 dark:border-dark-border text-earth-800 dark:text-dark-text font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg hover:bg-sage-50 dark:hover:bg-dark-surface hover:border-sage-300 dark:hover:border-dark-border transition-colors shadow-sm"
              >
                <Eye className="h-4 w-4" />
                Preview
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={isSaving || !(title ?? "").trim()}
              className="inline-flex items-center gap-2 bg-primary text-earth-900 font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg hover:bg-primary-dark hover:text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {existingStory ? "Save" : "Create Story"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Editor form ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
        {/* Back link */}
        <Link
          to="/person/$personId"
          params={{ personId }}
          className="inline-flex items-center gap-2 text-sage-400 dark:text-dark-text-muted hover:text-primary-dark transition-colors text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {personName}
        </Link>

        {/* Title */}
        <div className="space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Story title..."
            className="w-full text-4xl font-serif font-bold text-earth-900 dark:text-dark-text placeholder-sage-300 dark:placeholder-dark-text-muted bg-transparent border-0 border-b-2 border-sage-200 dark:border-dark-border focus:border-primary focus:outline-none pb-3 transition-colors"
          />
          {!(title ?? "").trim() && formInitialized && (
            <p className="text-red-500 text-xs font-medium">
              Title is required
            </p>
          )}
        </div>

        {/* Subtitle */}
        <div>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Optional subtitle..."
            className="w-full text-xl font-serif text-earth-800 dark:text-dark-text placeholder-sage-300 dark:placeholder-dark-text-muted bg-transparent border-0 border-b border-sage-200 dark:border-dark-border focus:border-primary focus:outline-none pb-2 transition-colors"
          />
        </div>

        {/* Cover Image URL */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-400 dark:text-dark-text-muted">
            <Image className="h-4 w-4" />
            Cover Image
          </label>
          <input
            type="text"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full bg-white dark:bg-dark-surface border border-sage-200 dark:border-dark-border rounded-lg px-4 py-3 text-sm text-earth-900 dark:text-dark-text placeholder-sage-300 dark:placeholder-dark-text-muted focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-all"
          />
          {coverImageUrl && (
            <div className="relative rounded-xl overflow-hidden border border-sage-200 dark:border-dark-border shadow-sm bg-white dark:bg-dark-card">
              <img
                src={coverImageUrl}
                alt="Cover preview"
                className="w-full h-56 object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = "none"
                }}
                onLoad={(e) => {
                  ;(e.target as HTMLImageElement).style.display = "block"
                }}
              />
            </div>
          )}
        </div>

        {/* Content textarea */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-400 dark:text-dark-text-muted">
            Story Content
          </label>
          <textarea
            value={contentText}
            onChange={(e) => setContentText(e.target.value)}
            placeholder="Write the story here..."
            className="w-full min-h-[250px] sm:min-h-[400px] bg-parchment dark:bg-dark-surface border border-sage-200 dark:border-dark-border rounded-xl px-4 sm:px-6 py-5 text-base font-serif text-earth-900 dark:text-dark-text leading-relaxed placeholder-sage-300 dark:placeholder-dark-text-muted focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none resize-y transition-all"
          />
          <p className="text-xs text-sage-400 dark:text-dark-text-muted">
            Rich text editing with Plate.js is coming soon. For now, plain text
            is stored.
          </p>
        </div>

        {/* Published toggle */}
        <div className="flex items-center justify-between bg-white dark:bg-dark-card border border-sage-200 dark:border-dark-border rounded-xl px-5 py-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-earth-900 dark:text-dark-text">
              Publish Story
            </p>
            <p className="text-xs text-sage-400 dark:text-dark-text-muted mt-0.5">
              When published, this story will be visible to all family members.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={published}
            onClick={() => setPublished(!published)}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              published ? "bg-primary" : "bg-sage-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                published ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Bottom action bar */}
        <div className="flex items-center justify-between pt-6 border-t border-sage-200 dark:border-dark-border">
          <Link
            to="/person/$personId"
            params={{ personId }}
            className="inline-flex items-center gap-2 text-sage-400 dark:text-dark-text-muted hover:text-earth-800 dark:hover:text-dark-text transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Link>

          <div className="flex items-center gap-3">
            {existingStory && (
              <button
                onClick={handlePreview}
                className="inline-flex items-center gap-2 bg-white dark:bg-dark-card border border-sage-200 dark:border-dark-border text-earth-800 dark:text-dark-text font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-lg hover:bg-sage-50 dark:hover:bg-dark-surface hover:border-sage-300 dark:hover:border-dark-border transition-colors shadow-sm"
              >
                <Eye className="h-4 w-4" />
                Preview
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={isSaving || !(title ?? "").trim()}
              className="inline-flex items-center gap-2 bg-primary text-earth-900 font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg hover:bg-primary-dark hover:text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {existingStory ? "Save" : "Create Story"}
            </button>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <ToastNotification toast={toast} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { BookOpen, Plus, Loader2, Users, Image } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { useAuthStore } from "../../stores/authStore"
import { cn } from "../../lib/utils"

export const Route = createFileRoute("/_authenticated/family-stories/")({
  component: FamilyStoriesPage,
})

interface StoryListItem {
  id: string; title: string; subtitle: string | null; slug: string
  cover_image_url: string | null; category: string; published: boolean
  author_name: string; person_count: number; image_count: number; created_at: string
}

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "history", label: "History" },
  { value: "place", label: "Places" },
  { value: "event", label: "Events" },
  { value: "heritage", label: "Heritage" },
  { value: "other", label: "Other" },
]

function FamilyStoriesPage() {
  const user = useAuthStore((s) => s.user)
  const canEdit = user?.role === "admin" || user?.role === "editor"
  const [category, setCategory] = useState("")

  const { data: stories, isLoading } = useQuery<StoryListItem[]>({
    queryKey: ["family-stories", category],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (category) params.category = category
      if (canEdit) params.published_only = "false"
      const res = await api.get("/family-stories", { params })
      return res.data
    },
  })

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      <AppHeader />
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-20 sm:pt-24 sm:pb-12">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-earth-900 dark:text-dark-text">Family Stories</h1>
            <p className="text-sage-400 dark:text-dark-text-muted mt-2">
              Stories about the places, events, and heritage that shaped the Thirlwall family.
            </p>
          </div>
          {canEdit && (
            <Link to="/family-stories/new" className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-earth-900 font-medium text-sm rounded-xl hover:bg-primary-dark hover:text-white transition-colors">
              <Plus className="h-4 w-4" /> New Story
            </Link>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-1 bg-white/80 dark:bg-dark-card/80 rounded-xl border border-sage-200 dark:border-dark-border p-1 mb-6 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button key={cat.value} onClick={() => setCategory(cat.value)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                category === cat.value ? "bg-primary/10 text-primary-dark" : "text-sage-400 hover:text-earth-900")}>
              {cat.label}
            </button>
          ))}
        </div>

        {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

        {/* Story grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stories?.map((s) => (
            <Link key={s.id} to="/family-stories/$storyId" params={{ storyId: s.slug }}
              className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all group">
              {s.cover_image_url ? (
                <div className="aspect-video bg-sage-100 dark:bg-dark-surface overflow-hidden">
                  <img src={s.cover_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-primary/5 to-sage-100 dark:from-primary/10 dark:to-dark-surface flex items-center justify-center">
                  <BookOpen className="h-10 w-10 text-sage-300 dark:text-dark-text-muted" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-sage-400 bg-sage-50 dark:bg-dark-surface px-1.5 py-0.5 rounded">{s.category}</span>
                  {!s.published && <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Draft</span>}
                </div>
                <h3 className="font-bold text-earth-900 dark:text-dark-text group-hover:text-primary-dark transition-colors line-clamp-2">{s.title}</h3>
                {s.subtitle && <p className="text-xs text-sage-400 mt-1 line-clamp-2">{s.subtitle}</p>}
                <div className="flex items-center gap-3 mt-3 text-[10px] text-sage-300">
                  <span>{s.author_name}</span>
                  {s.person_count > 0 && <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {s.person_count}</span>}
                  {s.image_count > 0 && <span className="flex items-center gap-0.5"><Image className="h-3 w-3" /> {s.image_count}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!isLoading && stories?.length === 0 && (
          <div className="text-center py-16 bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border">
            <BookOpen className="h-12 w-12 text-sage-300 mx-auto mb-3" />
            <p className="text-sage-400 text-sm font-medium">No stories yet</p>
            <p className="text-sage-300 text-xs mt-1">Create the first story about your family's history and heritage.</p>
          </div>
        )}
      </div>
    </div>
  )
}

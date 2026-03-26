import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { UtensilsCrossed, Bookmark, Plus, X, Check, Loader2, ChevronDown } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { useAuthStore } from "../../stores/authStore"
import { cn } from "../../lib/utils"

export const Route = createFileRoute("/_authenticated/traditions")({
  component: TraditionsPage,
})

interface Tradition {
  id: string
  title: string
  category: string
  content: string
  cover_image_url: string | null
  origin_person_id: string | null
  origin_person_name: string | null
  author_name: string
  person_names: string[]
  created_at: string
}

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "recipe", label: "Recipes" },
  { value: "tradition", label: "Traditions" },
  { value: "custom", label: "Customs" },
  { value: "saying", label: "Sayings" },
]

const CATEGORY_ICONS: Record<string, typeof UtensilsCrossed> = {
  recipe: UtensilsCrossed,
  tradition: Bookmark,
  custom: Bookmark,
  saying: Bookmark,
}

function AddTraditionForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("recipe")
  const [content, setContent] = useState("")

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/traditions", {
        title,
        category,
        content,
        author_id: user!.id,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traditions"] })
      onClose()
    },
  })

  return (
    <div className="bg-white dark:bg-dark-card rounded-2xl border border-primary/30 p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-earth-900 dark:text-dark-text">Add New</h3>
        <button onClick={onClose} className="p-1 text-sage-400 hover:text-earth-900 transition-colors"><X className="h-4 w-4" /></button>
      </div>

      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required
        className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />

      <select value={category} onChange={(e) => setCategory(e.target.value)}
        className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20">
        <option value="recipe">Recipe</option>
        <option value="tradition">Tradition</option>
        <option value="custom">Custom</option>
        <option value="saying">Saying</option>
      </select>

      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Share the details... For recipes, include ingredients and instructions."
        rows={6}
        className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20 resize-none" />

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-2 text-sm text-sage-400 hover:text-earth-900 transition-colors">Cancel</button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending || !title.trim() || !content.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary-dark text-white text-sm font-medium rounded-lg hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50"
        >
          {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Save
        </button>
      </div>
    </div>
  )
}

function TraditionsPage() {
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: traditions, isLoading } = useQuery<Tradition[]>({
    queryKey: ["traditions", categoryFilter],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (categoryFilter !== "all") params.category = categoryFilter
      const res = await api.get("/traditions", { params })
      return res.data
    },
  })

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      <AppHeader />
      <div className="max-w-3xl mx-auto px-4 pt-20 pb-8 sm:pt-24 sm:pb-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <UtensilsCrossed className="h-7 w-7 text-primary-dark" />
          </div>
          <h1 className="text-3xl font-bold text-earth-900 dark:text-dark-text">Recipes & Traditions</h1>
          <p className="text-sage-400 dark:text-dark-text-muted mt-2">Family recipes, customs, and sayings passed down through generations.</p>
        </div>

        {/* Category filter + add button */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-white/80 dark:bg-dark-card/80 rounded-xl border border-sage-200 dark:border-dark-border p-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  categoryFilter === cat.value
                    ? "bg-primary/10 text-primary-dark dark:text-primary"
                    : "text-sage-400 hover:text-earth-900 dark:hover:text-dark-text",
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-earth-900 font-medium text-sm rounded-xl hover:bg-primary-dark hover:text-white transition-colors"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>

        {showForm && <div className="mb-6"><AddTraditionForm onClose={() => setShowForm(false)} /></div>}

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <div className="space-y-3">
          {traditions?.map((t) => {
            const Icon = CATEGORY_ICONS[t.category] ?? Bookmark
            const isExpanded = expandedId === t.id

            return (
              <div key={t.id} className="bg-white/80 dark:bg-dark-card/80 rounded-2xl border border-sage-200 dark:border-dark-border shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-primary-dark" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-earth-900 dark:text-dark-text text-sm">{t.title}</p>
                    <p className="text-xs text-sage-400 dark:text-dark-text-muted mt-0.5">
                      {t.category} {t.origin_person_name ? `\u2022 from ${t.origin_person_name}` : ""} \u2022 by {t.author_name}
                    </p>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-sage-300 transition-transform", isExpanded && "rotate-180")} />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-sage-100 dark:border-dark-border">
                    <div className="pt-4 text-sm text-earth-800 dark:text-dark-text leading-relaxed whitespace-pre-wrap">
                      {t.content}
                    </div>
                    {t.person_names.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {t.person_names.map((name, i) => (
                          <span key={i} className="text-[10px] font-medium bg-sage-50 dark:bg-dark-surface px-2 py-0.5 rounded-full text-sage-600 dark:text-dark-text-muted">{name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {!isLoading && traditions?.length === 0 && (
            <div className="text-center py-12 bg-white/80 dark:bg-dark-card/80 rounded-2xl border border-sage-200 dark:border-dark-border">
              <UtensilsCrossed className="h-10 w-10 text-sage-300 mx-auto mb-3" />
              <p className="text-sage-400 text-sm">No {categoryFilter !== "all" ? categoryFilter + "s" : "traditions"} yet.</p>
              <p className="text-sage-300 text-xs mt-1">Be the first to share a family recipe or tradition!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { ExternalLink, User, ArrowLeft, Edit, Loader2 } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { useAuthStore } from "../../stores/authStore"

export const Route = createFileRoute("/_authenticated/family-stories/$storyId")({
  component: FamilyStoryDetailPage,
})

interface StoryDetail {
  id: string; title: string; subtitle: string | null; slug: string
  content: string; cover_image_url: string | null; category: string
  external_url: string | null; published: boolean; author_name: string
  person_ids: string[]; person_names: { id: string; name: string; profile_photo_url: string | null }[]
  images: { id: string; image_url: string | null; s3_key: string | null; caption: string | null; sort_order: number }[]
  created_at: string; updated_at: string
}

function FamilyStoryDetailPage() {
  const { storyId } = Route.useParams()
  const user = useAuthStore((s) => s.user)
  const canEdit = user?.role === "admin" || user?.role === "editor"

  const { data: story, isLoading } = useQuery<StoryDetail>({
    queryKey: ["family-story", storyId],
    queryFn: async () => {
      const res = await api.get(`/family-stories/${storyId}`)
      return res.data
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
        <AppHeader />
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!story) {
    return (
      <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
        <AppHeader />
        <div className="flex items-center justify-center h-screen">
          <p className="text-sage-400">Story not found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      {/* Hero */}
      <div className="relative">
        {story.cover_image_url ? (
          <div className="h-64 sm:h-96 overflow-hidden">
            <img src={story.cover_image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </div>
        ) : (
          <div className="h-48 sm:h-64 bg-gradient-to-br from-primary-darker to-bg-dark" />
        )}

        <AppHeader hideSearch />

        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded">{story.category}</span>
              {!story.published && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded">Draft</span>}
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight">{story.title}</h1>
            {story.subtitle && <p className="text-lg text-white/70 mt-2">{story.subtitle}</p>}
            <p className="text-sm text-white/50 mt-3">By {story.author_name}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            {/* Story text */}
            <article className="prose prose-sage dark:prose-invert max-w-none">
              {story.content.split("\n").map((para, i) => (
                para.trim() ? <p key={i} className="text-base text-earth-800 dark:text-dark-text leading-relaxed mb-4">{para}</p> : null
              ))}
            </article>

            {/* Images gallery */}
            {story.images.length > 0 && (
              <div className="mt-8 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-sage-400">Gallery</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {story.images.map((img) => (
                    <div key={img.id} className="rounded-xl overflow-hidden border border-sage-200 dark:border-dark-border">
                      <img
                        src={img.image_url || (img.s3_key ? `/media/${img.s3_key}` : "")}
                        alt={img.caption ?? ""}
                        className="w-full aspect-video object-cover"
                      />
                      {img.caption && (
                        <p className="px-3 py-2 text-xs text-sage-400 dark:text-dark-text-muted italic">{img.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External link */}
            {story.external_url && (
              <div className="mt-8">
                <a href={story.external_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary-dark hover:text-primary transition-colors">
                  <ExternalLink className="h-4 w-4" />
                  Read more on Wikipedia
                </a>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* People mentioned */}
            {story.person_names.length > 0 && (
              <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4">
                <h3 className="text-sm font-bold text-earth-900 dark:text-dark-text mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  People in this Story
                </h3>
                <div className="space-y-2">
                  {story.person_names.map((p) => (
                    <Link key={p.id} to="/person/$personId" params={{ personId: p.id }}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors group">
                      {p.profile_photo_url ? (
                        <img src={p.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary-dark">
                          {p.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                      )}
                      <span className="text-sm text-earth-900 dark:text-dark-text group-hover:text-primary-dark transition-colors">{p.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2">
              <Link to="/family-stories"
                className="flex items-center gap-2 text-sm text-sage-400 hover:text-primary-dark transition-colors">
                <ArrowLeft className="h-4 w-4" /> Back to all stories
              </Link>
              {canEdit && (
                <Link to={`/family-stories/new?edit=${story.id}` as any}
                  className="flex items-center gap-2 text-sm text-primary-dark hover:text-primary transition-colors">
                  <Edit className="h-4 w-4" /> Edit this story
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

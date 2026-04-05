import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, MapPin, Users, Check, HelpCircle, X, Send, Loader2, ArrowLeft, Image, MessageCircle } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { cn } from "../../lib/utils"

export const Route = createFileRoute("/_authenticated/events/$eventId")({
  component: EventDetailPage,
})

interface EventDetail {
  id: string; title: string; description: string | null
  event_date: string | null; end_date: string | null
  location_text: string | null; cover_image_url: string | null
  category: string; is_recurring: boolean; recurrence_note: string | null
  organizer_name: string; is_past: boolean; published: boolean
  rsvp_counts: Record<string, number>
  rsvp_list: { user_id: string; user_name: string; status: string; note: string | null }[]
  my_rsvp: { status: string; note: string | null } | null
  photo_count: number; comment_count: number
  photos: { id: string; image_url: string | null; s3_key: string | null; caption: string | null }[]
  comments: { id: string; body: string; author_name: string; created_at: string }[]
}

function formatDate(d: string | null): string {
  if (!d) return "Date TBD"
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
}

function daysUntil(d: string): string {
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  if (diff === 0) return "Today!"
  if (diff === 1) return "Tomorrow"
  if (diff > 0) return `${diff} days away`
  return ""
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(d).toLocaleDateString()
}

const RSVP_OPTIONS = [
  { status: "attending", label: "Attending", icon: Check, color: "bg-primary/10 text-primary-dark border-primary/30" },
  { status: "maybe", label: "Maybe", icon: HelpCircle, color: "bg-amber-50 text-amber-700 border-amber-200" },
  { status: "not_attending", label: "Can't Make It", icon: X, color: "bg-red-50 text-red-600 border-red-200" },
]

function EventDetailPage() {
  const { eventId } = Route.useParams()
  const queryClient = useQueryClient()
  const [commentText, setCommentText] = useState("")

  const { data: event, isLoading } = useQuery<EventDetail>({
    queryKey: ["event", eventId],
    queryFn: async () => { const res = await api.get(`/events/${eventId}`); return res.data },
  })

  const rsvpMutation = useMutation({
    mutationFn: async (status: string) => {
      await api.post(`/events/${eventId}/rsvp`, { status })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["event", eventId] }) },
  })

  const commentMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/events/${eventId}/comments`, { body: commentText })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] })
      setCommentText("")
    },
  })

  if (isLoading || !event) {
    return (
      <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
        <AppHeader />
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  const attendingCount = event.rsvp_counts.attending ?? 0
  const maybeCount = event.rsvp_counts.maybe ?? 0

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      {/* Hero */}
      <div className="relative">
        {event.cover_image_url ? (
          <div className="h-48 sm:h-72 overflow-hidden">
            <img src={event.cover_image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </div>
        ) : (
          <div className="h-40 sm:h-56 bg-gradient-to-br from-primary-darker to-bg-dark" />
        )}
        <AppHeader hideSearch />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded">{event.category}</span>
              {event.is_recurring && event.recurrence_note && (
                <span className="text-[10px] text-white/60">{event.recurrence_note}</span>
              )}
              {!event.is_past && event.event_date && (
                <span className="text-[10px] font-bold text-primary bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded">{daysUntil(event.event_date)}</span>
              )}
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold text-white">{event.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-white/70">
              {event.event_date && <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {formatDate(event.event_date)}{event.end_date && event.end_date !== event.event_date ? ` \u2013 ${formatDate(event.end_date)}` : ""}</span>}
              {event.location_text && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {event.location_text}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            {event.description && (
              <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-6">
                <div className="text-sm text-earth-800 dark:text-dark-text leading-relaxed whitespace-pre-wrap">{event.description}</div>
              </div>
            )}

            {/* Photos */}
            {event.photos.length > 0 && (
              <section>
                <h2 className="text-base font-bold text-earth-900 dark:text-dark-text mb-3 flex items-center gap-2">
                  <Image className="h-4 w-4 text-primary" /> Photos
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {event.photos.map((p) => (
                    <div key={p.id} className="aspect-square rounded-lg overflow-hidden border border-sage-200 dark:border-dark-border">
                      <img src={p.image_url || (p.s3_key ? `/media/${p.s3_key}` : "")} alt={p.caption ?? ""} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Comments */}
            <section>
              <h2 className="text-base font-bold text-earth-900 dark:text-dark-text mb-3 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" /> Discussion
                {event.comments.length > 0 && <span className="text-xs text-sage-400">({event.comments.length})</span>}
              </h2>

              <div className="space-y-3 mb-4">
                {event.comments.map((c) => (
                  <div key={c.id} className="bg-white dark:bg-dark-card rounded-lg border border-sage-200 dark:border-dark-border p-3">
                    <p className="text-sm text-earth-800 dark:text-dark-text">{c.body}</p>
                    <p className="text-[10px] text-sage-300 mt-1">{c.author_name} &bull; {timeAgo(c.created_at)}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 rounded-lg border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
                  onKeyDown={(e) => { if (e.key === "Enter" && commentText.trim()) commentMutation.mutate() }}
                />
                <button onClick={() => commentMutation.mutate()} disabled={!commentText.trim() || commentMutation.isPending}
                  className="px-3 py-2 bg-primary-dark text-white rounded-lg hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* RSVP */}
            {!event.is_past && (
              <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4">
                <h3 className="text-sm font-bold text-earth-900 dark:text-dark-text mb-3">Are you going?</h3>
                <div className="space-y-2">
                  {RSVP_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    const isSelected = event.my_rsvp?.status === opt.status
                    return (
                      <button key={opt.status}
                        onClick={() => rsvpMutation.mutate(opt.status)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                          isSelected ? opt.color + " border-current" : "border-sage-200 dark:border-dark-border text-sage-400 hover:text-earth-900 hover:bg-sage-50 dark:hover:bg-dark-surface",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {opt.label}
                        {isSelected && <Check className="h-3 w-3 ml-auto" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Attendees */}
            {event.rsvp_list.length > 0 && (
              <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4">
                <h3 className="text-sm font-bold text-earth-900 dark:text-dark-text mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  {attendingCount} attending{maybeCount > 0 ? `, ${maybeCount} maybe` : ""}
                </h3>
                <div className="space-y-1.5">
                  {event.rsvp_list.filter((r) => r.status === "attending").map((r) => (
                    <div key={r.user_id} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary-dark">
                        {r.user_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="text-xs text-earth-900 dark:text-dark-text">{r.user_name}</span>
                      {r.note && <span className="text-[10px] text-sage-300 italic">{r.note}</span>}
                    </div>
                  ))}
                  {event.rsvp_list.filter((r) => r.status === "maybe").map((r) => (
                    <div key={r.user_id} className="flex items-center gap-2 opacity-60">
                      <div className="w-6 h-6 rounded-full bg-amber-50 flex items-center justify-center text-[10px] font-bold text-amber-700">
                        {r.user_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="text-xs text-earth-900 dark:text-dark-text">{r.user_name}</span>
                      <span className="text-[9px] text-amber-600">maybe</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Organizer */}
            <div className="text-xs text-sage-400">
              Organized by {event.organizer_name}
            </div>

            <Link to="/events" className="flex items-center gap-1 text-xs text-sage-400 hover:text-primary-dark transition-colors">
              <ArrowLeft className="h-3 w-3" /> Back to all events
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

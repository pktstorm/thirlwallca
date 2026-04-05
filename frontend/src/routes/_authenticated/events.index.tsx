import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { CalendarDays, Plus, MapPin, Users, Loader2, Clock } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { useAuthStore } from "../../stores/authStore"
import { cn } from "../../lib/utils"

export const Route = createFileRoute("/_authenticated/events/")({
  component: EventsPage,
})

interface EventItem {
  id: string; title: string; description: string | null
  event_date: string | null; end_date: string | null
  location_text: string | null; cover_image_url: string | null
  category: string; is_recurring: boolean; recurrence_note: string | null
  organizer_name: string; is_past: boolean
  rsvp_counts: Record<string, number>; photo_count: number; comment_count: number
  my_rsvp: { status: string } | null
}

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "reunion", label: "Reunions" },
  { value: "wedding", label: "Weddings" },
  { value: "memorial", label: "Memorials" },
  { value: "celebration", label: "Celebrations" },
  { value: "other", label: "Other" },
]

function formatDate(d: string | null): string {
  if (!d) return "Date TBD"
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function daysUntil(d: string): string {
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  if (diff === 0) return "Today!"
  if (diff === 1) return "Tomorrow"
  if (diff < 0) return `${Math.abs(diff)} days ago`
  return `In ${diff} days`
}

function EventsPage() {
  const user = useAuthStore((s) => s.user)
  const canEdit = user?.role === "admin" || user?.role === "editor"
  const [category, setCategory] = useState("")
  const [showPast, setShowPast] = useState(false)

  const { data: events, isLoading } = useQuery<EventItem[]>({
    queryKey: ["events", category, showPast],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (category) params.category = category
      if (!showPast) params.upcoming_only = "true"
      const res = await api.get("/events", { params })
      return res.data
    },
  })

  const upcoming = events?.filter((e) => !e.is_past) ?? []
  const past = events?.filter((e) => e.is_past) ?? []

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      <AppHeader />
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-20 sm:pt-24 sm:pb-12">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-earth-900 dark:text-dark-text">Family Events</h1>
            <p className="text-sage-400 dark:text-dark-text-muted mt-2">Plan reunions, celebrate milestones, and document family gatherings.</p>
          </div>
          {canEdit && (
            <Link to="/events/new" className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-earth-900 font-medium text-sm rounded-xl hover:bg-primary-dark hover:text-white transition-colors">
              <Plus className="h-4 w-4" /> New Event
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-white/80 dark:bg-dark-card/80 rounded-xl border border-sage-200 dark:border-dark-border p-1 overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button key={cat.value} onClick={() => setCategory(cat.value)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                  category === cat.value ? "bg-primary/10 text-primary-dark" : "text-sage-400 hover:text-earth-900")}>
                {cat.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-earth-900 dark:text-dark-text ml-3">
            <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)}
              className="rounded border-sage-300 text-primary-dark" />
            Show past
          </label>
        </div>

        {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-earth-900 dark:text-dark-text mb-4 flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" /> Upcoming
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {upcoming.map((e) => (
                <Link key={e.id} to="/events/$eventId" params={{ eventId: e.id }}
                  className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all group">
                  {e.cover_image_url ? (
                    <div className="h-40 overflow-hidden">
                      <img src={e.cover_image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  ) : (
                    <div className="h-24 bg-gradient-to-br from-primary/10 to-sage-100 dark:from-primary/5 dark:to-dark-surface flex items-center justify-center">
                      <CalendarDays className="h-8 w-8 text-primary/30" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-primary-dark bg-primary/10 px-1.5 py-0.5 rounded">{e.category}</span>
                      {e.event_date && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">{daysUntil(e.event_date)}</span>}
                    </div>
                    <h3 className="font-bold text-earth-900 dark:text-dark-text group-hover:text-primary-dark transition-colors">{e.title}</h3>
                    {e.event_date && <p className="text-xs text-sage-400 mt-1 flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(e.event_date)}</p>}
                    {e.location_text && <p className="text-xs text-sage-400 mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> {e.location_text}</p>}
                    <div className="flex items-center gap-3 mt-3 text-[10px] text-sage-300">
                      {(e.rsvp_counts.attending || 0) > 0 && <span className="flex items-center gap-0.5"><Users className="h-3 w-3" /> {e.rsvp_counts.attending} attending</span>}
                      {e.my_rsvp && <span className="bg-primary/10 text-primary-dark px-1.5 py-0.5 rounded-full font-bold capitalize">{e.my_rsvp.status.replace("_", " ")}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Past */}
        {past.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-earth-900 dark:text-dark-text mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-sage-400" /> Past Events
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {past.map((e) => (
                <Link key={e.id} to="/events/$eventId" params={{ eventId: e.id }}
                  className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4 hover:border-primary/40 hover:shadow-md transition-all group opacity-80 hover:opacity-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-sage-400 bg-sage-50 px-1.5 py-0.5 rounded">{e.category}</span>
                  </div>
                  <h3 className="font-semibold text-earth-900 dark:text-dark-text text-sm group-hover:text-primary-dark transition-colors">{e.title}</h3>
                  {e.event_date && <p className="text-xs text-sage-400 mt-1">{formatDate(e.event_date)}</p>}
                  {e.location_text && <p className="text-xs text-sage-300 mt-0.5">{e.location_text}</p>}
                  {e.photo_count > 0 && <p className="text-[10px] text-primary-dark mt-2">{e.photo_count} photos</p>}
                </Link>
              ))}
            </div>
          </section>
        )}

        {!isLoading && (upcoming.length === 0 && past.length === 0) && (
          <div className="text-center py-16 bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border">
            <CalendarDays className="h-12 w-12 text-sage-300 mx-auto mb-3" />
            <p className="text-sage-400 text-sm font-medium">No events yet</p>
            <p className="text-sage-300 text-xs mt-1">Create your first family event to start planning.</p>
          </div>
        )}
      </div>
    </div>
  )
}

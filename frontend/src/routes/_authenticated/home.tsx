import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  Calendar, TreePine, BookOpen, Image, GitBranch, Globe, Users, Sparkles,
  Clock, ArrowRight, Cake, Heart,
} from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { useAuthStore } from "../../stores/authStore"
import { FamilyTour } from "../../components/tour/FamilyTour"

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
})

interface DashboardData {
  on_this_day: {
    births: { person_id: string; person_name: string; year: number; profile_photo_url: string | null }[]
    deaths: { person_id: string; person_name: string; year: number; profile_photo_url: string | null }[]
    marriages: { person_ids: string[]; person_names: string[]; year: number }[]
  }
  recent_activity: {
    recent_persons: { id: string; name: string; created_at: string }[]
    recent_stories: { id: string; title: string; person_id: string; person_name: string; created_at: string }[]
    recent_media_count: number
  }
  family_stats: {
    total_persons: number
    total_locations: number
    total_stories: number
    total_media: number
    countries: string[]
  }
  fun_facts: string[]
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-xl border border-sage-200 dark:border-dark-border p-4 text-center">
      <div className="flex justify-center mb-2 text-primary-dark dark:text-primary">{icon}</div>
      <p className="text-2xl font-bold text-earth-900 dark:text-dark-text">{value}</p>
      <p className="text-xs text-sage-400 dark:text-dark-text-muted mt-0.5">{label}</p>
    </div>
  )
}

function HomePage() {
  const user = useAuthStore((s) => s.user)
  const linkedPersonId = user?.linkedPersonId
  const [showTour, setShowTour] = useState(false)

  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await api.get("/dashboard")
      return res.data
    },
    staleTime: 60_000,
  })

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  })()

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      <AppHeader />

      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10 space-y-8">
        {/* Welcome header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-earth-900 dark:text-dark-text">
              {greeting}, {user?.displayName?.split(" ")[0] ?? "there"}
            </h1>
            <p className="text-sage-400 dark:text-dark-text-muted mt-1">
              Explore your family's history and heritage.
            </p>
          </div>
          {linkedPersonId && (
            <button
              onClick={() => setShowTour(true)}
              className="hidden sm:flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-dark dark:text-primary px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Meet Your Family
            </button>
          )}
        </div>

        {/* Quick navigation cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link to="/tree" className="flex flex-col items-center gap-2 bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4 hover:border-primary/40 hover:shadow-md transition-all group">
            <TreePine className="h-6 w-6 text-primary-dark group-hover:text-primary transition-colors" />
            <span className="text-sm font-medium text-earth-900 dark:text-dark-text">Family Tree</span>
          </Link>
          <Link to="/map" className="flex flex-col items-center gap-2 bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4 hover:border-primary/40 hover:shadow-md transition-all group">
            <Globe className="h-6 w-6 text-primary-dark group-hover:text-primary transition-colors" />
            <span className="text-sm font-medium text-earth-900 dark:text-dark-text">Family Map</span>
          </Link>
          <Link to="/search" className="flex flex-col items-center gap-2 bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4 hover:border-primary/40 hover:shadow-md transition-all group">
            <Users className="h-6 w-6 text-primary-dark group-hover:text-primary transition-colors" />
            <span className="text-sm font-medium text-earth-900 dark:text-dark-text">Search People</span>
          </Link>
          <Link to="/related" className="flex flex-col items-center gap-2 bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4 hover:border-primary/40 hover:shadow-md transition-all group">
            <GitBranch className="h-6 w-6 text-primary-dark group-hover:text-primary transition-colors" />
            <span className="text-sm font-medium text-earth-900 dark:text-dark-text">How Related?</span>
          </Link>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {dashboard && (
          <>
            {/* On This Day */}
            {(dashboard.on_this_day.births.length > 0 || dashboard.on_this_day.deaths.length > 0 || dashboard.on_this_day.marriages.length > 0) && (
              <section>
                <h2 className="flex items-center gap-2 text-lg font-bold text-earth-900 dark:text-dark-text mb-4">
                  <Calendar className="h-5 w-5 text-primary" />
                  On This Day
                </h2>
                <div className="space-y-2">
                  {dashboard.on_this_day.births.map((b) => (
                    <Link key={b.person_id} to="/person/$personId" params={{ personId: b.person_id }}
                      className="flex items-center gap-3 bg-blue-50/70 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/20 rounded-xl px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                      <Cake className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-earth-900 dark:text-dark-text">
                          <span className="font-semibold">{b.person_name}</span> was born on this day in <span className="font-semibold">{b.year}</span>
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-sage-300 flex-shrink-0" />
                    </Link>
                  ))}
                  {dashboard.on_this_day.deaths.map((d) => (
                    <Link key={d.person_id} to="/person/$personId" params={{ personId: d.person_id }}
                      className="flex items-center gap-3 bg-sage-50/70 dark:bg-dark-surface/50 border border-sage-200/50 dark:border-dark-border/50 rounded-xl px-4 py-3 hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors">
                      <Clock className="h-4 w-4 text-sage-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-earth-900 dark:text-dark-text">
                          Remembering <span className="font-semibold">{d.person_name}</span>, who passed on this day in <span className="font-semibold">{d.year}</span>
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-sage-300 flex-shrink-0" />
                    </Link>
                  ))}
                  {dashboard.on_this_day.marriages.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 bg-pink-50/70 dark:bg-pink-900/10 border border-pink-200/50 dark:border-pink-800/20 rounded-xl px-4 py-3">
                      <Heart className="h-4 w-4 text-pink-500 flex-shrink-0" />
                      <p className="text-sm text-earth-900 dark:text-dark-text">
                        <span className="font-semibold">{m.person_names.join(" & ")}</span> were married on this day in <span className="font-semibold">{m.year}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Family Stats */}
            <section>
              <h2 className="flex items-center gap-2 text-lg font-bold text-earth-900 dark:text-dark-text mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                Your Family
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={<Users className="h-5 w-5" />} value={dashboard.family_stats.total_persons} label="People" />
                <StatCard icon={<Globe className="h-5 w-5" />} value={dashboard.family_stats.countries.length} label="Countries" />
                <StatCard icon={<BookOpen className="h-5 w-5" />} value={dashboard.family_stats.total_stories} label="Stories" />
                <StatCard icon={<Image className="h-5 w-5" />} value={dashboard.family_stats.total_media} label="Photos" />
              </div>
            </section>

            {/* Fun Facts */}
            {dashboard.fun_facts.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-lg font-bold text-earth-900 dark:text-dark-text mb-4">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Did You Know?
                </h2>
                <div className="space-y-2">
                  {dashboard.fun_facts.map((fact, i) => (
                    <div key={i} className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-xl border border-sage-200 dark:border-dark-border px-4 py-3">
                      <p className="text-sm text-earth-900 dark:text-dark-text">{fact}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Activity */}
            {(dashboard.recent_activity.recent_persons.length > 0 || dashboard.recent_activity.recent_stories.length > 0) && (
              <section>
                <h2 className="flex items-center gap-2 text-lg font-bold text-earth-900 dark:text-dark-text mb-4">
                  <Clock className="h-5 w-5 text-primary" />
                  Recent Activity
                </h2>
                <div className="space-y-2">
                  {dashboard.recent_activity.recent_persons.map((p) => (
                    <Link key={p.id} to="/person/$personId" params={{ personId: p.id }}
                      className="flex items-center gap-3 bg-white/80 dark:bg-dark-card/80 rounded-xl border border-sage-200 dark:border-dark-border px-4 py-3 hover:border-primary/40 transition-colors">
                      <Users className="h-4 w-4 text-sage-400 flex-shrink-0" />
                      <p className="text-sm text-earth-900 dark:text-dark-text flex-1">
                        <span className="font-semibold">{p.name}</span> was added
                      </p>
                      <span className="text-xs text-sage-300">{new Date(p.created_at).toLocaleDateString()}</span>
                    </Link>
                  ))}
                  {dashboard.recent_activity.recent_stories.map((s) => (
                    <Link key={s.id} to="/person/$personId/story" params={{ personId: s.person_id }}
                      className="flex items-center gap-3 bg-white/80 dark:bg-dark-card/80 rounded-xl border border-sage-200 dark:border-dark-border px-4 py-3 hover:border-primary/40 transition-colors">
                      <BookOpen className="h-4 w-4 text-sage-400 flex-shrink-0" />
                      <p className="text-sm text-earth-900 dark:text-dark-text flex-1">
                        Story published: <span className="font-semibold">{s.title}</span> ({s.person_name})
                      </p>
                      <span className="text-xs text-sage-300">{new Date(s.created_at).toLocaleDateString()}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* Family Tour modal */}
      {showTour && linkedPersonId && (
        <FamilyTour personId={linkedPersonId} onClose={() => setShowTour(false)} />
      )}
    </div>
  )
}

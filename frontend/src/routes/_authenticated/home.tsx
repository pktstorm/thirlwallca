import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  Calendar, TreePine, BookOpen, Image, GitBranch, Globe, Users, Sparkles,
  Clock, Cake, Heart,
} from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { useAuthStore } from "../../stores/authStore"
import { FamilyTour } from "../../components/tour/FamilyTour"

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
})

interface OnThisDayItem {
  type: string
  person_id: string | null
  person_name: string
  year: number | null
  detail: string | null
}

interface RecentActivityItem {
  type: string  // "person" | "story" | "media"
  id: string
  label: string
  created_at: string
}

interface DashboardData {
  on_this_day: OnThisDayItem[]
  recent_activity: RecentActivityItem[]
  family_stats: {
    total_persons: number
    total_locations: number
    total_stories: number
    total_media: number
    total_generations: number
    countries_lived_in: number
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

      <div className="max-w-5xl mx-auto px-4 pt-20 pb-6 sm:pt-24 sm:pb-10 space-y-8">
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
            {dashboard.on_this_day.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-lg font-bold text-earth-900 dark:text-dark-text mb-4">
                  <Calendar className="h-5 w-5 text-primary" />
                  On This Day
                </h2>
                <div className="space-y-2">
                  {dashboard.on_this_day.map((item, i) => {
                    const Icon = item.type === "birth" ? Cake : item.type === "marriage" ? Heart : Clock
                    const bgClass = item.type === "birth"
                      ? "bg-blue-50/70 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-800/20"
                      : item.type === "marriage"
                        ? "bg-pink-50/70 dark:bg-pink-900/10 border-pink-200/50 dark:border-pink-800/20"
                        : "bg-sage-50/70 dark:bg-dark-surface/50 border-sage-200/50 dark:border-dark-border/50"
                    const iconColor = item.type === "birth" ? "text-blue-500" : item.type === "marriage" ? "text-pink-500" : "text-sage-400"

                    const content = (
                      <div className={`flex items-center gap-3 border rounded-xl px-4 py-3 ${bgClass} ${item.person_id ? "hover:shadow-md transition-shadow" : ""}`}>
                        <Icon className={`h-4 w-4 flex-shrink-0 ${iconColor}`} />
                        <p className="text-sm text-earth-900 dark:text-dark-text flex-1">
                          <span className="font-semibold">{item.person_name}</span>
                          {item.type === "birth" && <> was born on this day{item.year ? ` in ${item.year}` : ""}</>}
                          {item.type === "death" && <> passed away on this day{item.year ? ` in ${item.year}` : ""}</>}
                          {item.type === "marriage" && <> married on this day{item.year ? ` in ${item.year}` : ""}</>}
                        </p>
                      </div>
                    )

                    return item.person_id ? (
                      <Link key={i} to="/person/$personId" params={{ personId: item.person_id }}>
                        {content}
                      </Link>
                    ) : (
                      <div key={i}>{content}</div>
                    )
                  })}
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
                <StatCard icon={<Globe className="h-5 w-5" />} value={dashboard.family_stats.countries_lived_in} label="Countries" />
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
            {dashboard.recent_activity.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-lg font-bold text-earth-900 dark:text-dark-text mb-4">
                  <Clock className="h-5 w-5 text-primary" />
                  Recent Activity
                </h2>
                <div className="space-y-2">
                  {dashboard.recent_activity.map((item) => {
                    const Icon = item.type === "story" ? BookOpen : item.type === "media" ? Image : Users
                    return (
                      <div key={item.id} className="flex items-center gap-3 bg-white/80 dark:bg-dark-card/80 rounded-xl border border-sage-200 dark:border-dark-border px-4 py-3">
                        <Icon className="h-4 w-4 text-sage-400 flex-shrink-0" />
                        <p className="text-sm text-earth-900 dark:text-dark-text flex-1">{item.label}</p>
                        <span className="text-xs text-sage-300">{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                    )
                  })}
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

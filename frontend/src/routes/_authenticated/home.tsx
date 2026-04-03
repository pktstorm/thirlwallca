import { useState } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  Calendar, TreePine, BookOpen, Image, GitBranch, Globe, Users, Sparkles,
  Clock, Cake, Heart, Shield, UserPlus, MapPin, ArrowRight, Edit, MessageSquare,
  ChevronRight, Search, BarChart3, UtensilsCrossed,
} from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { useAuthStore } from "../../stores/authStore"
import { FamilyTour } from "../../components/tour/FamilyTour"
import { cn } from "../../lib/utils"

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
})

// --- Types ---

interface OnThisDayItem {
  type: string; person_id: string | null; person_name: string
  year: number | null; detail: string | null
}

interface RecentActivityItem {
  type: string; id: string; label: string; created_at: string
}

interface BranchMember {
  id: string; name: string; profile_photo_url: string | null; relationship: string
}

interface DashboardData {
  on_this_day: OnThisDayItem[]
  recent_activity: RecentActivityItem[]
  family_stats: {
    total_persons: number; total_locations: number; total_stories: number
    total_media: number; total_generations: number; countries_lived_in: number
  }
  fun_facts: string[]
  my_branch: { person_name: string; members: BranchMember[] } | null
  admin_stats: { pending_signups: number; total_users: number; recent_audit_count: number } | null
}

// --- Helpers ---

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

// --- Components ---

function StatPill({ icon, value, label, to }: { icon: React.ReactNode; value: number | string; label: string; to: string }) {
  return (
    <Link to={to as any} className="flex flex-col items-center gap-1 bg-white/90 dark:bg-dark-card/90 rounded-xl border border-sage-200 dark:border-dark-border px-4 py-3 min-w-[80px] hover:border-primary/40 hover:shadow-md transition-all group">
      <div className="text-primary-dark dark:text-primary group-hover:scale-110 transition-transform">{icon}</div>
      <p className="text-xl sm:text-2xl font-bold text-earth-900 dark:text-dark-text leading-none" aria-label={`${value} ${label}`}>{value}</p>
      <p className="text-[10px] sm:text-xs text-sage-400 dark:text-dark-text-muted font-medium uppercase tracking-wider">{label}</p>
    </Link>
  )
}

function ExploreCard({ icon, title, description, to }: { icon: React.ReactNode; title: string; description: string; to: string }) {
  return (
    <Link to={to as any} className="flex items-start gap-3 bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4 hover:border-primary/40 hover:shadow-md transition-all group">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-earth-900 dark:text-dark-text group-hover:text-primary-dark transition-colors">{title}</p>
        <p className="text-xs text-sage-400 dark:text-dark-text-muted mt-0.5 leading-relaxed">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-sage-300 group-hover:text-primary flex-shrink-0 mt-1 transition-colors" />
    </Link>
  )
}

// --- Main Page ---

function HomePage() {
  const user = useAuthStore((s) => s.user)
  const linkedPersonId = user?.linkedPersonId
  const [showTour, setShowTour] = useState(false)

  const { data: dashboard, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard", linkedPersonId, user?.role],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (linkedPersonId) params.person_id = linkedPersonId
      if (user?.role) params.user_role = user.role
      const res = await api.get("/dashboard", { params })
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

  const stats = dashboard?.family_stats
  const branch = dashboard?.my_branch
  const adminStats = dashboard?.admin_stats

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      <AppHeader />

      <div className="max-w-6xl mx-auto px-4 pt-18 pb-20 sm:pt-22 sm:pb-10">

        {/* ═══ HERO: Greeting + Stats Banner ═══ */}
        <section className="pt-2 sm:pt-4 pb-6" aria-label="Welcome and family overview">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-earth-900 dark:text-dark-text leading-tight">
                {greeting}, {user?.displayName?.split(" ")[0] ?? "there"}
              </h1>
              <p className="text-sm text-sage-400 dark:text-dark-text-muted mt-1">
                {stats ? `${stats.total_persons} people across ${stats.total_generations} generations` : "Loading your family..."}
              </p>
            </div>
            {linkedPersonId && (
              <button
                onClick={() => setShowTour(true)}
                className="hidden sm:flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary-dark dark:text-primary px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors"
                aria-label="Start guided family tour"
              >
                <Sparkles className="h-4 w-4" />
                Meet Your Family
              </button>
            )}
          </div>

          {/* Stats row — scrollable on mobile */}
          {stats && (
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 sm:grid sm:grid-cols-5 sm:overflow-visible" role="list" aria-label="Family statistics">
              <StatPill icon={<Users className="h-5 w-5" />} value={stats.total_persons} label="People" to="/search" />
              <StatPill icon={<TreePine className="h-5 w-5" />} value={stats.total_generations} label="Generations" to="/tree" />
              <StatPill icon={<Globe className="h-5 w-5" />} value={stats.countries_lived_in} label="Countries" to="/map" />
              <StatPill icon={<Heart className="h-5 w-5" />} value={stats.total_stories || "—"} label="Stories" to="/search" />
              <StatPill icon={<Image className="h-5 w-5" />} value={stats.total_media || "—"} label="Photos" to="/media" />
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-label="Loading" />
            </div>
          )}
        </section>

        {dashboard && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* ═══ LEFT COLUMN (Primary) ═══ */}
            <div className="lg:col-span-3 space-y-6">

              {/* On This Day */}
              {dashboard.on_this_day.length > 0 && (
                <section aria-label="On this day in family history">
                  <h2 className="flex items-center gap-2 text-base font-bold text-earth-900 dark:text-dark-text mb-3">
                    <Calendar className="h-4 w-4 text-primary" />
                    On This Day
                  </h2>
                  <div className="space-y-2">
                    {dashboard.on_this_day.map((item, i) => {
                      const Icon = item.type === "birth" ? Cake : item.type === "marriage" ? Heart : Clock
                      const colors = item.type === "birth"
                        ? "bg-blue-50 dark:bg-blue-900/10 border-blue-200/60 dark:border-blue-800/30"
                        : item.type === "marriage"
                          ? "bg-pink-50 dark:bg-pink-900/10 border-pink-200/60 dark:border-pink-800/30"
                          : "bg-sage-50 dark:bg-dark-surface/50 border-sage-200/60 dark:border-dark-border/50"
                      const iconColor = item.type === "birth" ? "text-blue-600 dark:text-blue-400" : item.type === "marriage" ? "text-pink-600 dark:text-pink-400" : "text-sage-500 dark:text-sage-400"

                      const inner = (
                        <div className={cn("flex items-center gap-3 border rounded-xl px-4 py-3 transition-all", colors, item.person_id && "hover:shadow-md cursor-pointer")}>
                          <Icon className={cn("h-4 w-4 flex-shrink-0", iconColor)} aria-hidden="true" />
                          <p className="text-sm text-earth-900 dark:text-dark-text flex-1">
                            <span className="font-semibold">{item.person_name}</span>
                            {item.type === "birth" && <> was born on this day{item.year ? ` in ${item.year}` : ""}</>}
                            {item.type === "death" && <> passed away on this day{item.year ? ` in ${item.year}` : ""}</>}
                            {item.type === "marriage" && <> married on this day{item.year ? ` in ${item.year}` : ""}</>}
                          </p>
                          {item.person_id && <ArrowRight className="h-3.5 w-3.5 text-sage-300 flex-shrink-0" aria-hidden="true" />}
                        </div>
                      )

                      return item.person_id ? (
                        <Link key={i} to="/person/$personId" params={{ personId: item.person_id }}>{inner}</Link>
                      ) : (
                        <div key={i}>{inner}</div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Your Branch */}
              {branch && branch.members.length > 0 && (
                <section aria-label="Your immediate family">
                  <h2 className="flex items-center gap-2 text-base font-bold text-earth-900 dark:text-dark-text mb-3">
                    <GitBranch className="h-4 w-4 text-primary" />
                    Your Family
                  </h2>
                  <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4">
                    <div className="flex flex-wrap gap-3">
                      {branch.members.map((m) => (
                        <Link
                          key={m.id}
                          to="/person/$personId"
                          params={{ personId: m.id }}
                          className="flex items-center gap-2.5 bg-sage-50 dark:bg-dark-surface rounded-lg px-3 py-2 hover:bg-sage-100 dark:hover:bg-dark-card transition-colors group min-w-0"
                        >
                          {m.profile_photo_url ? (
                            <img src={m.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-sage-200 dark:border-dark-border flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary-dark flex-shrink-0">
                              {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-earth-900 dark:text-dark-text truncate group-hover:text-primary-dark transition-colors">{m.name}</p>
                            <p className="text-[10px] text-sage-400 dark:text-dark-text-muted capitalize">{m.relationship}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-sage-100 dark:border-dark-border">
                      <Link
                        to="/person/$personId"
                        params={{ personId: linkedPersonId! }}
                        className="text-xs font-medium text-primary-dark dark:text-primary hover:text-primary transition-colors flex items-center gap-1"
                      >
                        View your full profile <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </section>
              )}

              {/* Explore — feature cards */}
              <section aria-label="Explore your family history">
                <h2 className="flex items-center gap-2 text-base font-bold text-earth-900 dark:text-dark-text mb-3">
                  <Search className="h-4 w-4 text-primary" />
                  Explore
                </h2>
                <div className="space-y-2">
                  <ExploreCard icon={<TreePine className="h-5 w-5 text-primary-dark" />} title="Family Tree" description="Navigate your complete family tree with interactive visualization" to="/tree" />
                  <ExploreCard icon={<Globe className="h-5 w-5 text-primary-dark" />} title="Migration Map" description="See where your family has lived across the world through history" to="/map" />
                  <ExploreCard icon={<GitBranch className="h-5 w-5 text-primary-dark" />} title="How Are We Related?" description="Discover the connection between any two family members" to="/related" />
                  <ExploreCard icon={<BarChart3 className="h-5 w-5 text-primary-dark" />} title="Family Statistics" description="Name patterns, lifespans, and geographic distribution" to="/stats" />
                  <ExploreCard icon={<UtensilsCrossed className="h-5 w-5 text-primary-dark" />} title="Recipes & Traditions" description="Family recipes, customs, and sayings passed down through generations" to="/traditions" />
                </div>
              </section>
            </div>

            {/* ═══ RIGHT COLUMN (Secondary) ═══ */}
            <div className="lg:col-span-2 space-y-6">

              {/* Role-Based Panel */}
              {user?.role === "admin" && adminStats && (
                <section aria-label="Administration overview" className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-earth-900 dark:text-dark-text mb-3">
                    <Shield className="h-4 w-4 text-primary" />
                    Admin
                  </h3>
                  <div className="space-y-2">
                    <Link to="/admin" className="flex items-center justify-between bg-sage-50 dark:bg-dark-surface rounded-lg px-3 py-2.5 hover:bg-sage-100 dark:hover:bg-dark-card transition-colors">
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-sage-400" />
                        <span className="text-sm text-earth-900 dark:text-dark-text">Pending Signups</span>
                      </div>
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded-full",
                        adminStats.pending_signups > 0 ? "bg-primary/15 text-primary-dark" : "bg-sage-100 dark:bg-dark-border text-sage-400"
                      )}>
                        {adminStats.pending_signups}
                      </span>
                    </Link>
                    <Link to="/admin" className="flex items-center justify-between bg-sage-50 dark:bg-dark-surface rounded-lg px-3 py-2.5 hover:bg-sage-100 dark:hover:bg-dark-card transition-colors">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-sage-400" />
                        <span className="text-sm text-earth-900 dark:text-dark-text">Total Users</span>
                      </div>
                      <span className="text-xs font-bold bg-sage-100 dark:bg-dark-border text-sage-400 px-2 py-0.5 rounded-full">{adminStats.total_users}</span>
                    </Link>
                    <Link to="/admin" className="flex items-center justify-between bg-sage-50 dark:bg-dark-surface rounded-lg px-3 py-2.5 hover:bg-sage-100 dark:hover:bg-dark-card transition-colors">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-sage-400" />
                        <span className="text-sm text-earth-900 dark:text-dark-text">Recent Actions</span>
                      </div>
                      <span className="text-xs font-bold bg-sage-100 dark:bg-dark-border text-sage-400 px-2 py-0.5 rounded-full">{adminStats.recent_audit_count}</span>
                    </Link>
                  </div>
                </section>
              )}

              {user?.role === "editor" && (
                <section aria-label="Contribute to the family archive" className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-earth-900 dark:text-dark-text mb-3">
                    <Edit className="h-4 w-4 text-primary" />
                    Contribute
                  </h3>
                  <div className="space-y-2">
                    <Link to="/search" className="flex items-center gap-2 bg-sage-50 dark:bg-dark-surface rounded-lg px-3 py-2.5 text-sm text-earth-900 dark:text-dark-text hover:bg-sage-100 dark:hover:bg-dark-card transition-colors">
                      <BookOpen className="h-4 w-4 text-sage-400" /> Write a family story
                    </Link>
                    <Link to="/search" className="flex items-center gap-2 bg-sage-50 dark:bg-dark-surface rounded-lg px-3 py-2.5 text-sm text-earth-900 dark:text-dark-text hover:bg-sage-100 dark:hover:bg-dark-card transition-colors">
                      <MessageSquare className="h-4 w-4 text-sage-400" /> Share a memory
                    </Link>
                    <Link to="/traditions" className="flex items-center gap-2 bg-sage-50 dark:bg-dark-surface rounded-lg px-3 py-2.5 text-sm text-earth-900 dark:text-dark-text hover:bg-sage-100 dark:hover:bg-dark-card transition-colors">
                      <UtensilsCrossed className="h-4 w-4 text-sage-400" /> Add a family recipe
                    </Link>
                  </div>
                </section>
              )}

              {user?.role === "viewer" && (
                <section aria-label="Discover your heritage" className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-earth-900 dark:text-dark-text mb-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Discover
                  </h3>
                  <p className="text-xs text-sage-400 dark:text-dark-text-muted mb-3">Explore your heritage and connect with your family history.</p>
                  <div className="space-y-2">
                    <Link to="/tree" className="flex items-center gap-2 bg-sage-50 dark:bg-dark-surface rounded-lg px-3 py-2.5 text-sm text-earth-900 dark:text-dark-text hover:bg-sage-100 transition-colors">
                      <TreePine className="h-4 w-4 text-sage-400" /> Browse the family tree
                    </Link>
                    <Link to="/map" className="flex items-center gap-2 bg-sage-50 dark:bg-dark-surface rounded-lg px-3 py-2.5 text-sm text-earth-900 dark:text-dark-text hover:bg-sage-100 transition-colors">
                      <MapPin className="h-4 w-4 text-sage-400" /> Explore migration paths
                    </Link>
                  </div>
                </section>
              )}

              {/* Recent Activity */}
              {dashboard.recent_activity.length > 0 && (
                <section aria-label="Recent family activity" className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-earth-900 dark:text-dark-text mb-3">
                    <Clock className="h-4 w-4 text-primary" />
                    Recent Activity
                  </h3>
                  <div className="space-y-0">
                    {dashboard.recent_activity.slice(0, 8).map((item, i) => {
                      const Icon = item.type === "story" ? BookOpen : item.type === "media" ? Image : item.type === "person" ? Users : Edit
                      return (
                        <div key={item.id + i} className="flex items-start gap-2.5 py-2 border-b border-sage-50 dark:border-dark-border/30 last:border-0">
                          <Icon className="h-3.5 w-3.5 text-sage-300 dark:text-dark-text-muted flex-shrink-0 mt-0.5" aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-earth-800 dark:text-dark-text leading-relaxed truncate">{item.label}</p>
                            <time className="text-[10px] text-sage-300 dark:text-dark-text-muted/60" dateTime={item.created_at}>{timeAgo(item.created_at)}</time>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {/* Fun Fact — single rotating fact */}
              {dashboard.fun_facts.length > 0 && (
                <section aria-label="Fun family fact" className="bg-primary/5 dark:bg-primary/5 rounded-xl border border-primary/15 p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-4 w-4 text-primary-dark dark:text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-primary-dark dark:text-primary mb-1">Did You Know?</p>
                      <p className="text-sm text-earth-800 dark:text-dark-text leading-relaxed">
                        {dashboard.fun_facts[Math.floor(Date.now() / 86400000) % dashboard.fun_facts.length]}
                      </p>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Family Tour modal */}
      {showTour && linkedPersonId && (
        <FamilyTour personId={linkedPersonId} onClose={() => setShowTour(false)} />
      )}
    </div>
  )
}

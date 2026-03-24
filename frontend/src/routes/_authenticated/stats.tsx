import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { BarChart3, Globe, Users, Clock, TrendingUp } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"

export const Route = createFileRoute("/_authenticated/stats")({
  component: StatsPage,
})

interface StatsData {
  name_frequencies: {
    first_names: { name: string; count: number }[]
    last_names: { name: string; count: number }[]
  }
  lifespan_stats: {
    average: number | null
    min: number | null
    max: number | null
    count: number
  }
  geographic_distribution: { country: string; count: number }[]
  generation_counts: { generation: number; count: number }[]
  migration_stats: {
    top_origins: { country: string; count: number }[]
    top_destinations: { country: string; count: number }[]
  }
}

function BarRow({ label, value, max, color = "bg-primary" }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-earth-900 dark:text-dark-text w-24 truncate text-right">{label}</span>
      <div className="flex-1 h-5 bg-sage-100 dark:bg-dark-surface rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-sage-400 w-8 text-right">{value}</span>
    </div>
  )
}

function StatsPage() {
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ["family-stats"],
    queryFn: async () => {
      const res = await api.get("/stats")
      return res.data
    },
  })

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      <AppHeader />
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <BarChart3 className="h-7 w-7 text-primary-dark" />
          </div>
          <h1 className="text-3xl font-bold text-earth-900 dark:text-dark-text">Family Statistics</h1>
          <p className="text-sage-400 dark:text-dark-text-muted mt-2">Patterns and numbers from your family history.</p>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {stats && (
          <div className="space-y-8">
            {/* Name Frequencies */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <section className="bg-white/80 dark:bg-dark-card/80 rounded-2xl border border-sage-200 dark:border-dark-border p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-earth-900 dark:text-dark-text mb-4">
                  <Users className="h-4 w-4 text-primary" /> Most Common First Names
                </h2>
                <div className="space-y-2">
                  {stats.name_frequencies.first_names.map((n) => (
                    <BarRow key={n.name} label={n.name} value={n.count} max={stats.name_frequencies.first_names[0]?.count ?? 1} />
                  ))}
                  {stats.name_frequencies.first_names.length === 0 && <p className="text-sage-400 text-sm">Not enough data.</p>}
                </div>
              </section>

              <section className="bg-white/80 dark:bg-dark-card/80 rounded-2xl border border-sage-200 dark:border-dark-border p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-earth-900 dark:text-dark-text mb-4">
                  <Users className="h-4 w-4 text-primary" /> Most Common Last Names
                </h2>
                <div className="space-y-2">
                  {stats.name_frequencies.last_names.map((n) => (
                    <BarRow key={n.name} label={n.name} value={n.count} max={stats.name_frequencies.last_names[0]?.count ?? 1} color="bg-blue-500" />
                  ))}
                </div>
              </section>
            </div>

            {/* Lifespan Stats */}
            {stats.lifespan_stats.count > 0 && (
              <section className="bg-white/80 dark:bg-dark-card/80 rounded-2xl border border-sage-200 dark:border-dark-border p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-earth-900 dark:text-dark-text mb-4">
                  <Clock className="h-4 w-4 text-primary" /> Lifespan
                </h2>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-3xl font-bold text-earth-900 dark:text-dark-text">{stats.lifespan_stats.average ? Math.round(stats.lifespan_stats.average) : "\u2014"}</p>
                    <p className="text-xs text-sage-400 mt-1">Average Age</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-earth-900 dark:text-dark-text">{stats.lifespan_stats.min ?? "\u2014"}</p>
                    <p className="text-xs text-sage-400 mt-1">Youngest</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-earth-900 dark:text-dark-text">{stats.lifespan_stats.max ?? "\u2014"}</p>
                    <p className="text-xs text-sage-400 mt-1">Oldest</p>
                  </div>
                </div>
                <p className="text-xs text-sage-300 text-center mt-3">Based on {stats.lifespan_stats.count} deceased family members with known dates.</p>
              </section>
            )}

            {/* Geographic Distribution */}
            {stats.geographic_distribution.length > 0 && (
              <section className="bg-white/80 dark:bg-dark-card/80 rounded-2xl border border-sage-200 dark:border-dark-border p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-earth-900 dark:text-dark-text mb-4">
                  <Globe className="h-4 w-4 text-primary" /> Where the Family Has Lived
                </h2>
                <div className="space-y-2">
                  {stats.geographic_distribution.map((g) => (
                    <BarRow key={g.country} label={g.country} value={g.count} max={stats.geographic_distribution[0]?.count ?? 1} color="bg-amber-500" />
                  ))}
                </div>
              </section>
            )}

            {/* Generations */}
            {stats.generation_counts.length > 0 && (
              <section className="bg-white/80 dark:bg-dark-card/80 rounded-2xl border border-sage-200 dark:border-dark-border p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-earth-900 dark:text-dark-text mb-4">
                  <TrendingUp className="h-4 w-4 text-primary" /> Family Growth by Generation
                </h2>
                <div className="space-y-2">
                  {stats.generation_counts.map((g) => (
                    <BarRow key={g.generation} label={`Gen ${g.generation + 1}`} value={g.count} max={Math.max(...stats.generation_counts.map((x) => x.count))} color="bg-purple-500" />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

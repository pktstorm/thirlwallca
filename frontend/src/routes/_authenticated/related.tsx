import { useState, useMemo } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { GitBranch, Search, ArrowRight, User, Loader2, X, ChevronRight } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { useAuthStore } from "../../stores/authStore"
import { cn } from "../../lib/utils"

export const Route = createFileRoute("/_authenticated/related")({
  component: RelatedPage,
})

interface PersonOption {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  profile_photo_url: string | null
  gender: string
}

interface RelationshipPathStep {
  person_id: string
  person_name: string
  relationship: string
  direction: string
}

interface RelationshipPathResponse {
  path: RelationshipPathStep[]
  label: string
  description: string
  found: boolean
}

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

function genderBg(gender: string): string {
  switch (gender) {
    case "female": return "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300"
    case "male": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    default: return "bg-sage-100 text-sage-800 dark:bg-dark-surface dark:text-dark-text"
  }
}

function PersonPicker({
  label,
  selected,
  onSelect,
  onClear,
  excludeId,
}: {
  label: string
  selected: PersonOption | null
  onSelect: (p: PersonOption) => void
  onClear: () => void
  excludeId?: string
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  const { data: results } = useQuery<PersonOption[]>({
    queryKey: ["person-search-related", query],
    queryFn: async () => {
      const res = await api.get("/search", { params: { q: query, limit: 10 } })
      return res.data
    },
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  })

  const filtered = useMemo(() => {
    if (!results) return []
    return results.filter((p) => p.id !== excludeId)
  }, [results, excludeId])

  if (selected) {
    return (
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-sage-400 dark:text-dark-text-muted">{label}</label>
        <div className="flex items-center gap-3 bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-3">
          {selected.profile_photo_url ? (
            <img src={selected.profile_photo_url} alt="" className="w-10 h-10 rounded-full object-cover border border-sage-200" />
          ) : (
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold", genderBg(selected.gender))}>
              {getInitials(selected.first_name, selected.last_name)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-earth-900 dark:text-dark-text text-sm">{selected.first_name} {selected.last_name}</p>
            {selected.birth_date && <p className="text-xs text-sage-400">b. {selected.birth_date.split("-")[0]}</p>}
          </div>
          <button onClick={onClear} className="p-1 text-sage-400 hover:text-red-500 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5 relative">
      <label className="text-xs font-bold uppercase tracking-wider text-sage-400 dark:text-dark-text-muted">{label}</label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sage-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { if (query.trim().length >= 2) setOpen(true) }}
          placeholder="Search by name..."
          className="w-full rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card py-3 pl-10 pr-4 text-sm text-earth-900 dark:text-dark-text placeholder:text-sage-300 focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
        />
      </div>
      {open && filtered.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-lg">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => { onSelect(p); setOpen(false); setQuery("") }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors"
              >
                {p.profile_photo_url ? (
                  <img src={p.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold", genderBg(p.gender))}>
                    {getInitials(p.first_name, p.last_name)}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-earth-900 dark:text-dark-text">{p.first_name} {p.last_name}</p>
                  {p.birth_date && <p className="text-xs text-sage-400">b. {p.birth_date.split("-")[0]}</p>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function RelatedPage() {
  const linkedPersonId = useAuthStore((s) => s.user?.linkedPersonId)

  const [personA, setPersonA] = useState<PersonOption | null>(null)
  const [personB, setPersonB] = useState<PersonOption | null>(null)

  // Auto-set person A to logged-in user if linked
  const { data: linkedPerson } = useQuery<PersonOption>({
    queryKey: ["linked-person-for-related", linkedPersonId],
    queryFn: async () => {
      const res = await api.get(`/persons/${linkedPersonId}`)
      return res.data
    },
    enabled: !!linkedPersonId,
  })

  const effectiveA = personA ?? (linkedPerson ? {
    ...linkedPerson,
    id: linkedPerson.id,
    gender: linkedPerson.gender ?? "unknown",
  } : null)

  const { data: relationship, isLoading: pathLoading } = useQuery<RelationshipPathResponse>({
    queryKey: ["relationship-path-tool", effectiveA?.id, personB?.id],
    queryFn: async () => {
      const res = await api.get(`/tree/relationship/${effectiveA!.id}/to/${personB!.id}`)
      return res.data
    },
    enabled: !!effectiveA?.id && !!personB?.id,
  })

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      <AppHeader />

      <div className="max-w-2xl mx-auto px-4 pt-20 pb-8 sm:pt-24 sm:pb-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <GitBranch className="h-7 w-7 text-primary-dark" />
          </div>
          <h1 className="text-3xl font-bold text-earth-900 dark:text-dark-text">How Are We Related?</h1>
          <p className="text-sage-400 dark:text-dark-text-muted mt-2">
            Pick two people to discover how they're connected in the family tree.
          </p>
        </div>

        {/* Person pickers */}
        <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl border border-sage-200 dark:border-dark-border p-6 shadow-sm space-y-5">
          <PersonPicker
            label="Person 1"
            selected={effectiveA}
            onSelect={setPersonA}
            onClear={() => setPersonA(null)}
            excludeId={personB?.id}
          />

          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-sage-100 dark:bg-dark-surface flex items-center justify-center">
              <ArrowRight className="h-4 w-4 text-sage-400 rotate-90" />
            </div>
          </div>

          <PersonPicker
            label="Person 2"
            selected={personB}
            onSelect={setPersonB}
            onClear={() => setPersonB(null)}
            excludeId={effectiveA?.id}
          />
        </div>

        {/* Result */}
        {pathLoading && effectiveA && personB && (
          <div className="mt-8 flex justify-center">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sage-400 text-sm">Finding connection...</span>
            </div>
          </div>
        )}

        {relationship && !pathLoading && (
          <div className="mt-8 space-y-6">
            {relationship.found ? (
              <>
                {/* Relationship label */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-6 py-3 rounded-full">
                    <GitBranch className="h-5 w-5 text-primary-dark" />
                    <span className="text-lg font-bold text-primary-dark dark:text-primary">
                      {relationship.description}
                    </span>
                  </div>
                </div>

                {/* Path visualization */}
                {relationship.path.length > 0 && (
                  <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-2xl border border-sage-200 dark:border-dark-border p-6 shadow-sm">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-sage-400 dark:text-dark-text-muted mb-4">Connection Path</h3>
                    <div className="space-y-0">
                      {relationship.path.map((step, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                            i === 0 || i === relationship.path.length - 1
                              ? "bg-primary/20 text-primary-dark"
                              : "bg-sage-100 dark:bg-dark-surface text-sage-600 dark:text-dark-text-muted",
                          )}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0 py-2">
                            <Link
                              to="/person/$personId"
                              params={{ personId: step.person_id }}
                              className="text-sm font-medium text-earth-900 dark:text-dark-text hover:text-primary-dark transition-colors"
                            >
                              {step.person_name}
                            </Link>
                            {i < relationship.path.length - 1 && (
                              <p className="text-[10px] text-sage-400 dark:text-dark-text-muted mt-0.5">
                                {step.relationship} ({step.direction})
                              </p>
                            )}
                          </div>
                          {i < relationship.path.length - 1 && (
                            <ChevronRight className="h-4 w-4 text-sage-300 flex-shrink-0 rotate-90" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center bg-white/80 dark:bg-dark-card/80 rounded-2xl border border-sage-200 dark:border-dark-border p-8">
                <User className="h-10 w-10 text-sage-300 mx-auto mb-3" />
                <p className="text-sage-400 dark:text-dark-text-muted font-medium">No connection found</p>
                <p className="text-sage-300 text-sm mt-1">These two people don't appear to be connected in the family tree.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

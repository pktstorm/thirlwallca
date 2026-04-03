import { useQuery } from "@tanstack/react-query"
import { AlertCircle, ArrowRight } from "lucide-react"
import { api } from "../../lib/api"
import { cn } from "../../lib/utils"

interface Suggestion {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  profile_photo_url: string | null
  gender: string
  match_reason: string
}

interface PersonSuggestionsProps {
  firstName: string
  lastName: string
  birthYear?: number | null
  excludeId?: string
  onSelectExisting: (personId: string) => void
}

function genderBg(gender: string): string {
  switch (gender) {
    case "female": return "bg-pink-100 text-pink-700"
    case "male": return "bg-blue-100 text-blue-700"
    default: return "bg-sage-100 text-sage-600"
  }
}

export function PersonSuggestions({ firstName, lastName, birthYear, excludeId, onSelectExisting }: PersonSuggestionsProps) {
  const hasEnoughInput = firstName.trim().length >= 2 || lastName.trim().length >= 2

  const { data: suggestions } = useQuery<Suggestion[]>({
    queryKey: ["person-suggestions", firstName, lastName, birthYear],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (firstName.trim()) params.first_name = firstName.trim()
      if (lastName.trim()) params.last_name = lastName.trim()
      if (birthYear) params.birth_year = String(birthYear)
      if (excludeId) params.exclude_id = excludeId
      const res = await api.get("/persons/suggestions", { params })
      return res.data
    },
    enabled: hasEnoughInput,
    staleTime: 10_000,
  })

  if (!suggestions || suggestions.length === 0) return null

  return (
    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Possible existing matches</p>
      </div>
      <div className="space-y-1.5">
        {suggestions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelectExisting(s.id)}
            className="w-full flex items-center gap-2.5 bg-white dark:bg-dark-card rounded-lg border border-amber-200/50 dark:border-amber-800/20 px-3 py-2 text-left hover:border-primary/40 hover:shadow-sm transition-all group"
          >
            {s.profile_photo_url ? (
              <img src={s.profile_photo_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0", genderBg(s.gender))}>
                {s.first_name.charAt(0)}{s.last_name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-earth-900 dark:text-dark-text group-hover:text-primary-dark transition-colors">
                {s.first_name} {s.last_name}
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400">{s.match_reason}</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-medium text-primary-dark opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              Use this person <ArrowRight className="h-3 w-3" />
            </div>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-amber-600/60 dark:text-amber-400/40">Click a match to link to them instead of creating a duplicate.</p>
    </div>
  )
}

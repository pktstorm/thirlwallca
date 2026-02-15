import { Search, Users } from "lucide-react"
import { PersonCard, type PersonCardData } from "./PersonCard"
export type { PersonCardData } from "./PersonCard"

type SortOption = "relevance" | "name_asc" | "name_desc" | "birth_asc" | "birth_desc"

interface PersonCardGridProps {
  persons: PersonCardData[]
  totalCount: number
  isLoading: boolean
  isError: boolean
  error: Error | null
  query: string
  sortBy: SortOption
  onSortChange: (sort: SortOption) => void
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-5 animate-pulse"
        >
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-sage-100 dark:bg-dark-surface shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 bg-sage-100 dark:bg-dark-surface rounded w-3/4" />
              <div className="h-4 bg-sage-100 dark:bg-dark-surface rounded w-1/2" />
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-4 bg-sage-100 dark:bg-dark-surface rounded w-2/3" />
            <div className="h-4 bg-sage-100 dark:bg-dark-surface rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PersonCardGrid({
  persons,
  totalCount,
  isLoading,
  isError,
  error,
  query,
  sortBy,
  onSortChange,
}: PersonCardGridProps) {
  return (
    <div>
      {/* Results header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-earth-900 dark:text-dark-text">Search Results</h2>
          {!isLoading && query && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-primary/20 text-primary-dark">
              {totalCount} {totalCount === 1 ? "result" : "results"}
            </span>
          )}
        </div>

        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="text-sm border border-sage-200 dark:border-dark-border rounded-lg px-3 py-1.5 text-earth-900 dark:text-dark-text bg-white dark:bg-dark-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="relevance">Relevance</option>
          <option value="name_asc">Name (A-Z)</option>
          <option value="name_desc">Name (Z-A)</option>
          <option value="birth_asc">Birth (Oldest)</option>
          <option value="birth_desc">Birth (Newest)</option>
        </select>
      </div>

      {/* Loading state */}
      {isLoading && <LoadingSkeleton />}

      {/* Error state */}
      {isError && (
        <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm px-6 py-12 text-center">
          <p className="text-red-600 dark:text-red-400 font-medium mb-1">
            Failed to load results
          </p>
          <p className="text-sage-400 dark:text-dark-text-muted text-sm">
            {error instanceof Error ? error.message : "An unexpected error occurred."}
          </p>
        </div>
      )}

      {/* Empty state - no query */}
      {!isLoading && !isError && !query && (
        <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm px-6 py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-sage-50 dark:bg-dark-surface flex items-center justify-center">
            <Search className="h-8 w-8 text-sage-300 dark:text-dark-text-muted" />
          </div>
          <h3 className="text-lg font-bold text-earth-900 dark:text-dark-text mb-2">
            Start Your Search
          </h3>
          <p className="text-sage-400 dark:text-dark-text-muted text-sm max-w-md mx-auto">
            Enter a name, place, or keyword above to search through the family
            tree and discover your ancestors.
          </p>
        </div>
      )}

      {/* Empty state - no results */}
      {!isLoading && !isError && query && persons.length === 0 && (
        <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm px-6 py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-sage-50 dark:bg-dark-surface flex items-center justify-center">
            <Users className="h-8 w-8 text-sage-300 dark:text-dark-text-muted" />
          </div>
          <h3 className="text-lg font-bold text-earth-900 dark:text-dark-text mb-2">
            No Ancestors Found
          </h3>
          <p className="text-sage-400 dark:text-dark-text-muted text-sm max-w-md mx-auto">
            No results match &ldquo;{query}&rdquo;. Try adjusting your search
            terms or filters.
          </p>
        </div>
      )}

      {/* Results grid */}
      {!isLoading && !isError && persons.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {persons.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      )}
    </div>
  )
}

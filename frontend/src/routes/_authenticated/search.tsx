import { useCallback, useEffect, useMemo, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { api } from "../../lib/api"
import { useSearchStore } from "../../stores/searchStore"
import { AppHeader } from "../../components/layout/AppHeader"
import { Breadcrumbs } from "../../components/layout/Breadcrumbs"
import { FilterSidebar } from "../../components/search/FilterSidebar"
import {
  PersonCardGrid,
  type PersonCardData,
} from "../../components/search/PersonCardGrid"

interface SearchParams {
  q?: string
}

export const Route = createFileRoute("/_authenticated/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: SearchPage,
})

type SortOption =
  | "relevance"
  | "name_asc"
  | "name_desc"
  | "birth_asc"
  | "birth_desc"

interface PersonResponse {
  id: string
  first_name: string
  last_name: string
  middle_name: string | null
  maiden_name: string | null
  suffix: string | null
  gender: string
  birth_date: string | null
  death_date: string | null
  birth_date_approx: boolean
  death_date_approx: boolean
  is_living: boolean
  bio: string | null
  occupation: string | null
  profile_photo_url: string | null
  created_at: string
  updated_at: string
}

function toPersonCardData(p: PersonResponse): PersonCardData {
  return {
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    middleName: p.middle_name,
    maidenName: p.maiden_name,
    suffix: p.suffix,
    gender: p.gender,
    birthDate: p.birth_date,
    birthDateApprox: p.birth_date_approx,
    deathDate: p.death_date,
    deathDateApprox: p.death_date_approx,
    isLiving: p.is_living,
    bio: p.bio,
    occupation: p.occupation,
    profilePhotoUrl: p.profile_photo_url,
  }
}

const PAGE_SIZE = 50

function SearchPage() {
  const navigate = useNavigate()
  const { q } = Route.useSearch()

  // Search store
  const query = useSearchStore((s) => s.query)
  const filters = useSearchStore((s) => s.filters)
  const setQuery = useSearchStore((s) => s.setQuery)
  const setFilter = useSearchStore((s) => s.setFilter)
  const resetFilters = useSearchStore((s) => s.resetFilters)

  // Local UI state
  const [inputValue, setInputValue] = useState(q ?? "")
  const [sortBy, setSortBy] = useState<SortOption>("relevance")
  const [page, setPage] = useState(0)
  const [filterSidebarOpen, setFilterSidebarOpen] = useState(false)

  // Sync URL param -> store on mount / URL change
  useEffect(() => {
    if (q !== undefined && q !== query) {
      setQuery(q)
      setInputValue(q)
    }
  }, [q, query, setQuery])

  // Reset page when query or filters change
  useEffect(() => {
    setPage(0)
  }, [query, filters])

  // Build query params
  const searchParams = useMemo(() => {
    const params: Record<string, string> = {}
    if (query) params.q = query
    if (filters.places.length > 0) params.place = filters.places.join(",")
    if (filters.occupations.length > 0)
      params.occupation = filters.occupations.join(",")
    params.skip = String(page * PAGE_SIZE)
    params.limit = String(PAGE_SIZE)
    return params
  }, [query, filters.places, filters.occupations, page])

  // Fetch search results
  const {
    data: rawResults,
    isLoading,
    isError,
    error,
  } = useQuery<PersonResponse[]>({
    queryKey: ["search", searchParams],
    queryFn: async () => {
      const res = await api.get("/search", {
        params: searchParams,
      })
      const data = res.data
      // API returns list[PersonResponse]; guard against unexpected shapes
      if (Array.isArray(data)) return data
      if (data && Array.isArray(data.items)) return data.items
      if (data && Array.isArray(data.results)) return data.results
      return []
    },
    enabled: !!query,
  })

  // Transform to card data
  const allResults = useMemo(
    () => (rawResults ?? []).map(toPersonCardData),
    [rawResults],
  )

  // Client-side era filtering (API doesn't support era params)
  const eraFiltered = useMemo(() => {
    let results = allResults
    if (filters.eraFrom !== null) {
      results = results.filter((p) => {
        if (!p.birthDate) return false
        const year = parseInt(p.birthDate.slice(0, 4), 10)
        return year >= filters.eraFrom!
      })
    }
    if (filters.eraTo !== null) {
      results = results.filter((p) => {
        if (!p.birthDate) return true // include unknowns when filtering by max year
        const year = parseInt(p.birthDate.slice(0, 4), 10)
        return year <= filters.eraTo!
      })
    }
    return results
  }, [allResults, filters.eraFrom, filters.eraTo])

  // Client-side sorting
  const sortedResults = useMemo(() => {
    const sorted = [...eraFiltered]
    switch (sortBy) {
      case "name_asc":
        sorted.sort((a, b) =>
          `${a.lastName} ${a.firstName}`.localeCompare(
            `${b.lastName} ${b.firstName}`,
          ),
        )
        break
      case "name_desc":
        sorted.sort((a, b) =>
          `${b.lastName} ${b.firstName}`.localeCompare(
            `${a.lastName} ${a.firstName}`,
          ),
        )
        break
      case "birth_asc":
        sorted.sort(
          (a, b) =>
            (a.birthDate ?? "9999").localeCompare(b.birthDate ?? "9999"),
        )
        break
      case "birth_desc":
        sorted.sort(
          (a, b) =>
            (b.birthDate ?? "0000").localeCompare(a.birthDate ?? "0000"),
        )
        break
      default:
        // relevance = API order
        break
    }
    return sorted
  }, [eraFiltered, sortBy])

  // Derive facets from results for filter sidebar
  const availableOccupations = useMemo(() => {
    const occs = new Set<string>()
    for (const p of allResults) {
      if (p.occupation) occs.add(p.occupation)
    }
    return Array.from(occs).sort()
  }, [allResults])

  // Pagination
  const totalCount = sortedResults.length
  const hasNextPage = (rawResults?.length ?? 0) === PAGE_SIZE

  // Handlers
  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = inputValue.trim()
      if (trimmed) {
        setQuery(trimmed)
        navigate({
          to: "/search",
          search: { q: trimmed },
          replace: true,
        } as any)
      }
    },
    [inputValue, setQuery, navigate],
  )

  const handlePlaceToggle = useCallback(
    (place: string) => {
      const current = filters.places
      const updated = current.includes(place)
        ? current.filter((p) => p !== place)
        : [...current, place]
      setFilter("places", updated)
    },
    [filters.places, setFilter],
  )

  const handleOccupationToggle = useCallback(
    (occ: string) => {
      const current = filters.occupations
      const updated = current.includes(occ)
        ? current.filter((o) => o !== occ)
        : [...current, occ]
      setFilter("occupations", updated)
    },
    [filters.occupations, setFilter],
  )

  // Generate page numbers for pagination
  const pageNumbers = useMemo(() => {
    if (!hasNextPage && page === 0) return [0]
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(0, page - Math.floor(maxVisible / 2))
    const end = Math.min(start + maxVisible, page + 3)
    start = Math.max(0, end - maxVisible)
    for (let i = start; i < end; i++) {
      pages.push(i)
    }
    return pages
  }, [page, hasNextPage])

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      {/* Header */}
      <AppHeader hideSearch />

      {/* Main content with sidebar */}
      <div className="flex h-[calc(100vh-0px)] pt-16">
        {/* Filter sidebar */}
        <FilterSidebar
          availablePlaces={[]}
          selectedPlaces={filters.places}
          onPlaceToggle={handlePlaceToggle}
          eraFrom={filters.eraFrom}
          eraTo={filters.eraTo}
          onEraFromChange={(val) => setFilter("eraFrom", val)}
          onEraToChange={(val) => setFilter("eraTo", val)}
          availableOccupations={availableOccupations}
          selectedOccupations={filters.occupations}
          onOccupationToggle={handleOccupationToggle}
          onResetFilters={resetFilters}
          isOpen={filterSidebarOpen}
          onClose={() => setFilterSidebarOpen(false)}
        />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Breadcrumbs */}
            <div className="mb-6">
              <Breadcrumbs
                items={[{ label: "Search", active: true }]}
              />
            </div>

            {/* Page title + search input */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-earth-900 dark:text-dark-text mb-4 font-serif">
                Find Your Roots
              </h1>
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-sage-300 dark:text-dark-text-muted" />
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Search by name, place, or keyword..."
                  className="block w-full pl-12 pr-4 py-3 border-2 border-sage-200 dark:border-dark-border rounded-lg bg-white dark:bg-dark-surface text-earth-900 dark:text-dark-text placeholder-sage-300 dark:placeholder-dark-text-muted focus:outline-none focus:border-primary transition-colors text-base"
                />
                {/* Mobile filter toggle */}
                <button
                  type="button"
                  onClick={() => setFilterSidebarOpen(true)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-sage-400 dark:text-dark-text-muted hover:text-primary lg:hidden"
                >
                  <SlidersHorizontal className="h-5 w-5" />
                </button>
              </form>
            </div>

            {/* Results grid */}
            <PersonCardGrid
              persons={sortedResults}
              totalCount={totalCount}
              isLoading={isLoading}
              isError={isError}
              error={error}
              query={query}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />

            {/* Pagination */}
            {!isLoading && sortedResults.length > 0 && (hasNextPage || page > 0) && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg border border-sage-200 dark:border-dark-border text-sage-800 dark:text-dark-text hover:bg-sage-50 dark:hover:bg-dark-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {pageNumbers.map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={
                      pageNum === page
                        ? "w-9 h-9 rounded-lg text-sm font-medium bg-primary text-white"
                        : "w-9 h-9 rounded-lg text-sm font-medium border border-sage-200 dark:border-dark-border text-earth-900 dark:text-dark-text hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors"
                    }
                  >
                    {pageNum + 1}
                  </button>
                ))}

                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasNextPage}
                  className="p-2 rounded-lg border border-sage-200 dark:border-dark-border text-sage-800 dark:text-dark-text hover:bg-sage-50 dark:hover:bg-dark-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

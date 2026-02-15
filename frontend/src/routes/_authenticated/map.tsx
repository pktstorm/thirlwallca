import { useMemo } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { MapPin } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { Breadcrumbs } from "../../components/layout/Breadcrumbs"
import { AncestryMap } from "../../components/map/AncestryMap"
import { MapTimelineSlider } from "../../components/map/MapTimelineSlider"
import { PersonFilterPanel } from "../../components/map/PersonFilterPanel"
import { MapLayerControls } from "../../components/map/MapLayerControls"
import { useMapStore } from "../../stores/mapStore"
import type { MapPlace } from "../../types/location"

export const Route = createFileRoute("/_authenticated/map")({
  component: MapPage,
})

interface ApiMigration {
  id: string
  person_id: string
  from_location_id: string
  to_location_id: string
  year: number | null
  year_approx: boolean
  reason: string | null
  notes: string | null
}

interface ApiLocation {
  id: string
  name: string
  lat: number | null
  lng: number | null
  country: string | null
  region: string | null
}

interface ApiPerson {
  id: string
  first_name: string
  last_name: string | null
}

/** Compute the global min/max year from all migrations and person places. */
function computeYearBounds(
  migrations: ApiMigration[],
  personPlaces: MapPlace[],
): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const m of migrations) {
    if (m.year !== null) {
      if (m.year < min) min = m.year
      if (m.year > max) max = m.year
    }
  }
  for (const p of personPlaces) {
    if (p.year !== null) {
      if (p.year < min) min = p.year
      if (p.year > max) max = p.year
    }
  }
  if (min === Infinity || max === -Infinity) {
    return [1700, 2025]
  }
  return [min, max]
}

function MapPage() {
  const yearRange = useMapStore((s) => s.yearRange)
  const selectedPersonIds = useMapStore((s) => s.selectedPersonIds)
  const showMigrations = useMapStore((s) => s.showMigrations)

  const {
    data: migrations,
    isLoading: migrationsLoading,
    isError: migrationsError,
    error: migrationsErrorObj,
  } = useQuery<ApiMigration[]>({
    queryKey: ["migrations"],
    queryFn: async () => {
      const res = await api.get("/migrations")
      const data = res.data
      return Array.isArray(data) ? data : []
    },
  })

  const {
    data: locations,
    isLoading: locationsLoading,
    isError: locationsError,
  } = useQuery<ApiLocation[]>({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await api.get("/locations")
      const data = res.data
      return Array.isArray(data) ? data : []
    },
  })

  const {
    data: personPlaces,
    isLoading: placesLoading,
  } = useQuery<MapPlace[]>({
    queryKey: ["map-places"],
    queryFn: async () => {
      const res = await api.get("/map/places")
      const data = res.data
      return Array.isArray(data) ? data : []
    },
  })

  // Collect unique person IDs from migrations to fetch names
  const personIds = useMemo(() => {
    if (!migrations) return []
    const ids = new Set<string>()
    for (const m of migrations) {
      ids.add(m.person_id)
    }
    return Array.from(ids)
  }, [migrations])

  // Fetch person names in parallel
  const { data: personNames } = useQuery<Record<string, string>>({
    queryKey: ["persons", personIds],
    queryFn: async () => {
      if (personIds.length === 0) return {}
      const results = await Promise.allSettled(
        personIds.map((id) => api.get<ApiPerson>(`/persons/${id}`)),
      )
      const names: Record<string, string> = {}
      for (let i = 0; i < results.length; i++) {
        const result = results[i]!
        const id = personIds[i]!
        if (result.status === "fulfilled") {
          const person = result.value.data
          names[id] = [person.first_name, person.last_name]
            .filter(Boolean)
            .join(" ")
        }
      }
      return names
    },
    enabled: personIds.length > 0,
  })

  // Compute year bounds from all data
  const yearBounds = useMemo(() => {
    return computeYearBounds(migrations ?? [], personPlaces ?? [])
  }, [migrations, personPlaces])

  const activeYearRange = yearRange ?? yearBounds

  const isLoading = migrationsLoading || locationsLoading || placesLoading
  const isError = migrationsError || locationsError

  // Compute counts for layer controls (applying person + year filters)
  // Count explicit migrations
  const explicitMigrationCount = useMemo(() => {
    if (!migrations) return 0
    return migrations.filter((m) => {
      if (selectedPersonIds !== null && !selectedPersonIds.has(m.person_id)) return false
      if (m.year === null) return true
      return m.year >= activeYearRange[0] && m.year <= activeYearRange[1]
    }).length
  }, [migrations, activeYearRange, selectedPersonIds])

  // Count synthesized tracelines from person places (same logic as AncestryMap)
  const synthesizedTracelineCount = useMemo(() => {
    if (!personPlaces) return 0
    const byPerson = new Map<string, MapPlace[]>()
    for (const p of personPlaces) {
      if (selectedPersonIds !== null && !selectedPersonIds.has(p.person_id)) continue
      if (p.year !== null && (p.year < activeYearRange[0] || p.year > activeYearRange[1])) continue
      const list = byPerson.get(p.person_id)
      if (list) list.push(p)
      else byPerson.set(p.person_id, [p])
    }
    let count = 0
    for (const [, places] of byPerson) {
      if (places.length < 2) continue
      const sorted = [...places].sort((a, b) => {
        const typeOrder = (t: string) => (t === "birth" ? 0 : t === "death" ? 2 : 1)
        const oa = typeOrder(a.place_type)
        const ob = typeOrder(b.place_type)
        if (oa !== ob) return oa - ob
        return (a.year ?? 0) - (b.year ?? 0)
      })
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i]!.location_id !== sorted[i + 1]!.location_id) count++
      }
    }
    return count
  }, [personPlaces, activeYearRange, selectedPersonIds])

  const migrationCount = explicitMigrationCount + synthesizedTracelineCount

  const placeCounts = useMemo(() => {
    const counts = { birth: 0, death: 0, residence: 0 }
    if (!personPlaces) return counts
    for (const p of personPlaces) {
      if (selectedPersonIds !== null && !selectedPersonIds.has(p.person_id)) continue
      if (p.year !== null && (p.year < activeYearRange[0] || p.year > activeYearRange[1])) continue
      if (p.place_type === "birth") counts.birth++
      else if (p.place_type === "death") counts.death++
      else if (p.place_type === "residence") counts.residence++
    }
    return counts
  }, [personPlaces, activeYearRange, selectedPersonIds])

  const hasData =
    (migrations && migrations.length > 0) ||
    (personPlaces && personPlaces.length > 0)

  // Derive the full person list for the filter panel (no extra API call)
  const allPersons = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of personPlaces ?? []) {
      if (!map.has(p.person_id)) {
        map.set(p.person_id, p.person_name)
      }
    }
    for (const [id, name] of Object.entries(personNames ?? {})) {
      if (!map.has(id)) {
        map.set(id, name)
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [personPlaces, personNames])

  return (
    <div className="h-screen w-screen bg-sage-50 dark:bg-bg-dark relative overflow-hidden">
      {/* Header */}
      <AppHeader />

      {/* Breadcrumbs */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <Breadcrumbs items={[{ label: "Family Map", active: true }]} />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="h-full w-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sage-400 dark:text-dark-text-muted text-sm">Loading map data...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="h-full w-full flex items-center justify-center">
          <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm px-6 py-4 max-w-md text-center">
            <p className="text-red-600 dark:text-red-400 font-medium mb-1">
              Failed to load map data
            </p>
            <p className="text-sage-400 dark:text-dark-text-muted text-sm">
              {migrationsErrorObj instanceof Error
                ? migrationsErrorObj.message
                : "Unknown error"}
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && !hasData && (
        <div className="h-full w-full flex items-center justify-center">
          <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm px-8 py-6 max-w-md text-center">
            <MapPin className="h-10 w-10 text-sage-300 dark:text-dark-text-muted mx-auto mb-3" />
            <p className="text-earth-900 dark:text-dark-text font-medium mb-1">
              No locations recorded
            </p>
            <p className="text-sage-400 dark:text-dark-text-muted text-sm">
              Add birth places, death places, or residences to family members to see them on the map.
            </p>
          </div>
        </div>
      )}

      {/* Map */}
      {!isLoading && !isError && hasData && migrations && locations && (
        <div className="absolute inset-0">
          <AncestryMap
            migrations={migrations}
            locations={locations}
            personNames={personNames ?? {}}
            yearBounds={yearBounds}
            personPlaces={personPlaces ?? []}
          />
        </div>
      )}

      {/* Person filter panel + trigger button */}
      {!isLoading && hasData && (
        <PersonFilterPanel persons={allPersons} />
      )}

      {/* Layer controls - bottom left */}
      {!isLoading && hasData && (
        <div className="absolute bottom-6 left-6 z-30 pointer-events-auto">
          <MapLayerControls
            migrationCount={showMigrations ? migrationCount : 0}
            birthCount={placeCounts.birth}
            deathCount={placeCounts.death}
            residenceCount={placeCounts.residence}
          />
        </div>
      )}

      {/* Timeline slider - bottom center */}
      {!isLoading && hasData && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
          <MapTimelineSlider minYear={yearBounds[0]} maxYear={yearBounds[1]} />
        </div>
      )}
    </div>
  )
}

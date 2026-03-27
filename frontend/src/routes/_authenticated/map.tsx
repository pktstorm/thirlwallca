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
import { MapQuickActions } from "../../components/map/MapQuickActions"
import { useMapStore } from "../../stores/mapStore"
import { useAuthStore } from "../../stores/authStore"
import type { MapPlace, AncestorTrailResponse } from "../../types/location"

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

function computeYearBounds(
  migrations: ApiMigration[],
  personPlaces: MapPlace[],
): [number, number] {
  let min = Infinity, max = -Infinity
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
  return min === Infinity ? [1700, 2025] : [min, max]
}

function MapPage() {
  const yearRange = useMapStore((s) => s.yearRange)
  const selectedPersonIds = useMapStore((s) => s.selectedPersonIds)
  const showMigrations = useMapStore((s) => s.showMigrations)
  const mapMode = useMapStore((s) => s.mapMode)
  const focusPersonId = useMapStore((s) => s.focusPersonId)
  const linkedPersonId = useAuthStore((s) => s.user?.linkedPersonId)

  const {
    data: migrations,
    isLoading: migrationsLoading,
    isError: migrationsError,
    error: migrationsErrorObj,
  } = useQuery<ApiMigration[]>({
    queryKey: ["migrations"],
    queryFn: async () => {
      const res = await api.get("/migrations")
      return Array.isArray(res.data) ? res.data : []
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
      return Array.isArray(res.data) ? res.data : []
    },
  })

  const { data: personPlaces, isLoading: placesLoading } = useQuery<MapPlace[]>({
    queryKey: ["map-places"],
    queryFn: async () => {
      const res = await api.get("/map/places")
      return Array.isArray(res.data) ? res.data : []
    },
  })

  // Ancestor trail data (fetched when in ancestor/journey mode)
  const effectivePersonId = focusPersonId ?? linkedPersonId
  const { data: ancestorTrail, isLoading: ancestorTrailLoading } = useQuery<AncestorTrailResponse>({
    queryKey: ["ancestor-trail", effectivePersonId, mapMode],
    queryFn: async () => {
      const maxGen = mapMode === "my-journey" ? 0 : 10
      const res = await api.get(`/map/ancestor-trail/${effectivePersonId}`, {
        params: { max_generations: maxGen },
      })
      return res.data
    },
    enabled: (mapMode === "ancestor-trail" || mapMode === "my-journey") && !!effectivePersonId,
  })

  const personIds = useMemo(() => {
    if (!migrations) return []
    const ids = new Set<string>()
    for (const m of migrations) ids.add(m.person_id)
    return Array.from(ids)
  }, [migrations])

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
          names[id] = [person.first_name, person.last_name].filter(Boolean).join(" ")
        }
      }
      return names
    },
    enabled: personIds.length > 0,
  })

  // Compute year bounds from all data
  const allPlaces = useMemo(() => {
    const base = personPlaces ?? []
    const trail = ancestorTrail?.places ?? []
    return [...base, ...trail]
  }, [personPlaces, ancestorTrail])

  const yearBounds = useMemo(() => {
    return computeYearBounds(migrations ?? [], allPlaces)
  }, [migrations, allPlaces])

  const activeYearRange = yearRange ?? yearBounds
  const isLoading = migrationsLoading || locationsLoading || placesLoading
  const isError = migrationsError || locationsError

  // Compute layer counts
  const explicitMigrationCount = useMemo(() => {
    if (!migrations) return 0
    return migrations.filter((m) => {
      if (selectedPersonIds !== null && !selectedPersonIds.has(m.person_id)) return false
      if (m.year === null) return true
      return m.year >= activeYearRange[0] && m.year <= activeYearRange[1]
    }).length
  }, [migrations, activeYearRange, selectedPersonIds])

  const activePlacesForCount = mapMode !== "all" && ancestorTrail?.places
    ? ancestorTrail.places
    : personPlaces ?? []

  const synthesizedTracelineCount = useMemo(() => {
    const byPerson = new Map<string, MapPlace[]>()
    for (const p of activePlacesForCount) {
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
        const to = (t: string) => (t === "birth" ? 0 : t === "death" ? 2 : 1)
        if (to(a.place_type) !== to(b.place_type)) return to(a.place_type) - to(b.place_type)
        return (a.year ?? 0) - (b.year ?? 0)
      })
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i]!.location_id !== sorted[i + 1]!.location_id) count++
      }
    }
    return count
  }, [activePlacesForCount, activeYearRange, selectedPersonIds])

  const migrationCount = explicitMigrationCount + synthesizedTracelineCount

  const placeCounts = useMemo(() => {
    const counts = { birth: 0, death: 0, residence: 0 }
    for (const p of activePlacesForCount) {
      if (selectedPersonIds !== null && !selectedPersonIds.has(p.person_id)) continue
      if (p.year !== null && (p.year < activeYearRange[0] || p.year > activeYearRange[1])) continue
      if (p.place_type === "birth") counts.birth++
      else if (p.place_type === "death") counts.death++
      else if (p.place_type === "residence") counts.residence++
    }
    return counts
  }, [activePlacesForCount, activeYearRange, selectedPersonIds])

  const hasData = (migrations && migrations.length > 0) || (personPlaces && personPlaces.length > 0)

  // Person list for filter panel
  const allPersons = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of personPlaces ?? []) {
      if (!map.has(p.person_id)) map.set(p.person_id, p.person_name)
    }
    for (const [id, name] of Object.entries(personNames ?? {})) {
      if (!map.has(id)) map.set(id, name)
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [personPlaces, personNames])

  // Breadcrumb label based on mode
  const breadcrumbLabel = useMemo(() => {
    if (mapMode === "my-journey") return `${ancestorTrail?.person_name ?? "My"} Journey`
    if (mapMode === "ancestor-trail") return `${ancestorTrail?.person_name ?? "My"} Ancestors (${ancestorTrail?.ancestor_count ?? 0})`
    return "Family Map"
  }, [mapMode, ancestorTrail])

  return (
    <div className="h-screen w-screen bg-sage-50 dark:bg-bg-dark relative overflow-hidden">
      <AppHeader />

      {/* Top controls row — responsive */}
      <div className="absolute top-16 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-30 pointer-events-auto flex flex-wrap items-center gap-1.5 sm:gap-2 justify-center">
        <Breadcrumbs items={[{ label: breadcrumbLabel, active: true }]} />
        <MapQuickActions isLoadingTrail={ancestorTrailLoading} />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="h-full w-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sage-400 dark:text-dark-text-muted text-sm">Loading map data...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <div className="h-full w-full flex items-center justify-center">
          <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm px-6 py-4 max-w-md text-center">
            <p className="text-red-600 dark:text-red-400 font-medium mb-1">Failed to load map data</p>
            <p className="text-sage-400 dark:text-dark-text-muted text-sm">
              {migrationsErrorObj instanceof Error ? migrationsErrorObj.message : "Unknown error"}
            </p>
          </div>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && !hasData && (
        <div className="h-full w-full flex items-center justify-center">
          <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm px-8 py-6 max-w-md text-center">
            <MapPin className="h-10 w-10 text-sage-300 dark:text-dark-text-muted mx-auto mb-3" />
            <p className="text-earth-900 dark:text-dark-text font-medium mb-1">No locations recorded</p>
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
            ancestorPlaces={ancestorTrail?.places ?? []}
          />
        </div>
      )}

      {/* Person filter panel */}
      {!isLoading && hasData && mapMode === "all" && (
        <PersonFilterPanel persons={allPersons} />
      )}

      {/* Layer controls — above bottom nav on mobile */}
      {!isLoading && hasData && (
        <div className="absolute bottom-20 sm:bottom-6 left-4 sm:left-6 z-30 pointer-events-auto">
          <MapLayerControls
            migrationCount={showMigrations ? migrationCount : 0}
            birthCount={placeCounts.birth}
            deathCount={placeCounts.death}
            residenceCount={placeCounts.residence}
          />
        </div>
      )}

      {/* Timeline slider — above bottom nav on mobile, hidden on very small screens */}
      {!isLoading && hasData && (
        <div className="absolute bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto hidden sm:block">
          <MapTimelineSlider minYear={yearBounds[0]} maxYear={yearBounds[1]} />
        </div>
      )}

      {/* Ancestor trail legend (when in ancestor mode) */}
      {mapMode === "ancestor-trail" && ancestorTrail && (
        <div className="absolute top-24 right-6 z-30 pointer-events-auto">
          <div className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-md rounded-xl border border-sage-200 dark:border-dark-border shadow-lg px-4 py-3 min-w-[160px]">
            <p className="text-xs font-semibold text-earth-900 dark:text-dark-text mb-2">Generation Legend</p>
            {[
              { gen: 0, label: "Self" },
              { gen: 1, label: "Parents" },
              { gen: 2, label: "Grandparents" },
              { gen: 3, label: "Great-grandparents" },
            ].map(({ gen, label }) => {
              const colors = ["#30e86e", "#22b8cf", "#7c3aed", "#f59e0b"]
              return (
                <div key={gen} className="flex items-center gap-2 py-0.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[gen] }} />
                  <span className="text-xs text-earth-900 dark:text-dark-text">{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

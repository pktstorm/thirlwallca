import { useState, useMemo, useCallback } from "react"
import { Map as MapGL, NavigationControl, Popup } from "react-map-gl/maplibre"
import type { MapLayerMouseEvent } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { BookOpen, Clock, ExternalLink, User } from "lucide-react"
import { MigrationLayer, type MigrationPathData } from "./MigrationLayer"
import { LocationMarker, type LocationMarkerData } from "./LocationMarker"
import type { MapPlace, PersonMapContext } from "../../types/location"
import { useMapStore } from "../../stores/mapStore"
import { api } from "../../lib/api"

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

interface AncestryMapProps {
  migrations: ApiMigration[]
  locations: ApiLocation[]
  personNames: Record<string, string>
  yearBounds: [number, number]
  personPlaces?: MapPlace[]
  ancestorPlaces?: MapPlace[]
}

// Heritage-styled map — OSM tiles with muted/desaturated styling via raster paint
const mapStyle = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
      paint: {
        "raster-saturation": -0.4,
        "raster-brightness-max": 0.92,
        "raster-contrast": -0.1,
      },
    },
  ],
}

// Generation colors — each generation gets a distinct hue
const GENERATION_COLORS = [
  "#30e86e", // gen 0 (self) — primary green
  "#22b8cf", // gen 1 (parents) — teal
  "#7c3aed", // gen 2 (grandparents) — purple
  "#f59e0b", // gen 3 (great-grandparents) — amber
  "#ef4444", // gen 4 — red
  "#ec4899", // gen 5 — pink
  "#6366f1", // gen 6 — indigo
  "#14b8a6", // gen 7 — teal dark
]

function getGenerationColor(gen: number): string {
  return GENERATION_COLORS[Math.min(gen, GENERATION_COLORS.length - 1)]!
}

const placeTypeColor: Record<string, string> = {
  birth: "blue",
  death: "gray",
  residence: "amber",
}

export function AncestryMap({
  migrations,
  locations,
  personNames,
  yearBounds,
  personPlaces = [],
  ancestorPlaces = [],
}: AncestryMapProps) {
  const navigate = useNavigate()
  const storeYearRange = useMapStore((s) => s.yearRange)
  const selectedPersonIds = useMapStore((s) => s.selectedPersonIds)
  const showMigrations = useMapStore((s) => s.showMigrations)
  const showBirths = useMapStore((s) => s.showBirths)
  const showDeaths = useMapStore((s) => s.showDeaths)
  const showResidences = useMapStore((s) => s.showResidences)
  const mapMode = useMapStore((s) => s.mapMode)
  const playbackYear = useMapStore((s) => s.playbackYear)

  const yearRange = storeYearRange ?? yearBounds

  const [hoveredMigration, setHoveredMigration] = useState<string | null>(null)
  const [tooltipInfo, setTooltipInfo] = useState<{
    x: number; y: number; migration: MigrationPathData
  } | null>(null)

  // Rich popup state
  const [selectedMarker, setSelectedMarker] = useState<{ personId: string; lat: number; lng: number } | null>(null)

  const { data: personContext } = useQuery<PersonMapContext>({
    queryKey: ["person-map-context", selectedMarker?.personId],
    queryFn: async () => {
      const res = await api.get(`/map/person-context/${selectedMarker!.personId}`)
      return res.data
    },
    enabled: !!selectedMarker?.personId,
    staleTime: 60_000,
  })

  // Determine which places to use based on mode
  const activePlaces = useMemo(() => {
    if (mapMode === "ancestor-trail" || mapMode === "my-journey") {
      return ancestorPlaces.length > 0 ? ancestorPlaces : personPlaces
    }
    return personPlaces
  }, [mapMode, ancestorPlaces, personPlaces])

  // Effective year range (playback overrides)
  const effectiveYearRange: [number, number] = useMemo(() => {
    if (playbackYear !== null) {
      return [yearBounds[0], playbackYear]
    }
    return yearRange
  }, [playbackYear, yearRange, yearBounds])

  const locationMap = useMemo(() => {
    const map = new Map<string, ApiLocation>()
    for (const loc of locations) {
      map.set(loc.id, loc)
    }
    return map
  }, [locations])

  // Filter migrations
  const filteredMigrations = useMemo<MigrationPathData[]>(() => {
    // In ancestor/journey mode, only show migrations for people in activePlaces
    const activePersonIds = mapMode !== "all"
      ? new Set(activePlaces.map((p) => p.person_id))
      : null

    const results: MigrationPathData[] = []
    for (const m of migrations) {
      if (activePersonIds && !activePersonIds.has(m.person_id)) continue
      if (selectedPersonIds !== null && !selectedPersonIds.has(m.person_id)) continue
      if (m.year !== null && (m.year < effectiveYearRange[0] || m.year > effectiveYearRange[1])) continue
      const from = locationMap.get(m.from_location_id)
      const to = locationMap.get(m.to_location_id)
      if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) continue
      results.push({
        id: m.id,
        fromLng: from.lng,
        fromLat: from.lat,
        toLng: to.lng,
        toLat: to.lat,
        year: m.year,
        yearApprox: m.year_approx,
        reason: m.reason,
        personName: personNames[m.person_id] ?? null,
        generation: 0,
      })
    }
    return results
  }, [migrations, locationMap, effectiveYearRange, selectedPersonIds, personNames, mapMode, activePlaces])

  // Synthesize tracelines from person places
  const synthesizedTracelines = useMemo<MigrationPathData[]>(() => {
    const byPerson = new Map<string, MapPlace[]>()
    for (const p of activePlaces) {
      if (selectedPersonIds !== null && !selectedPersonIds.has(p.person_id)) continue
      if (p.year !== null && (p.year < effectiveYearRange[0] || p.year > effectiveYearRange[1])) continue
      const list = byPerson.get(p.person_id)
      if (list) list.push(p)
      else byPerson.set(p.person_id, [p])
    }

    const lines: MigrationPathData[] = []
    for (const [, places] of byPerson) {
      if (places.length < 2) continue
      const sorted = [...places].sort((a, b) => {
        const typeOrder = (t: string) => (t === "birth" ? 0 : t === "death" ? 2 : 1)
        const oa = typeOrder(a.place_type), ob = typeOrder(b.place_type)
        if (oa !== ob) return oa - ob
        return (a.year ?? 0) - (b.year ?? 0)
      })
      for (let i = 0; i < sorted.length - 1; i++) {
        const from = sorted[i]!, to = sorted[i + 1]!
        if (from.location_id === to.location_id) continue
        lines.push({
          id: `trace-${from.person_id}-${from.location_id}-${to.location_id}`,
          fromLng: from.longitude,
          fromLat: from.latitude,
          toLng: to.longitude,
          toLat: to.latitude,
          year: to.year,
          yearApprox: false,
          reason: `${from.place_type} \u2192 ${to.place_type}`,
          personName: from.person_name,
          generation: from.generation ?? 0,
        })
      }
    }
    return lines
  }, [activePlaces, selectedPersonIds, effectiveYearRange])

  const allTracelines = useMemo(() => {
    return [...filteredMigrations, ...synthesizedTracelines]
  }, [filteredMigrations, synthesizedTracelines])

  // Build markers from migration endpoints
  const markerLocations = useMemo<LocationMarkerData[]>(() => {
    const counts = new Map<string, number>()
    for (const m of filteredMigrations) {
      const fk = `${m.fromLng},${m.fromLat}`, tk = `${m.toLng},${m.toLat}`
      counts.set(fk, (counts.get(fk) ?? 0) + 1)
      counts.set(tk, (counts.get(tk) ?? 0) + 1)
    }

    const activePersonIds = mapMode !== "all"
      ? new Set(activePlaces.map((p) => p.person_id))
      : null

    const usedLocationIds = new Set<string>()
    for (const m of migrations) {
      if (activePersonIds && !activePersonIds.has(m.person_id)) continue
      if (selectedPersonIds !== null && !selectedPersonIds.has(m.person_id)) continue
      if (m.year !== null && (m.year < effectiveYearRange[0] || m.year > effectiveYearRange[1])) continue
      usedLocationIds.add(m.from_location_id)
      usedLocationIds.add(m.to_location_id)
    }

    const markers: LocationMarkerData[] = []
    const seen = new Set<string>()
    for (const locId of usedLocationIds) {
      if (seen.has(locId)) continue
      seen.add(locId)
      const loc = locationMap.get(locId)
      if (!loc?.lat || !loc?.lng) continue
      const key = `${loc.lng},${loc.lat}`
      markers.push({
        id: loc.id,
        name: loc.name,
        latitude: loc.lat,
        longitude: loc.lng,
        country: loc.country,
        migrationCount: counts.get(key) ?? 0,
      })
    }
    return markers
  }, [filteredMigrations, migrations, locationMap, effectiveYearRange, selectedPersonIds, mapMode, activePlaces])

  // Build markers from person places
  const placeMarkers = useMemo<LocationMarkerData[]>(() => {
    const filtered = activePlaces.filter((p) => {
      if (selectedPersonIds !== null && !selectedPersonIds.has(p.person_id)) return false
      if (p.place_type === "birth" && !showBirths) return false
      if (p.place_type === "death" && !showDeaths) return false
      if (p.place_type === "residence" && !showResidences) return false
      if (p.year !== null) {
        if (p.year < effectiveYearRange[0] || p.year > effectiveYearRange[1]) return false
      }
      return true
    })

    const grouped = new Map<string, { place: MapPlace; persons: string[]; personIds: string[] }>()
    for (const p of filtered) {
      const key = `${p.location_id}-${p.place_type}`
      const existing = grouped.get(key)
      if (existing) {
        existing.persons.push(p.person_name)
        existing.personIds.push(p.person_id)
      } else {
        grouped.set(key, { place: p, persons: [p.person_name], personIds: [p.person_id] })
      }
    }

    return Array.from(grouped.values()).map(({ place, persons, personIds }) => ({
      id: `place-${place.location_id}-${place.place_type}`,
      name: [place.city, place.region, place.country].filter(Boolean).join(", "),
      latitude: place.latitude,
      longitude: place.longitude,
      country: place.country,
      migrationCount: 0,
      color: mapMode !== "all" && place.generation !== undefined
        ? undefined // Use generation color instead
        : placeTypeColor[place.place_type] ?? "green",
      generationColor: mapMode !== "all" && place.generation !== undefined
        ? getGenerationColor(place.generation)
        : undefined,
      label: place.place_type,
      persons,
      personIds,
      generation: place.generation,
    }))
  }, [activePlaces, selectedPersonIds, showBirths, showDeaths, showResidences, effectiveYearRange, mapMode])

  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (feature?.properties && "id" in feature.properties) {
        const migId = feature.properties["id"] as string
        setHoveredMigration(migId)
        const mig = allTracelines.find((m) => m.id === migId)
        if (mig) setTooltipInfo({ x: e.point.x, y: e.point.y, migration: mig })
      } else {
        setHoveredMigration(null)
        setTooltipInfo(null)
      }
    },
    [allTracelines],
  )

  void hoveredMigration

  const handleMarkerClick = useCallback((personId: string, lat: number, lng: number) => {
    setSelectedMarker({ personId, lat, lng })
  }, [])

  return (
    <MapGL
      initialViewState={{ longitude: -30, latitude: 30, zoom: 2 }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={mapStyle}
      interactiveLayerIds={["migration-lines"]}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { setHoveredMigration(null); setTooltipInfo(null) }}
      onClick={() => { if (selectedMarker) setSelectedMarker(null) }}
    >
      <NavigationControl position="top-right" />

      {/* Migration/traceline paths — generation-colored in ancestor mode */}
      {showMigrations && (
        <MigrationLayer
          migrations={allTracelines}
          useGenerationColors={mapMode !== "all"}
        />
      )}

      {showMigrations && markerLocations.map((loc) => (
        <LocationMarker key={loc.id} location={loc} onClick={handleMarkerClick} />
      ))}

      {placeMarkers.map((loc) => (
        <LocationMarker key={loc.id} location={loc} onClick={handleMarkerClick} />
      ))}

      {/* Rich popup for clicked marker */}
      {selectedMarker && personContext && (
        <Popup
          longitude={selectedMarker.lng}
          latitude={selectedMarker.lat}
          anchor="bottom"
          offset={16}
          closeButton
          closeOnClick={false}
          onClose={() => setSelectedMarker(null)}
          className="ancestry-map-popup"
          maxWidth="320px"
        >
          <div className="p-3 min-w-[260px]">
            {/* Person header */}
            <div className="flex items-center gap-3 mb-3">
              {personContext.profile_photo_url ? (
                <img
                  src={personContext.profile_photo_url}
                  alt={personContext.person_name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-sage-200"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-sage-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-earth-900 text-sm leading-tight truncate">
                  {personContext.person_name}
                </p>
                <p className="text-xs text-sage-400">
                  {personContext.birth_year ? `b. ${personContext.birth_year}` : ""}
                  {personContext.death_year ? ` \u2013 d. ${personContext.death_year}` : ""}
                  {personContext.is_living ? " \u2013 Living" : ""}
                </p>
              </div>
            </div>

            {/* Stories */}
            {personContext.stories.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-sage-400 mb-1 flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  Stories
                </p>
                {personContext.stories.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => navigate({ to: "/person/$personId/story", params: { personId: personContext.person_id } } as never)}
                    className="w-full text-left text-xs text-primary-dark hover:text-primary transition-colors py-0.5 truncate"
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            )}

            {/* Timeline events */}
            {personContext.timeline_events.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-sage-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Timeline
                </p>
                {personContext.timeline_events.slice(0, 3).map((e) => (
                  <p key={e.id} className="text-xs text-earth-800 py-0.5 truncate">
                    {e.event_date ? `${e.event_date.split("-")[0]} \u2013 ` : ""}{e.title}
                  </p>
                ))}
                {personContext.timeline_events.length > 3 && (
                  <p className="text-[10px] text-sage-300">+{personContext.timeline_events.length - 3} more</p>
                )}
              </div>
            )}

            {/* View profile link */}
            <button
              onClick={() => navigate({ to: "/person/$personId", params: { personId: personContext.person_id } } as never)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary-dark hover:text-primary transition-colors mt-1"
            >
              <ExternalLink className="w-3 h-3" />
              View Full Profile
            </button>
          </div>
        </Popup>
      )}

      {/* Hover tooltip for migration paths */}
      {tooltipInfo && (
        <div
          className="absolute pointer-events-none z-50"
          style={{ left: tooltipInfo.x + 12, top: tooltipInfo.y - 12 }}
        >
          <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-sm rounded-lg shadow-lg border border-sage-200 dark:border-dark-border px-3 py-2 text-sm min-w-[180px]">
            {tooltipInfo.migration.personName && (
              <p className="font-bold text-earth-900 dark:text-dark-text">
                {tooltipInfo.migration.personName}
              </p>
            )}
            {tooltipInfo.migration.year && (
              <p className="text-sage-400 dark:text-dark-text-muted text-xs">
                {tooltipInfo.migration.yearApprox ? "c. " : ""}{tooltipInfo.migration.year}
              </p>
            )}
            {tooltipInfo.migration.reason && (
              <p className="text-primary-dark text-xs mt-0.5">{tooltipInfo.migration.reason}</p>
            )}
          </div>
        </div>
      )}
    </MapGL>
  )
}

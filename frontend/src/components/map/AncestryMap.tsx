import { useState, useMemo, useCallback } from "react"
import { Map as MapGL, NavigationControl } from "react-map-gl/maplibre"
import type { MapLayerMouseEvent } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { MigrationLayer, type MigrationPathData } from "./MigrationLayer"
import { LocationMarker, type LocationMarkerData } from "./LocationMarker"
import type { MapPlace } from "../../types/location"
import { useMapStore } from "../../stores/mapStore"

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
}

const mapStyle = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
    },
  ],
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
}: AncestryMapProps) {
  const storeYearRange = useMapStore((s) => s.yearRange)
  const selectedPersonIds = useMapStore((s) => s.selectedPersonIds)
  const showMigrations = useMapStore((s) => s.showMigrations)
  const showBirths = useMapStore((s) => s.showBirths)
  const showDeaths = useMapStore((s) => s.showDeaths)
  const showResidences = useMapStore((s) => s.showResidences)

  const yearRange = storeYearRange ?? yearBounds

  const [hoveredMigration, setHoveredMigration] = useState<string | null>(null)
  const [tooltipInfo, setTooltipInfo] = useState<{
    x: number
    y: number
    migration: MigrationPathData
  } | null>(null)

  // Build a lookup map for locations by ID
  const locationMap = useMemo(() => {
    const map = new Map<string, ApiLocation>()
    for (const loc of locations) {
      map.set(loc.id, loc)
    }
    return map
  }, [locations])

  // Filter migrations by year range and person selection, then resolve coordinates
  const filteredMigrations = useMemo<MigrationPathData[]>(() => {
    return migrations
      .filter((m) => {
        // Person filter
        if (selectedPersonIds !== null && !selectedPersonIds.has(m.person_id)) return false
        // Year filter
        if (m.year === null) return true // include undated migrations
        return m.year >= yearRange[0] && m.year <= yearRange[1]
      })
      .map((m) => {
        const from = locationMap.get(m.from_location_id)
        const to = locationMap.get(m.to_location_id)
        if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null

        return {
          id: m.id,
          fromLng: from.lng,
          fromLat: from.lat,
          toLng: to.lng,
          toLat: to.lat,
          year: m.year,
          yearApprox: m.year_approx,
          reason: m.reason,
          personName: personNames[m.person_id] ?? null,
        }
      })
      .filter((m): m is MigrationPathData => m !== null)
  }, [migrations, locationMap, yearRange, selectedPersonIds, personNames])

  // Synthesize tracelines from person places (birth → residences → death, sorted by year)
  const synthesizedTracelines = useMemo<MigrationPathData[]>(() => {
    // Group places by person_id, applying person + year filters
    const byPerson = new Map<string, MapPlace[]>()
    for (const p of personPlaces) {
      if (selectedPersonIds !== null && !selectedPersonIds.has(p.person_id)) continue
      if (p.year !== null && (p.year < yearRange[0] || p.year > yearRange[1])) continue
      const list = byPerson.get(p.person_id)
      if (list) {
        list.push(p)
      } else {
        byPerson.set(p.person_id, [p])
      }
    }

    const lines: MigrationPathData[] = []
    for (const [, places] of byPerson) {
      if (places.length < 2) continue

      // Sort: birth first, then by year, death last
      const sorted = [...places].sort((a, b) => {
        const typeOrder = (t: string) => (t === "birth" ? 0 : t === "death" ? 2 : 1)
        const oa = typeOrder(a.place_type)
        const ob = typeOrder(b.place_type)
        if (oa !== ob) return oa - ob
        return (a.year ?? 0) - (b.year ?? 0)
      })

      // Deduplicate consecutive locations at the same coordinates
      for (let i = 0; i < sorted.length - 1; i++) {
        const from = sorted[i]!
        const to = sorted[i + 1]!
        // Skip if same location
        if (from.location_id === to.location_id) continue

        lines.push({
          id: `trace-${from.person_id}-${from.location_id}-${to.location_id}`,
          fromLng: from.longitude,
          fromLat: from.latitude,
          toLng: to.longitude,
          toLat: to.latitude,
          year: to.year,
          yearApprox: false,
          reason: `${from.place_type} → ${to.place_type}`,
          personName: from.person_name,
        })
      }
    }
    return lines
  }, [personPlaces, selectedPersonIds, yearRange])

  // Combine explicit migrations with synthesized tracelines
  const allTracelines = useMemo(() => {
    return [...filteredMigrations, ...synthesizedTracelines]
  }, [filteredMigrations, synthesizedTracelines])

  // Build unique locations with migration counts
  const markerLocations = useMemo<LocationMarkerData[]>(() => {
    const counts = new Map<string, number>()
    for (const m of filteredMigrations) {
      // Count both from and to
      const fromKey = `${m.fromLng},${m.fromLat}`
      const toKey = `${m.toLng},${m.toLat}`
      counts.set(fromKey, (counts.get(fromKey) ?? 0) + 1)
      counts.set(toKey, (counts.get(toKey) ?? 0) + 1)
    }

    // Collect unique locations that have valid coords and appear in filtered migrations
    const usedLocationIds = new Set<string>()
    for (const m of migrations) {
      if (selectedPersonIds !== null && !selectedPersonIds.has(m.person_id)) continue
      if (m.year !== null && (m.year < yearRange[0] || m.year > yearRange[1]))
        continue
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
  }, [filteredMigrations, migrations, locationMap, yearRange, selectedPersonIds])

  // Build markers from person places (birth/death/residence) with filters applied
  const placeMarkers = useMemo<LocationMarkerData[]>(() => {
    // Apply person, type, and year filters
    const filtered = personPlaces.filter((p) => {
      // Person filter
      if (selectedPersonIds !== null && !selectedPersonIds.has(p.person_id)) return false
      // Type filter
      if (p.place_type === "birth" && !showBirths) return false
      if (p.place_type === "death" && !showDeaths) return false
      if (p.place_type === "residence" && !showResidences) return false
      // Year filter
      if (p.year !== null) {
        if (p.year < yearRange[0] || p.year > yearRange[1]) return false
      }
      return true
    })

    // Group by location_id + place_type to deduplicate
    const grouped = new Map<string, { place: MapPlace; persons: string[] }>()
    for (const p of filtered) {
      const key = `${p.location_id}-${p.place_type}`
      const existing = grouped.get(key)
      if (existing) {
        existing.persons.push(p.person_name)
      } else {
        grouped.set(key, { place: p, persons: [p.person_name] })
      }
    }

    return Array.from(grouped.values()).map(({ place, persons }) => ({
      id: `place-${place.location_id}-${place.place_type}`,
      name: [place.city, place.region, place.country].filter(Boolean).join(", "),
      latitude: place.latitude,
      longitude: place.longitude,
      country: place.country,
      migrationCount: 0,
      color: placeTypeColor[place.place_type] ?? "green",
      label: place.place_type,
      persons,
    }))
  }, [personPlaces, selectedPersonIds, showBirths, showDeaths, showResidences, yearRange])

  const handleMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (feature && feature.properties && "id" in feature.properties) {
        const migId = feature.properties["id"] as string
        setHoveredMigration(migId)
        const mig = allTracelines.find((m) => m.id === migId)
        if (mig) {
          setTooltipInfo({ x: e.point.x, y: e.point.y, migration: mig })
        }
      } else {
        setHoveredMigration(null)
        setTooltipInfo(null)
      }
    },
    [allTracelines],
  )

  // Suppress unused variable warning
  void hoveredMigration

  return (
    <MapGL
      initialViewState={{
        longitude: -30,
        latitude: 30,
        zoom: 2,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={mapStyle}
      interactiveLayerIds={["migration-lines"]}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setHoveredMigration(null)
        setTooltipInfo(null)
      }}
    >
      <NavigationControl position="top-right" />

      {showMigrations && <MigrationLayer migrations={allTracelines} />}

      {showMigrations && markerLocations.map((loc) => (
        <LocationMarker key={loc.id} location={loc} />
      ))}

      {placeMarkers.map((loc) => (
        <LocationMarker key={loc.id} location={loc} />
      ))}

      {/* Hover tooltip for migration paths */}
      {tooltipInfo && (
        <div
          className="absolute pointer-events-none z-50"
          style={{
            left: tooltipInfo.x + 12,
            top: tooltipInfo.y - 12,
          }}
        >
          <div className="bg-white/95 dark:bg-dark-card/95 backdrop-blur-sm rounded-lg shadow-lg border border-sage-200 dark:border-dark-border px-3 py-2 text-sm min-w-[180px]">
            {tooltipInfo.migration.personName && (
              <p className="font-bold text-earth-900 dark:text-dark-text">
                {tooltipInfo.migration.personName}
              </p>
            )}
            {tooltipInfo.migration.year && (
              <p className="text-sage-400 dark:text-dark-text-muted text-xs">
                {tooltipInfo.migration.yearApprox ? "c. " : ""}
                {tooltipInfo.migration.year}
              </p>
            )}
            {tooltipInfo.migration.reason && (
              <p className="text-primary-dark text-xs mt-0.5">
                {tooltipInfo.migration.reason}
              </p>
            )}
          </div>
        </div>
      )}
    </MapGL>
  )
}

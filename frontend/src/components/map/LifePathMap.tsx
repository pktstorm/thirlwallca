import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Map as MapGL, NavigationControl, Marker, Popup, Source, Layer } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"
import { useQuery } from "@tanstack/react-query"
import { Play, Pause, RotateCcw, X, MapPin } from "lucide-react"
import { api } from "../../lib/api"
import type { MapPlace } from "../../types/location"
import { cn } from "../../lib/utils"

interface LifePathMapProps {
  personId: string
  personName: string
  onClose: () => void
}

const mapStyle = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [{
    id: "osm", type: "raster" as const, source: "osm",
    paint: { "raster-saturation": -0.4, "raster-brightness-max": 0.92 },
  }],
}

const PLACE_COLORS: Record<string, string> = {
  birth: "#3b82f6",
  residence: "#f59e0b",
  death: "#6b7280",
}

function buildCurvedLine(from: [number, number], to: [number, number]): [number, number][] {
  const [fLng, fLat] = from
  const [tLng, tLat] = to
  const midLng = (fLng + tLng) / 2, midLat = (fLat + tLat) / 2
  const dx = tLng - fLng, dy = tLat - fLat
  const dist = Math.sqrt(dx * dx + dy * dy)
  const curve = dist * 0.15
  const cpLng = midLng + (-dy / dist) * curve
  const cpLat = midLat + (dx / dist) * curve
  const pts: [number, number][] = []
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, inv = 1 - t
    pts.push([
      inv * inv * fLng + 2 * inv * t * cpLng + t * t * tLng,
      inv * inv * fLat + 2 * inv * t * cpLat + t * t * tLat,
    ])
  }
  return pts
}

export function LifePathMap({ personId, personName, onClose }: LifePathMapProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedStop, setSelectedStop] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: trailData } = useQuery<{ places: MapPlace[] }>({
    queryKey: ["life-path", personId],
    queryFn: async () => {
      const res = await api.get(`/map/ancestor-trail/${personId}`, { params: { max_generations: 0 } })
      return res.data
    },
  })

  // Sort places chronologically: birth → residences by year → death
  const stops = useMemo(() => {
    if (!trailData?.places) return []
    const places = [...trailData.places]
    places.sort((a, b) => {
      const typeOrder = (t: string) => t === "birth" ? 0 : t === "death" ? 2 : 1
      if (typeOrder(a.place_type) !== typeOrder(b.place_type)) return typeOrder(a.place_type) - typeOrder(b.place_type)
      return (a.year ?? 0) - (b.year ?? 0)
    })
    // Deduplicate consecutive same locations
    const deduped: MapPlace[] = []
    for (const p of places) {
      if (deduped.length === 0 || deduped[deduped.length - 1]!.location_id !== p.location_id) {
        deduped.push(p)
      }
    }
    return deduped
  }, [trailData])

  // Build path GeoJSON up to current step
  const pathGeojson = useMemo(() => {
    const features: any[] = []
    const visibleStops = stops.slice(0, currentStep + 1)
    for (let i = 0; i < visibleStops.length - 1; i++) {
      const from = visibleStops[i]!, to = visibleStops[i + 1]!
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: buildCurvedLine([from.longitude, from.latitude], [to.longitude, to.latitude]),
        },
        properties: {},
      })
    }
    return { type: "FeatureCollection" as const, features }
  }, [stops, currentStep])

  // Playback
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentStep((s) => {
          if (s >= stops.length - 1) {
            setIsPlaying(false)
            return s
          }
          return s + 1
        })
      }, 1500)
      return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }
  }, [isPlaying, stops.length])

  const handlePlay = useCallback(() => {
    if (currentStep >= stops.length - 1) setCurrentStep(0)
    setIsPlaying(true)
  }, [currentStep, stops.length])

  const handleReset = useCallback(() => {
    setCurrentStep(0)
    setIsPlaying(false)
    setSelectedStop(null)
  }, [])

  // Center map on current stop
  const center = stops[currentStep]
  const visibleStops = stops.slice(0, currentStep + 1)

  if (stops.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white dark:bg-dark-card rounded-2xl p-8 max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
          <MapPin className="h-10 w-10 text-sage-300 mx-auto mb-3" />
          <p className="text-sage-400">No location data available for this person.</p>
          <button onClick={onClose} className="mt-4 text-sm text-primary-dark hover:text-primary">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/50">
        <div>
          <h2 className="text-white font-bold text-lg">{personName}&apos;s Life Path</h2>
          <p className="text-white/60 text-xs">
            {stops.length} locations &bull; {stops[0]?.year ?? "?"} &ndash; {stops[stops.length - 1]?.year ?? "?"}
          </p>
        </div>
        <button onClick={onClose} className="p-2 text-white/60 hover:text-white transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapGL
          initialViewState={{
            longitude: center?.longitude ?? 0,
            latitude: center?.latitude ?? 0,
            zoom: 4,
          }}
          style={{ width: "100%", height: "100%" }}
          mapStyle={mapStyle}
        >
          <NavigationControl position="top-right" />

          {/* Path lines */}
          <Source id="life-path-lines" type="geojson" data={pathGeojson}>
            <Layer id="life-path-glow" type="line" paint={{ "line-color": "#30e86e", "line-width": 5, "line-opacity": 0.15, "line-blur": 3 }} />
            <Layer id="life-path-line" type="line" paint={{ "line-color": "#30e86e", "line-width": 2.5, "line-opacity": 0.8, "line-dasharray": [2, 2] }} />
          </Source>

          {/* Stop markers */}
          {visibleStops.map((stop, i) => {
            const color = PLACE_COLORS[stop.place_type] ?? "#30e86e"
            const isCurrent = i === currentStep
            return (
              <Marker key={`${stop.location_id}-${i}`} longitude={stop.longitude} latitude={stop.latitude} anchor="center">
                <button
                  onClick={() => setSelectedStop(selectedStop === i ? null : i)}
                  className={cn("rounded-full border-2 border-white shadow-lg transition-all",
                    isCurrent ? "w-5 h-5 scale-125" : "w-3.5 h-3.5")}
                  style={{ backgroundColor: color }}
                />
              </Marker>
            )
          })}

          {/* Popup for selected stop */}
          {selectedStop !== null && visibleStops[selectedStop] && (
            <Popup
              longitude={visibleStops[selectedStop]!.longitude}
              latitude={visibleStops[selectedStop]!.latitude}
              anchor="bottom" offset={12} closeButton closeOnClick={false}
              onClose={() => setSelectedStop(null)}
            >
              <div className="px-2 py-1.5 min-w-[120px]">
                <p className="font-bold text-earth-900 text-xs capitalize">{visibleStops[selectedStop]!.place_type}</p>
                <p className="text-xs text-sage-400">{visibleStops[selectedStop]!.city}{visibleStops[selectedStop]!.country ? `, ${visibleStops[selectedStop]!.country}` : ""}</p>
                {visibleStops[selectedStop]!.year && <p className="text-xs text-primary-dark font-medium">{visibleStops[selectedStop]!.year}</p>}
              </div>
            </Popup>
          )}
        </MapGL>
      </div>

      {/* Timeline controls */}
      <div className="bg-black/70 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={isPlaying ? () => setIsPlaying(false) : handlePlay}
            className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-earth-900 hover:bg-primary-dark hover:text-white transition-colors">
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button onClick={handleReset} className="p-2 text-white/60 hover:text-white transition-colors">
            <RotateCcw className="h-4 w-4" />
          </button>

          {/* Progress bar */}
          <div className="flex-1 flex items-center gap-1">
            {stops.map((stop, i) => (
              <button
                key={i}
                onClick={() => { setCurrentStep(i); setIsPlaying(false) }}
                className={cn(
                  "flex-1 h-2 rounded-full transition-all cursor-pointer",
                  i <= currentStep ? "bg-primary" : "bg-white/20",
                  i === currentStep && "h-3",
                )}
                title={`${stop.place_type}: ${stop.city} ${stop.year ? `(${stop.year})` : ""}`}
              />
            ))}
          </div>

          {/* Current stop label */}
          <div className="text-right min-w-[120px]">
            {center && (
              <>
                <p className="text-white text-xs font-medium capitalize">{center.place_type}</p>
                <p className="text-white/60 text-[10px]">{center.city}{center.year ? `, ${center.year}` : ""}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

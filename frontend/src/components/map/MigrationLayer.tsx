import { useMemo } from "react"
import { Source, Layer } from "react-map-gl/maplibre"
import type { LineLayerSpecification } from "maplibre-gl"

export interface MigrationPathData {
  id: string
  fromLng: number
  fromLat: number
  toLng: number
  toLat: number
  year: number | null
  yearApprox: boolean
  reason: string | null
  personName: string | null
  generation?: number
}

interface MigrationLayerProps {
  migrations: MigrationPathData[]
  useGenerationColors?: boolean
}

// Generation color palette
const GENERATION_COLORS = [
  "#30e86e", "#22b8cf", "#7c3aed", "#f59e0b",
  "#ef4444", "#ec4899", "#6366f1", "#14b8a6",
]

function getGenColor(gen: number): string {
  return GENERATION_COLORS[Math.min(gen, GENERATION_COLORS.length - 1)]!
}

function buildCurvedLine(
  fromLng: number, fromLat: number,
  toLng: number, toLat: number,
  numPoints = 50,
): [number, number][] {
  const midLng = (fromLng + toLng) / 2
  const midLat = (fromLat + toLat) / 2
  const dx = toLng - fromLng, dy = toLat - fromLat
  const dist = Math.sqrt(dx * dx + dy * dy)
  const curveHeight = dist * 0.2
  const perpX = -dy / dist, perpY = dx / dist
  const cpLng = midLng + perpX * curveHeight
  const cpLat = midLat + perpY * curveHeight

  const points: [number, number][] = []
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints, invT = 1 - t
    points.push([
      invT * invT * fromLng + 2 * invT * t * cpLng + t * t * toLng,
      invT * invT * fromLat + 2 * invT * t * cpLat + t * t * toLat,
    ])
  }
  return points
}

interface GeoJSONFeature {
  type: "Feature"
  properties: Record<string, unknown>
  geometry: { type: "LineString"; coordinates: [number, number][] } | { type: "Point"; coordinates: [number, number] }
}

interface GeoJSONFC {
  type: "FeatureCollection"
  features: GeoJSONFeature[]
}

export function MigrationLayer({ migrations, useGenerationColors = false }: MigrationLayerProps) {
  // Group migrations by generation for color-coding
  const { lineData, arrowData } = useMemo(() => {
    const lineFeatures: GeoJSONFeature[] = migrations.map((m) => ({
      type: "Feature" as const,
      properties: {
        id: m.id,
        year: m.year,
        yearApprox: m.yearApprox,
        reason: m.reason,
        personName: m.personName,
        generation: m.generation ?? 0,
        color: useGenerationColors ? getGenColor(m.generation ?? 0) : "#30e86e",
        opacity: useGenerationColors ? Math.max(0.4, 1 - (m.generation ?? 0) * 0.12) : 0.8,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: buildCurvedLine(m.fromLng, m.fromLat, m.toLng, m.toLat),
      },
    }))

    const arrowFeatures: GeoJSONFeature[] = migrations.map((m) => {
      return {
        type: "Feature" as const,
        properties: {
          color: useGenerationColors ? getGenColor(m.generation ?? 0) : "#30e86e",
        },
        geometry: {
          type: "Point" as const,
          coordinates: [m.toLng, m.toLat] as [number, number],
        },
      }
    })

    return {
      lineData: { type: "FeatureCollection" as const, features: lineFeatures } as GeoJSONFC,
      arrowData: { type: "FeatureCollection" as const, features: arrowFeatures } as GeoJSONFC,
    }
  }, [migrations, useGenerationColors])

  if (migrations.length === 0) return null

  // Use data-driven styling for generation colors
  const lineLayer: LineLayerSpecification = {
    id: "migration-lines",
    type: "line",
    source: "migration-paths",
    paint: {
      "line-color": useGenerationColors
        ? ["get", "color"] as any
        : "#30e86e",
      "line-width": 2.5,
      "line-opacity": useGenerationColors
        ? ["get", "opacity"] as any
        : 0.8,
      "line-dasharray": [2, 2],
    },
  }

  const glowLayer: LineLayerSpecification = {
    id: "migration-lines-glow",
    type: "line",
    source: "migration-paths",
    paint: {
      "line-color": useGenerationColors
        ? ["get", "color"] as any
        : "#30e86e",
      "line-width": 6,
      "line-opacity": 0.12,
      "line-blur": 4,
    },
  }

  return (
    <>
      <Source id="migration-paths" type="geojson" data={lineData}>
        <Layer {...glowLayer} />
        <Layer {...lineLayer} />
      </Source>
      <Source id="migration-arrows" type="geojson" data={arrowData}>
        <Layer
          id="migration-arrow-circles"
          type="circle"
          source="migration-arrows"
          paint={{
            "circle-radius": 4,
            "circle-color": useGenerationColors
              ? ["get", "color"] as any
              : "#30e86e",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          }}
        />
      </Source>
    </>
  )
}

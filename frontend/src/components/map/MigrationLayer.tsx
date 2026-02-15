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
}

interface MigrationLayerProps {
  migrations: MigrationPathData[]
}

interface LineStringGeometry {
  type: "LineString"
  coordinates: [number, number][]
}

interface PointGeometry {
  type: "Point"
  coordinates: [number, number]
}

interface GeoJSONLineFeature {
  type: "Feature"
  properties: Record<string, unknown>
  geometry: LineStringGeometry
}

interface GeoJSONPointFeature {
  type: "Feature"
  properties: Record<string, unknown>
  geometry: PointGeometry
}

interface GeoJSONLineFeatureCollection {
  type: "FeatureCollection"
  features: GeoJSONLineFeature[]
}

interface GeoJSONPointFeatureCollection {
  type: "FeatureCollection"
  features: GeoJSONPointFeature[]
}

/**
 * Build a curved GeoJSON LineString between two points.
 * The curve is a simple quadratic bezier approximation using a midpoint
 * offset perpendicular to the line, giving a nice arc effect.
 */
function buildCurvedLine(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  numPoints = 50,
): [number, number][] {
  const midLng = (fromLng + toLng) / 2
  const midLat = (fromLat + toLat) / 2

  // Perpendicular offset for the curve
  const dx = toLng - fromLng
  const dy = toLat - fromLat
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Scale the curve height by distance (more distance = more curve)
  const curveHeight = dist * 0.2

  // Perpendicular direction (rotate 90 degrees)
  const perpX = -dy / dist
  const perpY = dx / dist

  // Control point
  const cpLng = midLng + perpX * curveHeight
  const cpLat = midLat + perpY * curveHeight

  const points: [number, number][] = []
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints
    const invT = 1 - t
    // Quadratic bezier: B(t) = (1-t)^2 * P0 + 2(1-t)t * CP + t^2 * P1
    const lng = invT * invT * fromLng + 2 * invT * t * cpLng + t * t * toLng
    const lat = invT * invT * fromLat + 2 * invT * t * cpLat + t * t * toLat
    points.push([lng, lat])
  }
  return points
}

const migrationLineLayer: LineLayerSpecification = {
  id: "migration-lines",
  type: "line",
  source: "migration-paths",
  paint: {
    "line-color": "#30e86e",
    "line-width": 2.5,
    "line-opacity": 0.8,
    "line-dasharray": [2, 2],
  },
}

const migrationLineGlowLayer: LineLayerSpecification = {
  id: "migration-lines-glow",
  type: "line",
  source: "migration-paths",
  paint: {
    "line-color": "#30e86e",
    "line-width": 6,
    "line-opacity": 0.15,
    "line-blur": 4,
  },
}

export function MigrationLayer({ migrations }: MigrationLayerProps) {
  const geojsonData = useMemo<GeoJSONLineFeatureCollection>(() => {
    const features: GeoJSONLineFeature[] = migrations.map((m) => ({
      type: "Feature" as const,
      properties: {
        id: m.id,
        year: m.year,
        yearApprox: m.yearApprox,
        reason: m.reason,
        personName: m.personName,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: buildCurvedLine(
          m.fromLng,
          m.fromLat,
          m.toLng,
          m.toLat,
        ),
      },
    }))

    return {
      type: "FeatureCollection" as const,
      features,
    }
  }, [migrations])

  // Arrowhead markers at the destination end of each migration
  const arrowGeojsonData = useMemo<GeoJSONPointFeatureCollection>(() => {
    const features: GeoJSONPointFeature[] = migrations.map((m) => {
      const coords = buildCurvedLine(m.fromLng, m.fromLat, m.toLng, m.toLat)
      const lastPt = coords[coords.length - 1]!
      const prevPt = coords[coords.length - 2]!
      const bearing =
        (Math.atan2(
          lastPt[0] - prevPt[0],
          lastPt[1] - prevPt[1],
        ) *
          180) /
        Math.PI

      return {
        type: "Feature" as const,
        properties: {
          bearing,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [m.toLng, m.toLat] as [number, number],
        },
      }
    })

    return {
      type: "FeatureCollection" as const,
      features,
    }
  }, [migrations])

  if (migrations.length === 0) return null

  return (
    <>
      <Source id="migration-paths" type="geojson" data={geojsonData}>
        <Layer {...migrationLineGlowLayer} />
        <Layer {...migrationLineLayer} />
      </Source>
      <Source id="migration-arrows" type="geojson" data={arrowGeojsonData}>
        <Layer
          id="migration-arrow-circles"
          type="circle"
          source="migration-arrows"
          paint={{
            "circle-radius": 4,
            "circle-color": "#30e86e",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          }}
        />
      </Source>
    </>
  )
}

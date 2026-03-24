import { useState, useCallback } from "react"
import { Marker, Popup } from "react-map-gl/maplibre"

export interface LocationMarkerData {
  id: string
  name: string
  latitude: number
  longitude: number
  country: string | null
  migrationCount: number
  color?: string
  generationColor?: string
  label?: string
  persons?: string[]
  personIds?: string[]
  generation?: number
}

interface LocationMarkerProps {
  location: LocationMarkerData
  onClick?: (personId: string, lat: number, lng: number) => void
}

const colorClasses: Record<string, { dot: string; ring: string }> = {
  green: { dot: "bg-primary", ring: "ring-primary/30" },
  blue: { dot: "bg-blue-500", ring: "ring-blue-500/30" },
  gray: { dot: "bg-gray-500", ring: "ring-gray-500/30" },
  amber: { dot: "bg-amber-500", ring: "ring-amber-500/30" },
}

export function LocationMarker({ location, onClick }: LocationMarkerProps) {
  const [showPopup, setShowPopup] = useState(false)

  const handleMouseEnter = useCallback(() => setShowPopup(true), [])
  const handleMouseLeave = useCallback(() => setShowPopup(false), [])

  const handleClick = useCallback(() => {
    if (onClick && location.personIds && location.personIds.length > 0) {
      onClick(location.personIds[0]!, location.latitude, location.longitude)
    }
  }, [onClick, location])

  const colorKey = location.color ?? "green"
  const colors = colorClasses[colorKey] ?? colorClasses.green!

  // Use generation color if provided
  const useCustomColor = !!location.generationColor

  return (
    <>
      <Marker
        longitude={location.longitude}
        latitude={location.latitude}
        anchor="center"
      >
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          className="relative cursor-pointer group"
        >
          {/* Outer ring with pulse */}
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:scale-125 ${
              useCustomColor ? "ring-2" : `ring-2 ${colors.ring}`
            }`}
            style={useCustomColor ? {
              outline: `2px solid ${location.generationColor}`,
              outlineOffset: "1px",
              boxShadow: `0 0 8px ${location.generationColor}40`,
            } : undefined}
          >
            {/* Inner dot */}
            <div
              className={`w-4 h-4 rounded-full border-[1.5px] border-white shadow-sm ${
                useCustomColor ? "" : colors.dot
              }`}
              style={useCustomColor ? { backgroundColor: location.generationColor } : undefined}
            />
          </div>
        </div>
      </Marker>

      {showPopup && (
        <Popup
          longitude={location.longitude}
          latitude={location.latitude}
          anchor="bottom"
          offset={14}
          closeButton={false}
          closeOnClick={false}
          className="ancestry-map-popup"
        >
          <div className="px-3 py-2 min-w-[140px]">
            <p className="font-bold text-earth-900 text-sm leading-tight">
              {location.name}
            </p>
            {location.country && (
              <p className="text-sage-400 text-xs mt-0.5">{location.country}</p>
            )}
            {location.label && (
              <p className="text-xs text-sage-500 mt-0.5 capitalize">{location.label}</p>
            )}
            {location.persons && location.persons.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {location.persons.slice(0, 5).map((name, i) => (
                  <p key={i} className="text-xs text-earth-800">{name}</p>
                ))}
                {location.persons.length > 5 && (
                  <p className="text-[10px] text-sage-300">+{location.persons.length - 5} more</p>
                )}
              </div>
            )}
            {location.migrationCount > 0 && (
              <p className="text-primary-dark text-xs font-medium mt-1">
                {location.migrationCount} {location.migrationCount === 1 ? "migration" : "migrations"}
              </p>
            )}
            {location.generation !== undefined && location.generation > 0 && (
              <p className="text-xs text-sage-400 mt-0.5">
                Generation {location.generation} ancestor
              </p>
            )}
            {onClick && location.personIds && location.personIds.length > 0 && (
              <p className="text-[10px] text-primary-dark mt-1 font-medium">Click for details</p>
            )}
          </div>
        </Popup>
      )}
    </>
  )
}

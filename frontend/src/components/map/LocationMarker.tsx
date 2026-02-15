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
  label?: string
  persons?: string[]
}

interface LocationMarkerProps {
  location: LocationMarkerData
}

const colorClasses: Record<string, { dot: string; pulse: string }> = {
  green: { dot: "bg-primary", pulse: "bg-primary" },
  blue: { dot: "bg-blue-500", pulse: "bg-blue-500" },
  gray: { dot: "bg-gray-500", pulse: "bg-gray-500" },
  amber: { dot: "bg-amber-500", pulse: "bg-amber-500" },
}

export function LocationMarker({ location }: LocationMarkerProps) {
  const [showPopup, setShowPopup] = useState(false)

  const handleMouseEnter = useCallback(() => setShowPopup(true), [])
  const handleMouseLeave = useCallback(() => setShowPopup(false), [])

  const colorKey = location.color ?? "green"
  const colors = colorClasses[colorKey] ?? colorClasses.green!

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
          className="relative cursor-pointer"
        >
          {/* Pulse ring */}
          <div className="absolute inset-0 w-4 h-4 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2">
            <span className={`absolute inset-0 rounded-full ${colors.pulse} opacity-40 animate-ping`} />
          </div>
          {/* Dot */}
          <div className={`w-3 h-3 rounded-full ${colors.dot} border-2 border-white shadow-md relative z-10`} />
        </div>
      </Marker>

      {showPopup && (
        <Popup
          longitude={location.longitude}
          latitude={location.latitude}
          anchor="bottom"
          offset={12}
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
              <p className="text-xs text-sage-500 mt-0.5 capitalize">
                {location.label}
              </p>
            )}
            {location.persons && location.persons.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {location.persons.map((name, i) => (
                  <p key={i} className="text-xs text-earth-800">
                    {name}
                  </p>
                ))}
              </div>
            )}
            {location.migrationCount > 0 && (
              <p className="text-primary-dark text-xs font-medium mt-1">
                {location.migrationCount}{" "}
                {location.migrationCount === 1 ? "migration" : "migrations"}
              </p>
            )}
          </div>
        </Popup>
      )}
    </>
  )
}

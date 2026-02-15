export interface Location {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  country: string | null
  region: string | null
}

export interface Migration {
  id: string
  personId: string
  fromLocationId: string
  toLocationId: string
  fromLocation: Location
  toLocation: Location
  year: number | null
  yearApprox: boolean
  reason: string | null
  notes: string | null
}

export interface MapPlace {
  person_id: string
  person_name: string
  place_type: "birth" | "death" | "residence"
  location_id: string
  city: string
  region: string | null
  country: string | null
  latitude: number
  longitude: number
  year: number | null
}

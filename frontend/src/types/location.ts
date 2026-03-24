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
  generation: number
  profile_photo_url: string | null
}

export interface AncestorTrailResponse {
  places: MapPlace[]
  person_name: string
  ancestor_count: number
}

export interface PersonMapContext {
  person_id: string
  person_name: string
  profile_photo_url: string | null
  birth_year: number | null
  death_year: number | null
  is_living: boolean
  story_count: number
  timeline_event_count: number
  stories: { id: string; title: string }[]
  timeline_events: { id: string; title: string; event_date: string | null; event_type: string | null }[]
}

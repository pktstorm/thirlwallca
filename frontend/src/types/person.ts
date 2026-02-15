export interface LocationSummary {
  id: string
  city: string
  region: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
}

export interface Person {
  id: string
  firstName: string
  middleName: string | null
  lastName: string
  maidenName: string | null
  suffix: string | null
  gender: "male" | "female" | "other" | "unknown"
  birthDate: string | null
  birthDateApprox: boolean
  deathDate: string | null
  deathDateApprox: boolean
  isLiving: boolean
  bio: string | null
  occupation: string | null
  profilePhotoUrl: string | null
  birthLocationId: string | null
  deathLocationId: string | null
  nicknames: string | null
  birthPlaceText: string | null
  deathPlaceText: string | null
  birthLocation: LocationSummary | null
  deathLocation: LocationSummary | null
  causeOfDeath: string | null
  ethnicity: string | null
  religion: string | null
  education: string | null
  militaryService: string | null
  burialLocation: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface PersonSummary {
  id: string
  firstName: string
  lastName: string
  birthYear: number | null
  deathYear: number | null
  profilePhotoUrl: string | null
  gender: string
  isLiving: boolean
  location: string | null
}

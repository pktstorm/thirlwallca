import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { ChevronRight, ChevronLeft, X, MapPin, TreePine, Sparkles } from "lucide-react"
import { api } from "../../lib/api"
import { cn } from "../../lib/utils"
import type { MapPlace } from "../../types/location"

interface TourStep {
  personId: string
  name: string
  birthYear: string | null
  deathYear: string | null
  isLiving: boolean
  profilePhotoUrl: string | null
  gender: string
  birthPlace: string | null
  occupation: string | null
  generation: number
  generationLabel: string
}

interface FamilyTourProps {
  personId: string
  onClose: () => void
}

const GENERATION_LABELS = [
  "You",
  "Your Parents",
  "Your Grandparents",
  "Your Great-Grandparents",
  "Your 2nd Great-Grandparents",
  "Your 3rd Great-Grandparents",
]

function getGenLabel(gen: number): string {
  return GENERATION_LABELS[gen] ?? `Generation ${gen}`
}

function getInitials(name: string): string {
  const parts = name.split(" ")
  return parts.map((p) => p.charAt(0)).join("").toUpperCase().slice(0, 2)
}

function genderBg(gender: string): string {
  switch (gender) {
    case "female": return "bg-pink-100 text-pink-700"
    case "male": return "bg-blue-100 text-blue-700"
    default: return "bg-sage-100 text-sage-800"
  }
}

export function FamilyTour({ personId, onClose }: FamilyTourProps) {
  const [currentStep, setCurrentStep] = useState(0)

  // Fetch ancestor trail to build tour steps
  const { data: trailData, isLoading } = useQuery<{ places: MapPlace[]; person_name: string; ancestor_count: number }>({
    queryKey: ["family-tour", personId],
    queryFn: async () => {
      const res = await api.get(`/map/ancestor-trail/${personId}`, { params: { max_generations: 5 } })
      return res.data
    },
  })

  // Build tour steps from ancestor trail
  const steps: TourStep[] = []
  if (trailData) {
    // Group by person, pick one place per person (birth preferred)
    const personMap = new Map<string, MapPlace[]>()
    for (const p of trailData.places) {
      const list = personMap.get(p.person_id) ?? []
      list.push(p)
      personMap.set(p.person_id, list)
    }

    for (const [pid, places] of personMap) {
      const birth = places.find((p) => p.place_type === "birth")
      const any = birth ?? places[0]
      if (!any) continue

      const birthYear = places.find((p) => p.place_type === "birth")?.year
      const deathPlace = places.find((p) => p.place_type === "death")

      steps.push({
        personId: pid,
        name: any.person_name,
        birthYear: birthYear ? String(birthYear) : null,
        deathYear: deathPlace?.year ? String(deathPlace.year) : null,
        isLiving: !deathPlace,
        profilePhotoUrl: any.profile_photo_url,
        gender: "unknown",
        birthPlace: birth ? [birth.city, birth.country].filter(Boolean).join(", ") : null,
        occupation: null,
        generation: any.generation,
        generationLabel: getGenLabel(any.generation),
      })
    }

    // Sort by generation, then by name
    steps.sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name))
  }

  // Deduplicate by generation for the tour — show one "stop" per generation
  const generationStops = new Map<number, TourStep[]>()
  for (const step of steps) {
    const list = generationStops.get(step.generation) ?? []
    list.push(step)
    generationStops.set(step.generation, list)
  }
  const tourStops = [...generationStops.entries()].sort((a, b) => a[0] - b[0])

  const totalStops = tourStops.length
  const currentGenPeople = tourStops[currentStep]?.[1] ?? []
  const currentGenLabel = tourStops[currentStep] !== undefined ? getGenLabel(tourStops[currentStep]![0]) : ""

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight" && currentStep < totalStops - 1) setCurrentStep((s) => s + 1)
      if (e.key === "ArrowLeft" && currentStep > 0) setCurrentStep((s) => s - 1)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [onClose, currentStep, totalStops])

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="bg-white dark:bg-dark-card rounded-2xl p-8 flex flex-col items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary animate-pulse" />
          <p className="text-sage-400 text-sm">Preparing your family tour...</p>
        </div>
      </div>
    )
  }

  if (totalStops === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white dark:bg-dark-card rounded-2xl p-8 max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-sage-400 text-sm">Not enough data to create a tour yet. Add birth/death locations to your ancestors.</p>
          <button onClick={onClose} className="mt-4 text-sm font-medium text-primary-dark hover:text-primary transition-colors">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-darker to-bg-dark px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-white font-bold">Meet Your Family</h2>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-6 pt-4">
          <div className="flex gap-1">
            {tourStops.map((_, i) => (
              <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i <= currentStep ? "bg-primary" : "bg-sage-200 dark:bg-dark-border")} />
            ))}
          </div>
          <p className="text-xs text-sage-400 dark:text-dark-text-muted mt-2">
            Step {currentStep + 1} of {totalStops}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <h3 className="text-lg font-bold text-primary-dark dark:text-primary mb-4">{currentGenLabel}</h3>

          <div className="space-y-3 max-h-64 overflow-y-auto">
            {currentGenPeople.map((person) => (
              <Link
                key={person.personId}
                to="/person/$personId"
                params={{ personId: person.personId }}
                onClick={onClose}
                className="flex items-center gap-3 bg-sage-50 dark:bg-dark-surface rounded-xl p-3 hover:bg-sage-100 dark:hover:bg-dark-card transition-colors group"
              >
                {person.profilePhotoUrl ? (
                  <img src={person.profilePhotoUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-sage-200" />
                ) : (
                  <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold", genderBg(person.gender))}>
                    {getInitials(person.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-earth-900 dark:text-dark-text text-sm group-hover:text-primary-dark transition-colors">
                    {person.name}
                  </p>
                  <p className="text-xs text-sage-400 dark:text-dark-text-muted">
                    {person.birthYear ? `b. ${person.birthYear}` : ""}
                    {person.deathYear ? ` \u2013 d. ${person.deathYear}` : ""}
                    {person.isLiving && person.birthYear ? " \u2013 Living" : ""}
                  </p>
                  {person.birthPlace && (
                    <p className="text-xs text-sage-300 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {person.birthPlace}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            className="flex items-center gap-1 text-sm font-medium text-sage-400 hover:text-earth-900 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>

          {currentStep < totalStops - 1 ? (
            <button
              onClick={() => setCurrentStep((s) => s + 1)}
              className="flex items-center gap-1 px-4 py-2 bg-primary text-earth-900 font-bold text-sm rounded-lg hover:bg-primary-dark hover:text-white transition-colors"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <Link
              to="/tree"
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-earth-900 font-bold text-sm rounded-lg hover:bg-primary-dark hover:text-white transition-colors"
            >
              <TreePine className="h-4 w-4" /> Explore the Tree
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

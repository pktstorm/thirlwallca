import { Link } from "@tanstack/react-router"
import { Briefcase, ArrowRight, User, BookOpen, Image, Clock, TreePine, MapPin as MapPinIcon } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "../../lib/utils"
import { api } from "../../lib/api"
import { useAuthStore } from "../../stores/authStore"

export interface PersonCardData {
  id: string
  firstName: string
  lastName: string
  middleName: string | null
  maidenName: string | null
  suffix: string | null
  gender: string
  birthDate: string | null
  birthDateApprox: boolean
  deathDate: string | null
  deathDateApprox: boolean
  isLiving: boolean
  bio: string | null
  occupation: string | null
  profilePhotoUrl: string | null
}

interface PersonCardProps {
  person: PersonCardData
}

function formatYear(dateStr: string | null, approx: boolean): string | null {
  if (!dateStr) return null
  const year = dateStr.slice(0, 4)
  return approx ? `c. ${year}` : year
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function getAvatarColor(gender: string): string {
  switch (gender) {
    case "male":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
    case "female":
      return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
    default:
      return "bg-sage-100 text-sage-800 dark:bg-dark-surface dark:text-dark-text"
  }
}

export function PersonCard({ person }: PersonCardProps) {
  const linkedPersonId = useAuthStore((s) => s.user?.linkedPersonId)

  const birthYear = formatYear(person.birthDate, person.birthDateApprox)
  const deathYear = formatYear(person.deathDate, person.deathDateApprox)

  const dateRange = person.isLiving
    ? birthYear ? `${birthYear} \u2013 Present` : "Living"
    : birthYear || deathYear
      ? `${birthYear ?? "?"} \u2013 ${deathYear ?? "?"}`
      : null

  const fullName = [
    person.firstName,
    person.middleName,
    person.maidenName ? `(${person.maidenName})` : null,
    person.lastName,
    person.suffix,
  ].filter(Boolean).join(" ")

  // Fetch relationship to viewer
  const { data: relationshipPath } = useQuery<{
    label: string; description: string; found: boolean
  }>({
    queryKey: ["relationship-path", linkedPersonId, person.id],
    queryFn: async () => {
      const res = await api.get(`/tree/relationship/${linkedPersonId}/to/${person.id}`)
      return res.data
    },
    enabled: !!linkedPersonId && linkedPersonId !== person.id,
    staleTime: 300_000,
  })

  // Fetch quick stats
  const { data: summary } = useQuery<{
    summary: string; story_count: number; timeline_event_count: number; media_count: number
  }>({
    queryKey: ["person-summary", person.id],
    queryFn: async () => {
      const res = await api.get(`/persons/${person.id}/summary`)
      return res.data
    },
    staleTime: 300_000,
  })

  return (
    <div className="group bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200">
      <div className="p-5">
        {/* Top section: photo + name */}
        <div className="flex items-start gap-4">
          {person.profilePhotoUrl ? (
            <img
              src={person.profilePhotoUrl}
              alt={fullName}
              className="w-16 h-16 rounded-full object-cover border-2 border-sage-100 dark:border-dark-border shrink-0"
            />
          ) : (
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center shrink-0 border-2 border-sage-100 dark:border-dark-border",
              getAvatarColor(person.gender),
            )}>
              {person.firstName && person.lastName ? (
                <span className="text-lg font-bold">{getInitials(person.firstName, person.lastName)}</span>
              ) : (
                <User className="h-6 w-6" />
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <Link
              to="/person/$personId"
              params={{ personId: person.id }}
              className="text-lg font-bold text-earth-900 dark:text-dark-text group-hover:text-primary transition-colors line-clamp-1"
            >
              {fullName}
            </Link>

            {dateRange && (
              <p className="text-sm text-sage-400 dark:text-dark-text-muted font-mono mt-0.5">{dateRange}</p>
            )}

            {/* Relationship badge */}
            {relationshipPath?.found && relationshipPath.label !== "self" && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary-dark text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">
                {relationshipPath.description}
              </span>
            )}
            {linkedPersonId === person.id && (
              <span className="inline-flex items-center gap-1 bg-sage-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">
                You
              </span>
            )}
          </div>
        </div>

        {/* Occupation */}
        {person.occupation && (
          <div className="mt-2 flex items-center gap-2 text-sm text-sage-800 dark:text-dark-text">
            <Briefcase className="h-3.5 w-3.5 text-sage-300 shrink-0" />
            <span className="truncate">{person.occupation}</span>
          </div>
        )}

        {/* Bio snippet */}
        {person.bio && (
          <p className="mt-2 text-sm text-sage-400 dark:text-dark-text-muted line-clamp-2">{person.bio}</p>
        )}

        {/* Quick stats icons */}
        {summary && (summary.story_count > 0 || summary.media_count > 0 || summary.timeline_event_count > 0) && (
          <div className="mt-3 flex items-center gap-3">
            {summary.story_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-sage-400 dark:text-dark-text-muted" title={`${summary.story_count} stories`}>
                <BookOpen className="h-3 w-3" /> {summary.story_count}
              </span>
            )}
            {summary.media_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-sage-400 dark:text-dark-text-muted" title={`${summary.media_count} photos`}>
                <Image className="h-3 w-3" /> {summary.media_count}
              </span>
            )}
            {summary.timeline_event_count > 0 && (
              <span className="flex items-center gap-1 text-xs text-sage-400 dark:text-dark-text-muted" title={`${summary.timeline_event_count} events`}>
                <Clock className="h-3 w-3" /> {summary.timeline_event_count}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer with action buttons */}
      <div className="px-5 py-3 border-t border-sage-100 dark:border-dark-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            to="/tree/$personId"
            params={{ personId: person.id }}
            className="text-xs font-medium text-sage-400 hover:text-primary-dark transition-colors flex items-center gap-1"
            title="Show on Tree"
          >
            <TreePine className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/map"
            className="text-xs font-medium text-sage-400 hover:text-primary-dark transition-colors flex items-center gap-1"
            title="Show on Map"
          >
            <MapPinIcon className="h-3.5 w-3.5" />
          </Link>
        </div>
        <Link
          to="/person/$personId"
          params={{ personId: person.id }}
          className="text-sm font-medium text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
        >
          View Profile
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

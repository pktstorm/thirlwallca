import { Link } from "@tanstack/react-router"
import { Briefcase, ArrowRight, User } from "lucide-react"
import { cn } from "../../lib/utils"

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
  const birthYear = formatYear(person.birthDate, person.birthDateApprox)
  const deathYear = formatYear(person.deathDate, person.deathDateApprox)

  const dateRange = person.isLiving
    ? birthYear
      ? `${birthYear} - Present`
      : "Living"
    : birthYear || deathYear
      ? `${birthYear ?? "?"} - ${deathYear ?? "?"}`
      : null

  const fullName = [
    person.firstName,
    person.middleName,
    person.maidenName ? `(${person.maidenName})` : null,
    person.lastName,
    person.suffix,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className="group bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200">
      <div className="p-5">
        {/* Top section: photo + name */}
        <div className="flex items-start gap-4">
          {/* Avatar */}
          {person.profilePhotoUrl ? (
            <img
              src={person.profilePhotoUrl}
              alt={fullName}
              className="w-16 h-16 rounded-full object-cover border-2 border-sage-100 dark:border-dark-border shrink-0"
            />
          ) : (
            <div
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center shrink-0 border-2 border-sage-100 dark:border-dark-border",
                getAvatarColor(person.gender),
              )}
            >
              {person.firstName && person.lastName ? (
                <span className="text-lg font-bold">
                  {getInitials(person.firstName, person.lastName)}
                </span>
              ) : (
                <User className="h-6 w-6" />
              )}
            </div>
          )}

          {/* Name + dates */}
          <div className="min-w-0 flex-1">
            <Link
              to="/tree/$personId"
              params={{ personId: person.id }}
              className="text-lg font-bold text-earth-900 dark:text-dark-text group-hover:text-primary transition-colors line-clamp-1"
            >
              {fullName}
            </Link>

            {dateRange && (
              <p className="text-sm text-sage-400 dark:text-dark-text-muted font-mono mt-0.5">
                {dateRange}
              </p>
            )}
          </div>
        </div>

        {/* Details section */}
        <div className="mt-3 space-y-1.5">
          {person.occupation && (
            <div className="flex items-center gap-2 text-sm text-sage-800 dark:text-dark-text">
              <Briefcase className="h-4 w-4 text-sage-300 dark:text-dark-text-muted shrink-0" />
              <span className="truncate">{person.occupation}</span>
            </div>
          )}
        </div>

        {/* Bio snippet */}
        {person.bio && (
          <p className="mt-3 text-sm text-sage-400 dark:text-dark-text-muted line-clamp-2">
            {person.bio}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-sage-100 dark:border-dark-border flex items-center justify-end">
        <Link
          to="/tree/$personId"
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

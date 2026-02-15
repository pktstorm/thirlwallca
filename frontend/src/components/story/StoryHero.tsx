import { Link, useNavigate } from "@tanstack/react-router"
import { Calendar, Edit, User } from "lucide-react"
import { AppHeader } from "../layout/AppHeader"
import { Breadcrumbs } from "../layout/Breadcrumbs"
import type { Person } from "../../types/person"

// ── Helpers ──

function formatDate(dateStr: string | null, approx: boolean): string {
  if (!dateStr) return "Unknown"
  const date = new Date(dateStr + "T00:00:00")
  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
  return approx ? `c. ${formatted}` : formatted
}

function buildFullName(person: Person): string {
  return [person.firstName, person.middleName, person.lastName, person.suffix]
    .filter(Boolean)
    .join(" ")
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function getInitialsBgColor(gender: Person["gender"]): string {
  switch (gender) {
    case "male":
      return "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300"
    case "female":
      return "bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300"
    default:
      return "bg-sage-100 dark:bg-dark-surface text-sage-600 dark:text-dark-text-muted"
  }
}

// ── Props ──

interface StoryHeroProps {
  person: Person
  storyTitle: string | null
  storySubtitle: string | null
  canEdit: boolean
}

export function StoryHero({
  person,
  storyTitle,
  storySubtitle,
  canEdit,
}: StoryHeroProps) {
  const navigate = useNavigate()
  const fullName = buildFullName(person)

  return (
    <div className="relative bg-gradient-to-br from-bg-dark via-primary-darker to-bg-dark overflow-hidden">
      {/* Texture overlays */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 50%, rgba(48,232,110,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(48,232,110,0.15) 0%, transparent 40%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <AppHeader />

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-14">
        {/* Breadcrumbs */}
        <div className="mb-10">
          <Breadcrumbs
            items={[
              {
                label: "Family Tree",
                onClick: () => navigate({ to: "/tree" }),
              },
              {
                label: fullName,
                onClick: () =>
                  navigate({
                    to: "/person/$personId",
                    params: { personId: person.id },
                  }),
              },
              { label: "Life Story", active: true },
            ]}
          />
        </div>

        {/* Magazine-style split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left: biographical text */}
          <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
            {/* Memorial badge */}
            {!person.isLiving && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-white/80 text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-primary" />
                In Loving Memory
              </div>
            )}

            {/* Name */}
            <h1 className="font-serif text-5xl lg:text-6xl font-medium leading-tight text-white tracking-tight">
              {person.firstName}{" "}
              <span className="italic text-primary/80 font-normal">
                {person.lastName}
              </span>
            </h1>

            {person.maidenName && (
              <p className="text-sage-300 dark:text-dark-text-muted text-lg italic -mt-3">
                n&eacute;e {person.maidenName}
              </p>
            )}

            {/* Born / Died bar */}
            <div className="flex items-center gap-6 text-lg text-white/60 border-l-4 border-primary pl-4">
              <div>
                <span className="block text-xs uppercase tracking-widest text-primary font-bold">
                  Born
                </span>
                {formatDate(person.birthDate, person.birthDateApprox)}
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <span className="block text-xs uppercase tracking-widest text-primary font-bold">
                  {person.isLiving ? "Age" : "Died"}
                </span>
                {person.isLiving
                  ? "Living"
                  : formatDate(person.deathDate, person.deathDateApprox)}
              </div>
              {person.occupation && (
                <>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="italic text-base text-white/50">
                    {person.occupation}
                  </div>
                </>
              )}
            </div>

            {/* Bio excerpt */}
            {person.bio && (
              <p className="text-lg leading-relaxed text-white/70 max-w-xl">
                {person.bio}
              </p>
            )}

            {/* Story title & subtitle */}
            {storyTitle && (
              <div className="pt-2">
                <h2 className="font-serif text-2xl text-primary font-semibold italic">
                  {storyTitle}
                </h2>
                {storySubtitle && (
                  <p className="text-sage-300 dark:text-dark-text-muted text-sm mt-1">
                    {storySubtitle}
                  </p>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <Link
                to="/person/$personId"
                params={{ personId: person.id }}
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
              >
                <User className="h-4 w-4" />
                View Profile
              </Link>
              {canEdit && (
                <Link
                  to="/person/$personId/story-edit"
                  params={{ personId: person.id }}
                  className="inline-flex items-center gap-2 bg-primary text-earth-900 font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg hover:bg-primary-dark hover:text-white transition-colors shadow-lg"
                >
                  <Edit className="h-4 w-4" />
                  Edit Story
                </Link>
              )}
            </div>
          </div>

          {/* Right: portrait */}
          <div className="lg:col-span-5 order-1 lg:order-2 relative flex justify-center">
            <div className="relative">
              {/* Glow behind portrait */}
              <div className="absolute inset-0 bg-primary/20 rounded-3xl blur-3xl translate-x-4 translate-y-4 -z-10" />

              {person.profilePhotoUrl ? (
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/10">
                  <img
                    src={person.profilePhotoUrl}
                    alt={fullName}
                    className="w-full h-[400px] sm:h-[450px] object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/50 to-transparent p-5">
                    <p className="text-white/80 text-sm font-medium tracking-wide uppercase flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {person.firstName} {person.lastName}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className={`w-64 h-64 lg:w-80 lg:h-80 rounded-2xl shadow-2xl border-4 border-white/10 flex items-center justify-center ${getInitialsBgColor(person.gender)}`}
                >
                  <span className="text-7xl font-bold">
                    {getInitials(person.firstName, person.lastName)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

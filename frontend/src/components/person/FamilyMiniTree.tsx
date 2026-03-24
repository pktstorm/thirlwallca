import { Link } from "@tanstack/react-router"
import { Heart, Plus } from "lucide-react"
import type { Person } from "../../types/person"
import type { Relationship } from "../../types/relationship"

interface GroupedRelationships {
  parents: { relationship: Relationship; person: Person }[]
  spouses: { relationship: Relationship; person: Person }[]
  children: { relationship: Relationship; person: Person }[]
}

interface FamilyMiniTreeProps {
  personId: string
  person: Person
  grouped: GroupedRelationships
  canEdit: boolean
  onAddRelationship: () => void
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function genderBg(gender: string): string {
  switch (gender) {
    case "female": return "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400"
    case "male": return "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
    default: return "bg-sage-100 dark:bg-dark-surface text-sage-600 dark:text-dark-text-muted"
  }
}

function MiniNode({ person, isCurrent, size = "md" }: { person: Person; isCurrent?: boolean; size?: "sm" | "md" }) {
  const w = size === "sm" ? "w-12 h-12" : "w-14 h-14"
  const textSize = size === "sm" ? "text-[9px]" : "text-[10px]"
  const avatarSize = size === "sm" ? "w-7 h-7 text-[10px]" : "w-8 h-8 text-xs"

  return (
    <Link
      to="/person/$personId"
      params={{ personId: person.id }}
      className={`flex flex-col items-center gap-1 group ${isCurrent ? "pointer-events-none" : ""}`}
    >
      <div className={`${w} rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all ${
        isCurrent
          ? "bg-primary/10 border-2 border-primary shadow-sm"
          : "bg-white dark:bg-dark-card border border-sage-200 dark:border-dark-border group-hover:border-primary/40 group-hover:shadow-md"
      }`}>
        {person.profilePhotoUrl ? (
          <img src={person.profilePhotoUrl} alt="" className={`${avatarSize} rounded-full object-cover`} />
        ) : (
          <div className={`${avatarSize} rounded-full flex items-center justify-center font-bold ${genderBg(person.gender)}`}>
            {getInitials(person.firstName, person.lastName)}
          </div>
        )}
      </div>
      <span className={`${textSize} font-medium text-center leading-tight max-w-16 truncate ${
        isCurrent ? "text-primary-dark dark:text-primary" : "text-earth-900 dark:text-dark-text group-hover:text-primary-dark"
      }`}>
        {person.firstName}
      </span>
    </Link>
  )
}

export function FamilyMiniTree({ person, grouped, canEdit, onAddRelationship }: FamilyMiniTreeProps) {
  const hasParents = grouped.parents.length > 0
  const hasSpouses = grouped.spouses.length > 0
  const hasChildren = grouped.children.length > 0
  const isEmpty = !hasParents && !hasSpouses && !hasChildren

  if (isEmpty) {
    return (
      <div className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-6 text-center">
        <p className="text-sage-400 dark:text-dark-text-muted text-sm mb-3">No family connections recorded yet.</p>
        {canEdit && (
          <button
            onClick={onAddRelationship}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-dark hover:text-primary transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Relationship
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-5 overflow-x-auto">
      <div className="flex flex-col items-center gap-3 min-w-fit">
        {/* Parents row */}
        {hasParents && (
          <>
            <div className="flex items-center gap-3">
              {grouped.parents.map(({ person: p }) => (
                <MiniNode key={p.id} person={p} />
              ))}
              {grouped.parents.length === 2 && (
                <div className="absolute" style={{ display: "none" }}>
                  {/* Marriage line handled by gap */}
                </div>
              )}
            </div>
            {/* Connector line down */}
            <div className="w-px h-4 bg-sage-200 dark:bg-dark-border" />
          </>
        )}

        {/* Current person + spouse row */}
        <div className="flex items-center gap-2">
          <MiniNode person={person} isCurrent />
          {hasSpouses && grouped.spouses.map(({ person: sp }) => (
            <div key={sp.id} className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                <div className="w-3 h-px bg-sage-300 dark:bg-dark-border" />
                <Heart className="h-3 w-3 text-sage-300 dark:text-dark-border" />
                <div className="w-3 h-px bg-sage-300 dark:bg-dark-border" />
              </div>
              <MiniNode person={sp} />
            </div>
          ))}
        </div>

        {/* Children row */}
        {hasChildren && (
          <>
            <div className="w-px h-4 bg-sage-200 dark:bg-dark-border" />
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {grouped.children.map(({ person: c }) => (
                <MiniNode key={c.id} person={c} size="sm" />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add button */}
      {canEdit && (
        <div className="flex justify-center mt-4 pt-3 border-t border-sage-100 dark:border-dark-border">
          <button
            onClick={onAddRelationship}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-dark dark:text-primary hover:text-primary transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Relationship
          </button>
        </div>
      )}
    </div>
  )
}

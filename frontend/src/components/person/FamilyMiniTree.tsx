import { useMemo } from "react"
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
  /** All raw relationships for this person — needed to determine which children are shared with which spouse */
  allRelationships: Relationship[]
  /** Map of all related person objects by ID */
  relatedPersons: Map<string, Person>
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
      <span className={`${textSize} font-medium text-center leading-tight max-w-24 truncate ${
        isCurrent ? "text-primary-dark dark:text-primary" : "text-earth-900 dark:text-dark-text group-hover:text-primary-dark"
      }`}>
        {person.firstName} {person.lastName}
      </span>
    </Link>
  )
}

export function FamilyMiniTree({ person, grouped, allRelationships, canEdit, onAddRelationship }: FamilyMiniTreeProps) {
  const hasParents = grouped.parents.length > 0
  const hasSpouses = grouped.spouses.length > 0
  const hasChildren = grouped.children.length > 0
  const isEmpty = !hasParents && !hasSpouses && !hasChildren

  // Group children by which spouse they share as a co-parent
  // A child is "shared" with a spouse if the spouse is also a parent of that child
  const childrenBySpouse = useMemo(() => {
    if (!hasChildren) return []

    // Build a set of each spouse's children
    const spouseChildSets = new Map<string, Set<string>>() // spouseId -> set of child IDs
    for (const sp of grouped.spouses) {
      const spouseChildren = new Set<string>()
      for (const rel of allRelationships) {
        if (rel.relationship !== "parent_child") continue
        // rel.personId = child, rel.relatedPersonId = parent
        // Check if this spouse is a parent of this child
        if (rel.relatedPersonId === sp.person.id) {
          spouseChildren.add(rel.personId)
        }
        if (rel.personId === sp.person.id) {
          // Check reverse: maybe spouse is the child? No — we only care about spouse as parent
        }
      }
      spouseChildSets.set(sp.person.id, spouseChildren)
    }

    const groups: { spouse: Person | null; children: Person[] }[] = []
    const assignedChildren = new Set<string>()

    // For each spouse, find shared children
    for (const sp of grouped.spouses) {
      const spouseChildren = spouseChildSets.get(sp.person.id) ?? new Set()
      const shared: Person[] = []
      for (const { person: child } of grouped.children) {
        if (spouseChildren.has(child.id)) {
          shared.push(child)
          assignedChildren.add(child.id)
        }
      }
      if (shared.length > 0) {
        groups.push({ spouse: sp.person, children: shared })
      }
    }

    // Remaining children (not shared with any spouse)
    const soloChildren: Person[] = []
    for (const { person: child } of grouped.children) {
      if (!assignedChildren.has(child.id)) {
        soloChildren.push(child)
      }
    }
    if (soloChildren.length > 0) {
      groups.push({ spouse: null, children: soloChildren })
    }

    return groups
  }, [grouped, allRelationships, hasChildren])

  if (isEmpty) {
    return (
      <div className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-6 text-center">
        <p className="text-sage-400 dark:text-dark-text-muted text-sm mb-3">No family connections recorded yet.</p>
        {canEdit && (
          <button onClick={onAddRelationship}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-dark hover:text-primary transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Relationship
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
            </div>
            <div className="w-px h-4 bg-sage-200 dark:bg-dark-border" />
          </>
        )}

        {/* Current person row (no spouse shown here — spouses shown with their children below) */}
        <MiniNode person={person} isCurrent />

        {/* Children grouped by co-parent spouse */}
        {childrenBySpouse.map((group, i) => (
          <div key={i} className="flex flex-col items-center gap-2 w-full">
            <div className="w-px h-3 bg-sage-200 dark:bg-dark-border" />

            {/* Spouse label for this group */}
            {group.spouse ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  <div className="w-3 h-px bg-sage-300 dark:bg-dark-border" />
                  <Heart className="h-3 w-3 text-sage-300 dark:text-dark-border" />
                  <div className="w-3 h-px bg-sage-300 dark:bg-dark-border" />
                </div>
                <MiniNode person={group.spouse} size="sm" />
              </div>
            ) : hasSpouses ? (
              <p className="text-[9px] text-sage-300 dark:text-dark-text-muted/50 uppercase tracking-wider">From a previous relationship</p>
            ) : null}

            <div className="w-px h-2 bg-sage-200 dark:bg-dark-border" />

            {/* Children in this group */}
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {group.children.map((c) => (
                <MiniNode key={c.id} person={c} size="sm" />
              ))}
            </div>
          </div>
        ))}

        {/* Spouses with no children (just show the marriage connection) */}
        {grouped.spouses
          .filter((sp) => !childrenBySpouse.some((g) => g.spouse?.id === sp.person.id))
          .map(({ person: sp }) => (
            <div key={sp.id} className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-0.5">
                <div className="w-3 h-px bg-sage-300 dark:bg-dark-border" />
                <Heart className="h-3 w-3 text-sage-300 dark:text-dark-border" />
                <div className="w-3 h-px bg-sage-300 dark:bg-dark-border" />
              </div>
              <MiniNode person={sp} size="sm" />
            </div>
          ))}
      </div>

      {/* Add button */}
      {canEdit && (
        <div className="flex justify-center mt-4 pt-3 border-t border-sage-100 dark:border-dark-border">
          <button onClick={onAddRelationship}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-dark dark:text-primary hover:text-primary transition-colors">
            <Plus className="h-3.5 w-3.5" /> Add Relationship
          </button>
        </div>
      )}
    </div>
  )
}

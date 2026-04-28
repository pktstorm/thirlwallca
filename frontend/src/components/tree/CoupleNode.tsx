import { memo } from "react"
import { Handle, Position, useStore, type NodeProps } from "@xyflow/react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"
import { useTreeStore } from "../../stores/treeStore"
import { useAuthStore } from "../../stores/authStore"
import type { CoupleNodeData } from "./layoutUtils"
import type { TreeNodeData } from "./FamilyTreeCanvas"
import { SPOUSE_GEN_OFFSET_PX } from "./treeLayoutConstants"

function formatDateRange(
  birthDate: string | null,
  deathDate: string | null,
  isLiving: boolean,
): string {
  const birth = birthDate ? new Date(birthDate).getFullYear() : "?"
  if (isLiving) return `b. ${birth}`
  const death = deathDate ? new Date(deathDate).getFullYear() : "?"
  return `${birth}\u2013${death}`
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function genderBg(gender: string): string {
  switch (gender) {
    case "female":
      return "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300"
    case "male":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    default:
      return "bg-sage-100 text-sage-800 dark:bg-dark-surface dark:text-dark-text"
  }
}

function genderDotColor(gender: string): string {
  switch (gender) {
    case "female": return "bg-pink-400"
    case "male": return "bg-blue-400"
    default: return "bg-sage-400"
  }
}

// --- Bird's Eye View (zoom < 0.4) ---
function BirdEyeView({ data }: { data: CoupleNodeData }) {
  const primaryColor = genderDotColor(data.primary.gender)
  const spouseColor = data.spouse ? genderDotColor(data.spouse.gender) : null
  const isDirectLine = data.primaryIsDirectLine || data.spouseIsDirectLine
  const isFocused = data.primaryIsFocused || data.spouseIsFocused

  return (
    <div className={cn(
      "flex items-center justify-center gap-2 h-full w-full rounded-full transition-all duration-150",
      isFocused && "ring-4 ring-primary/50",
      isDirectLine && !isFocused && "ring-2 ring-primary/30",
    )}>
      <div className={cn("w-8 h-8 rounded-full", primaryColor, isDirectLine && "ring-2 ring-primary")} />
      {spouseColor && (
        <div className={cn("w-8 h-8 rounded-full", spouseColor, data.spouseIsDirectLine && "ring-2 ring-primary")} />
      )}
      <Handle type="target" position={Position.Top} id="pc-target" className="!w-0 !h-0 !bg-transparent !border-0 !min-w-0 !min-h-0" />
      <Handle type="source" position={Position.Bottom} id="pc-source" className="!w-0 !h-0 !bg-transparent !border-0 !min-w-0 !min-h-0" />
    </div>
  )
}

function compactName(firstName: string, lastName: string): string {
  const initial = firstName.trim().charAt(0)
  return initial ? `${initial}. ${lastName}` : lastName
}

// --- Overview View (zoom 0.4-0.8) ---
function OverviewPill({ person, isDirectLine, isFocused, isCurrentUser, compact }: {
  person: TreeNodeData
  isDirectLine: boolean
  isFocused: boolean
  isCurrentUser: boolean
  compact: boolean
}) {
  const dateStr = formatDateRange(person.birth_date, person.death_date, person.is_living)
  const displayName = compact
    ? compactName(person.first_name, person.last_name)
    : `${person.first_name} ${person.last_name}`

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 min-w-0",
      isFocused && "font-bold",
    )}>
      <div className={cn(
        "rounded-full flex items-center justify-center font-bold flex-shrink-0",
        compact ? "w-4 h-4 text-[6px]" : "w-5 h-5 text-[8px]",
        genderBg(person.gender),
      )}>
        {getInitials(person.first_name, person.last_name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn(
          "leading-tight truncate",
          compact ? "text-[9px]" : "text-[10px]",
          isDirectLine ? "text-earth-900 dark:text-dark-text font-semibold" : "text-sage-400 dark:text-dark-text-muted",
          isCurrentUser && "text-sage-800 dark:text-sage-300",
        )}>
          {displayName}
        </p>
        <p className="text-[8px] text-sage-300 dark:text-dark-text-muted/60 leading-tight">{dateStr}</p>
      </div>
    </div>
  )
}

function OverviewView({ data }: { data: CoupleNodeData }) {
  const focusedPersonId = useTreeStore((s) => s.focusedPersonId)
  const linkedPersonId = useAuthStore((s) => s.user?.linkedPersonId)
  const isDirectLine = data.primaryIsDirectLine || data.spouseIsDirectLine
  const isFocused = data.primaryIsFocused || data.spouseIsFocused
  const compact = data.compact ?? false

  return (
    <div className={cn(
      "h-full w-full flex items-center rounded-lg border transition-all duration-150",
      isFocused
        ? "bg-white dark:bg-dark-card border-primary shadow-sm"
        : isDirectLine
          ? "bg-white/90 dark:bg-dark-card/90 border-primary/30"
          : "bg-white/60 dark:bg-dark-card/40 border-sage-200/50 dark:border-dark-border/30",
      !isDirectLine && !isFocused && "opacity-50",
    )}>
      <OverviewPill
        person={data.primary}
        isDirectLine={data.primaryIsDirectLine ?? false}
        isFocused={focusedPersonId === data.primaryId}
        isCurrentUser={linkedPersonId === data.primaryId}
        compact={compact}
      />
      {data.spouse && (() => {
        const offset = data.spouseGenOffset ?? 0
        return (
          <>
            <div className="w-px h-4 bg-sage-200 dark:bg-dark-border flex-shrink-0" />
            <div
              style={{ transform: `translateY(${offset * SPOUSE_GEN_OFFSET_PX}px)` }}
              className="relative"
            >
              <OverviewPill
                person={data.spouse}
                isDirectLine={data.spouseIsDirectLine ?? false}
                isFocused={focusedPersonId === data.spouseId}
                isCurrentUser={linkedPersonId === data.spouseId}
                compact={compact}
              />
              {offset !== 0 && (
                <div
                  className="absolute -top-2 -right-2 z-10 flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[9px] font-semibold px-1 py-px rounded-full border border-amber-200 dark:border-amber-800 shadow-sm"
                  title={
                    offset > 0
                      ? `Spouse is ${Math.abs(offset)} generation${Math.abs(offset) > 1 ? "s" : ""} younger`
                      : `Spouse is ${Math.abs(offset)} generation${Math.abs(offset) > 1 ? "s" : ""} older`
                  }
                >
                  {offset > 0 ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronUp className="w-2.5 h-2.5" />}
                  <span>{offset > 0 ? `+${offset}G` : `${offset}G`}</span>
                </div>
              )}
            </div>
          </>
        )
      })()}
      <Handle type="target" position={Position.Top} id="pc-target" className="!w-0 !h-0 !bg-transparent !border-0 !min-w-0 !min-h-0" />
      <Handle type="source" position={Position.Bottom} id="pc-source" className="!w-0 !h-0 !bg-transparent !border-0 !min-w-0 !min-h-0" />
    </div>
  )
}

// --- Detail View (zoom > 0.8) ---
function DetailPerson({ person, isDirectLine, isFocused, isCurrentUser, compact }: {
  person: TreeNodeData
  isDirectLine: boolean
  isFocused: boolean
  isCurrentUser: boolean
  compact: boolean
}) {
  const dateStr = formatDateRange(person.birth_date, person.death_date, person.is_living)
  const initials = getInitials(person.first_name, person.last_name)
  const displayName = compact
    ? compactName(person.first_name, person.last_name)
    : `${person.first_name} ${person.last_name}`

  return (
    <div className={cn(
      "flex items-center min-w-0 flex-1 rounded-lg transition-colors duration-150",
      compact ? "gap-1.5 px-2 py-1" : "gap-2.5 px-3 py-2",
      isFocused && "bg-primary/5",
    )}>
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {person.profile_photo_url ? (
          <img
            src={person.profile_photo_url}
            alt={`${person.first_name} ${person.last_name}`}
            className={cn(
              "rounded-full object-cover border",
              compact ? "w-6 h-6" : "w-10 h-10",
              isFocused
                ? "border-primary ring-2 ring-primary/30"
                : isDirectLine
                  ? "border-primary/40"
                  : "border-sage-200 dark:border-dark-border",
            )}
          />
        ) : (
          <div className={cn(
            "rounded-full flex items-center justify-center font-bold",
            compact ? "w-6 h-6 text-[9px]" : "w-10 h-10 text-sm",
            genderBg(person.gender),
            isFocused && "ring-2 ring-primary/30",
            isDirectLine && !isFocused && "ring-1 ring-primary/20",
          )}>
            {initials}
          </div>
        )}
        {person.is_living && (
          <div className={cn(
            "absolute bg-primary rounded-full border-white dark:border-dark-card",
            compact
              ? "-bottom-0.5 -right-0.5 w-1.5 h-1.5 border"
              : "-bottom-0.5 -right-0.5 w-2.5 h-2.5 border-[1.5px]",
          )} />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className={cn(
            "leading-tight truncate",
            compact ? "text-[10px]" : "text-xs",
            isFocused
              ? "font-bold text-earth-900 dark:text-dark-text"
              : isDirectLine
                ? "font-semibold text-earth-900 dark:text-dark-text"
                : "font-medium text-sage-400 dark:text-dark-text-muted",
            isCurrentUser && "text-sage-800 dark:text-sage-300",
          )}>
            {displayName}
          </p>
          {isCurrentUser && (
            <span className="bg-sage-800 text-white text-[7px] font-bold uppercase tracking-wider px-1 py-px rounded-full flex-shrink-0">
              You
            </span>
          )}
        </div>
        <p className={cn(
          "text-[9px] leading-tight",
          isDirectLine ? "text-sage-400 dark:text-dark-text-muted" : "text-sage-300 dark:text-dark-text-muted/50",
        )}>
          {dateStr}
        </p>
      </div>
    </div>
  )
}

function DetailView({ data }: { data: CoupleNodeData }) {
  const focusedPersonId = useTreeStore((s) => s.focusedPersonId)
  const linkedPersonId = useAuthStore((s) => s.user?.linkedPersonId)
  const isDirectLine = data.primaryIsDirectLine || data.spouseIsDirectLine
  const isFocused = data.primaryIsFocused || data.spouseIsFocused
  const compact = data.compact ?? false

  return (
    <div className={cn(
      "h-full w-full flex items-stretch rounded-xl border transition-all duration-200",
      isFocused
        ? "bg-white dark:bg-dark-card border-primary shadow-md dark:shadow-none"
        : isDirectLine
          ? "bg-white dark:bg-dark-card border-sage-200 dark:border-dark-border border-l-[3px] border-l-primary"
          : "bg-white dark:bg-dark-card border-sage-200 dark:border-dark-border",
      !isDirectLine && !isFocused && "opacity-50 hover:opacity-80",
      "hover:shadow-md dark:hover:shadow-black/20 hover:border-sage-300 dark:hover:border-dark-text-muted/30",
    )}>
      <DetailPerson
        person={data.primary}
        isDirectLine={data.primaryIsDirectLine ?? false}
        isFocused={focusedPersonId === data.primaryId}
        isCurrentUser={linkedPersonId === data.primaryId}
        compact={compact}
      />
      {data.spouse && (() => {
        const offset = data.spouseGenOffset ?? 0
        return (
          <>
            {/* Marriage separator: double line */}
            <div className="flex flex-col items-center justify-center gap-[2px] flex-shrink-0 px-0.5">
              <div className="w-[2px] h-4 bg-sage-300 dark:bg-dark-border rounded-full" />
              <div className="w-[2px] h-4 bg-sage-300 dark:bg-dark-border rounded-full" />
            </div>
            <div
              style={{ transform: `translateY(${offset * SPOUSE_GEN_OFFSET_PX}px)` }}
              className="relative flex-1 min-w-0"
            >
              <DetailPerson
                person={data.spouse}
                isDirectLine={data.spouseIsDirectLine ?? false}
                isFocused={focusedPersonId === data.spouseId}
                isCurrentUser={linkedPersonId === data.spouseId}
                compact={compact}
              />
              {offset !== 0 && (
                <div
                  className="absolute -top-2 -right-2 z-10 flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[9px] font-semibold px-1 py-px rounded-full border border-amber-200 dark:border-amber-800 shadow-sm"
                  title={
                    offset > 0
                      ? `Spouse is ${Math.abs(offset)} generation${Math.abs(offset) > 1 ? "s" : ""} younger`
                      : `Spouse is ${Math.abs(offset)} generation${Math.abs(offset) > 1 ? "s" : ""} older`
                  }
                >
                  {offset > 0 ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronUp className="w-2.5 h-2.5" />}
                  <span>{offset > 0 ? `+${offset}G` : `${offset}G`}</span>
                </div>
              )}
            </div>
          </>
        )
      })()}
      <Handle
        type="target"
        position={Position.Top}
        id="pc-target"
        className="!w-1.5 !h-1.5 !bg-sage-300 !border-sage-400 dark:!bg-dark-text-muted dark:!border-dark-border"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="pc-source"
        className="!w-1.5 !h-1.5 !bg-sage-300 !border-sage-400 dark:!bg-dark-text-muted dark:!border-dark-border"
      />
    </div>
  )
}

// --- Main CoupleNode component with semantic zoom ---
function CoupleNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as CoupleNodeData
  const zoom = useStore((s) => s.transform[2])

  if (zoom < 0.4) {
    return <BirdEyeView data={nodeData} />
  }

  if (zoom < 0.8) {
    return <OverviewView data={nodeData} />
  }

  return <DetailView data={nodeData} />
}

export const CoupleNodeMemo = memo(CoupleNodeComponent)

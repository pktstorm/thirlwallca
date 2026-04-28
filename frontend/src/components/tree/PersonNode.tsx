import { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { MapPin } from "lucide-react"
import { cn } from "../../lib/utils"
import { useTreeStore } from "../../stores/treeStore"
import { useAuthStore } from "../../stores/authStore"
import type { TreeNodeData } from "./FamilyTreeCanvas"

type PersonNodeData = TreeNodeData & {
  isDirectLine?: boolean
  isFocused?: boolean
  compact?: boolean
}

function formatDateRange(
  birthDate: string | null,
  deathDate: string | null,
  isLiving: boolean,
): string {
  const birth = birthDate ? new Date(birthDate).getFullYear() : "?"
  if (isLiving) return `b. ${birth}`
  const death = deathDate ? new Date(deathDate).getFullYear() : "?"
  return `${birth} - ${death}`
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function compactName(firstName: string, lastName: string): string {
  const initial = firstName.trim().charAt(0)
  return initial ? `${initial}. ${lastName}` : lastName
}

function PersonNodeComponent({ data, id }: NodeProps) {
  const nodeData = data as unknown as PersonNodeData
  const focusedPersonId = useTreeStore((s) => s.focusedPersonId)
  const linkedPersonId = useAuthStore((s) => s.user?.linkedPersonId)

  const isFocused = focusedPersonId === id
  const isDirectLine = nodeData.isDirectLine ?? false
  const isCurrentUser = linkedPersonId === id
  const compact = nodeData.compact ?? false

  const fullName = `${nodeData.first_name} ${nodeData.last_name}`
  const displayName = compact ? compactName(nodeData.first_name, nodeData.last_name) : fullName
  const dateStr = formatDateRange(
    nodeData.birth_date,
    nodeData.death_date,
    nodeData.is_living,
  )
  const initials = getInitials(nodeData.first_name, nodeData.last_name)

  // --- Focused variant ---
  if (isFocused) {
    return (
      <div className="relative transition-transform duration-200">
        {/* Pulsing glow halo */}
        <div className="absolute -inset-4 rounded-3xl bg-primary/20 blur-xl pointer-events-none animate-pulse-line" />

        <div
          className={cn(
            "relative bg-white rounded-2xl border-2 border-primary shadow-glow",
            "dark:bg-dark-card dark:shadow-none",
            "px-4 py-3 flex flex-col items-center gap-2",
            "min-w-[220px]",
          )}
        >
          {/* Focused badge */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-earth-900 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-sm dark:shadow-none">
            Focused
          </div>

          {/* Photo or initials */}
          <div className="relative">
            {nodeData.profile_photo_url ? (
              <img
                src={nodeData.profile_photo_url}
                alt={fullName}
                className="w-16 h-16 rounded-full object-cover ring-4 ring-primary shadow-md dark:shadow-none"
              />
            ) : (
              <div
                className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center ring-4 ring-primary shadow-md dark:shadow-none text-lg font-bold",
                  nodeData.gender === "female"
                    ? "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300"
                    : nodeData.gender === "male"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "bg-sage-100 text-sage-800 dark:bg-dark-surface dark:text-dark-text",
                )}
              >
                {initials}
              </div>
            )}
            {/* Living indicator */}
            {nodeData.is_living && (
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-primary rounded-full border-2 border-white dark:border-dark-card shadow-sm" />
            )}
          </div>

          {/* Name */}
          <div className="text-center">
            <p className="font-bold text-base text-earth-900 dark:text-dark-text leading-tight">
              {fullName}
            </p>
            <p className="text-xs text-sage-400 dark:text-dark-text-muted mt-0.5">{dateStr}</p>
          </div>

          {/* Occupation / location badge */}
          {nodeData.occupation && (
            <div className="flex items-center gap-1 bg-primary/10 text-primary-dark text-[10px] font-medium px-2 py-0.5 rounded-full">
              <MapPin className="w-3 h-3" />
              {nodeData.occupation}
            </div>
          )}
        </div>

        <Handle
          type="target"
          position={Position.Top}
          id="pc-target"
          className="!w-2 !h-2 !bg-primary !border-primary-dark"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="pc-source"
          className="!w-2 !h-2 !bg-primary !border-primary-dark"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="spouse-right"
          className="!w-0 !h-0 !bg-transparent !border-0 !min-w-0 !min-h-0"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="spouse-left"
          className="!w-0 !h-0 !bg-transparent !border-0 !min-w-0 !min-h-0"
        />
      </div>
    )
  }

  // --- Normal / Direct Line / Current User variants ---
  const hasPhoto = !!nodeData.profile_photo_url

  return (
    <div className="relative group">
      {/* Photo — contained inside card */}
      <div
        className={cn(
          "bg-white dark:bg-dark-card rounded-xl border shadow-sm dark:shadow-none flex items-center",
          compact ? "py-1 gap-2 px-2" : "py-2 gap-3 px-3",
          !compact && "min-w-[220px]",
          "transition-all duration-200",
          "group-hover:scale-[1.03] group-hover:shadow-md dark:group-hover:shadow-black/20 group-hover:border-sage-300 dark:group-hover:border-dark-text-muted/30",
          isDirectLine && !isCurrentUser
            ? "border-sage-200 dark:border-dark-border border-l-4 border-l-primary"
            : isCurrentUser
              ? "border-sage-200 dark:border-dark-border border-l-4 border-l-sage-800"
              : "border-sage-200 dark:border-dark-border",
          !isFocused && "opacity-80 hover:opacity-100",
        )}
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {hasPhoto ? (
            <img
              src={nodeData.profile_photo_url!}
              alt={fullName}
              className={cn(
                "rounded-full object-cover border border-sage-200 dark:border-dark-border",
                compact ? "w-6 h-6" : "w-10 h-10",
              )}
            />
          ) : (
            <div
              className={cn(
                "rounded-full flex items-center justify-center font-bold",
                compact ? "w-6 h-6 text-[9px]" : "w-10 h-10 text-sm",
                nodeData.gender === "female"
                  ? "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300"
                  : nodeData.gender === "male"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "bg-sage-100 text-sage-800 dark:bg-dark-surface dark:text-dark-text",
              )}
            >
              {initials}
            </div>
          )}
          {/* Living indicator */}
          {nodeData.is_living && (
            <div className={cn(
              "absolute bg-primary rounded-full border-white dark:border-dark-card",
              compact
                ? "-bottom-0.5 -right-0.5 w-1.5 h-1.5 border"
                : "-bottom-0.5 -right-0.5 w-3 h-3 border-2",
            )} />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={cn(
              "font-bold truncate text-earth-900 dark:text-dark-text",
              compact ? "text-[10px]" : "text-sm",
            )}>
              {displayName}
            </p>
            {isCurrentUser && (
              <span className="bg-sage-800 text-white text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded-full flex-shrink-0">
                You
              </span>
            )}
            {isDirectLine && !isCurrentUser && (
              <span className="bg-primary/10 text-primary-dark text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded-full flex-shrink-0">
                Direct
              </span>
            )}
          </div>
          <p className="text-[10px] text-sage-400 dark:text-dark-text-muted leading-tight">{dateStr}</p>
        </div>

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
        <Handle
          type="source"
          position={Position.Right}
          id="spouse-right"
          className="!w-0 !h-0 !bg-transparent !border-0 !min-w-0 !min-h-0"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="spouse-left"
          className="!w-0 !h-0 !bg-transparent !border-0 !min-w-0 !min-h-0"
        />
      </div>
    </div>
  )
}

export const PersonNode = memo(PersonNodeComponent)

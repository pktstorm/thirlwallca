export interface PersonCardData {
  id: string
  givenName: string
  surname?: string | null
  birthYear?: number | null
  deathYear?: number | null
  isLiving?: boolean
  photoUrl?: string | null
}

export interface PersonCardProps {
  person: PersonCardData
  showPhoto?: boolean
  labelDensity?: "none" | "names" | "names-dates"
  size?: "compact" | "default"  // compact = orbital small tile
  livingDeceasedStyling?: boolean
  onClick?: () => void
  className?: string
}

export function PersonCard({
  person,
  showPhoto = true,
  labelDensity = "names",
  size = "default",
  livingDeceasedStyling = false,
  onClick,
  className = "",
}: PersonCardProps) {
  const fullName = [person.givenName, person.surname].filter(Boolean).join(" ")
  const dateRange =
    person.birthYear || person.deathYear
      ? `${person.birthYear ?? "?"}–${person.deathYear ?? (person.isLiving ? "" : "?")}`
      : null

  const dim = size === "compact" ? 36 : 56
  const livingClass = livingDeceasedStyling
    ? person.isLiving
      ? "border-dashed"
      : "border-solid"
    : ""

  return (
    <div
      className={`flex flex-col items-center gap-1 cursor-pointer select-none ${className}`}
      onClick={onClick}
    >
      <div
        className={`rounded-full overflow-hidden border-2 border-primary/40 bg-sage-50 dark:bg-dark-card flex items-center justify-center ${livingClass}`}
        style={{ width: dim, height: dim }}
      >
        {showPhoto && person.photoUrl ? (
          <img src={person.photoUrl} alt={fullName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-primary-dark dark:text-primary">
            {(person.givenName?.[0] ?? "?").toUpperCase()}
            {(person.surname?.[0] ?? "").toUpperCase()}
          </span>
        )}
      </div>
      {labelDensity !== "none" && (
        <div className="text-center">
          <div className={`${size === "compact" ? "text-[10px]" : "text-xs"} font-medium text-earth-900 dark:text-dark-text leading-tight max-w-[80px] truncate`}>
            {fullName}
          </div>
          {labelDensity === "names-dates" && dateRange && (
            <div className={`${size === "compact" ? "text-[9px]" : "text-[10px]"} text-sage-500 dark:text-dark-text-muted tabular-nums`}>
              {dateRange}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

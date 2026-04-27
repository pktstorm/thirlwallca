import { PersonCard } from "../person/PersonCard"
import type { Slot, OrbitalPersonRef, ControlOptions } from "./orbitalTypes"

interface Props {
  slot: Slot
  person: OrbitalPersonRef
  options: ControlOptions
  isFocus: boolean
  onClick: () => void
  onDoubleClick: () => void
}

export function OrbitalPersonTile({ slot, person, options, isFocus, onClick, onDoubleClick }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${slot.x}px, ${slot.y}px) translate(-50%, -50%)`,
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <PersonCard
        person={{
          id: person.id,
          givenName: person.givenName,
          surname: person.surname,
          birthYear: person.birthYear,
          deathYear: person.deathYear,
          isLiving: person.isLiving,
          photoUrl: person.photoUrl,
        }}
        showPhoto={options.showPhotos}
        labelDensity={options.labelDensity}
        size={isFocus ? "default" : "compact"}
        livingDeceasedStyling={options.livingDeceasedStyling}
      />
    </div>
  )
}

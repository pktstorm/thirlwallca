// site/frontend/src/components/orbital/orbitalTypes.ts

export type Hemisphere = "top" | "bottom"
export type ParentSlot = "father" | "mother" | null
export type LabelDensity = "none" | "names" | "names-dates"

export interface OrbitalPersonRef {
  id: string
  givenName: string
  surname: string | null
  birthYear: number | null
  deathYear: number | null
  isLiving: boolean
  photoUrl: string | null
  sex: string | null
}

export interface OrbitAncestorNode extends OrbitalPersonRef {
  parentSlot: ParentSlot
  parentId: string | null
}

export interface OrbitDescendantNode extends OrbitalPersonRef {
  parentId: string
  children: OrbitDescendantNode[]
}

export interface OrbitSpouseRef extends OrbitalPersonRef {
  spouseOf: string
}

export interface OrbitData {
  focus: OrbitalPersonRef
  ancestorsByGeneration: OrbitAncestorNode[][]
  descendants: OrbitDescendantNode[]
  siblings: OrbitalPersonRef[]
  spouses: OrbitSpouseRef[]
}

export interface ControlOptions {
  // Shared with treeDisplayStore
  ancestorDepth: number          // 1..10
  descendantDepth: number        // 1..10
  showSpouses: boolean
  showPhotos: boolean
  highlightDirectLine: boolean
  livingDeceasedStyling: boolean
  labelDensity: LabelDensity
  // Orbital-only
  showSiblings: boolean
  colorByBranch: boolean
  recenterOnSingleClick: boolean
}

export interface Ring {
  generation: number             // negative for descendants (-1, -2, ...), positive for ancestors (1, 2, ...), 0 for focus
  radius: number                 // in px in canvas coords
  hemisphere: Hemisphere
  dense: boolean
}

export interface Slot {
  id: string                     // synthetic — `${personId}` for direct slots; `${personId}:spouse:${spouseId}` for spouses
  personId: string
  ring: number                   // matches Ring.generation
  angle: number                  // radians, measured from +x axis (math convention)
  x: number
  y: number
  branchKey: "paternal" | "maternal" | "descendant" | "self"  // for color-by-branch
  parentSlotId: string | null
  isSpouse: boolean
  isSibling: boolean
}

export interface OrbitalEdge {
  id: string                     // `${fromSlotId}->${toSlotId}`
  fromSlotId: string
  toSlotId: string
  type: "ancestor" | "descendant"
  // SVG path data: "M x1 y1 L x2 y2 A r r 0 0 sweep x3 y3"
  path: string
}

export interface LayoutResult {
  rings: Ring[]
  slots: Slot[]
  edges: OrbitalEdge[]
  bounds: { width: number; height: number }   // total area the layout occupies, centered at (0,0)
}

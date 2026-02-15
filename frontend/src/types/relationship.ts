export interface Relationship {
  id: string
  personId: string
  relatedPersonId: string
  relationship: "parent_child" | "spouse"
  marriageDate: string | null
  divorceDate: string | null
  notes: string | null
}

export interface Story {
  id: string
  title: string
  subtitle: string | null
  content: unknown // Plate.js JSON content
  coverImageUrl: string | null
  authorId: string
  published: boolean
  createdAt: string
  updatedAt: string
}

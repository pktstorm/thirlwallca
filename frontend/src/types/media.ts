export type MediaType = "photo" | "document" | "video" | "audio"

export interface Media {
  id: string
  title: string | null
  description: string | null
  mediaType: MediaType
  url: string
  thumbnailUrl: string | null
  fileSizeBytes: number | null
  mimeType: string | null
  width: number | null
  height: number | null
  durationSeconds: number | null
  dateTaken: string | null
  dateTakenApprox: boolean
  locationId: string | null
  uploadedBy: string
  createdAt: string
}

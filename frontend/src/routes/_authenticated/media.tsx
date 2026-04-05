import { useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Plus, Upload } from "lucide-react"
import { api } from "../../lib/api"
import type { Media, MediaType } from "../../types/media"
import { AppHeader } from "../../components/layout/AppHeader"
import { Breadcrumbs } from "../../components/layout/Breadcrumbs"
import { MasonryGrid } from "../../components/media/MasonryGrid"
import { MediaCard } from "../../components/media/MediaCard"
import { MediaDetailModal } from "../../components/media/MediaDetailModal"
import {
  MediaFilterBar,
  type MediaFilterType,
  type MediaSortOption,
} from "../../components/media/MediaFilterBar"

export const Route = createFileRoute("/_authenticated/media")({
  component: MediaGalleryPage,
})

interface MediaApiResponse {
  id: string
  title: string | null
  description: string | null
  media_type: MediaType
  s3_key: string
  s3_bucket: string
  thumbnail_s3_key: string | null
  file_size_bytes: number | null
  mime_type: string | null
  width: number | null
  height: number | null
  duration_seconds: number | null
  date_taken: string | null
  date_taken_approx: boolean
  location_id: string | null
  uploaded_by: string
  status: string
  created_at: string
  updated_at: string
}

function toMedia(raw: MediaApiResponse): Media {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    mediaType: raw.media_type,
    url: `/media/${raw.s3_key}`,
    thumbnailUrl: raw.thumbnail_s3_key ? `/media/${raw.thumbnail_s3_key}` : null,
    fileSizeBytes: raw.file_size_bytes,
    mimeType: raw.mime_type,
    width: raw.width,
    height: raw.height,
    durationSeconds: raw.duration_seconds,
    dateTaken: raw.date_taken,
    dateTakenApprox: raw.date_taken_approx,
    locationId: raw.location_id,
    uploadedBy: raw.uploaded_by,
    createdAt: raw.created_at,
  }
}

const PAGE_SIZE = 50

function MediaGalleryPage() {
  const [activeFilter, setActiveFilter] = useState<MediaFilterType>("all")
  const [sortBy, setSortBy] = useState<MediaSortOption>("chronological")
  const [page, setPage] = useState(0)
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null)

  // Reset page when filter changes
  const handleFilterChange = (filter: MediaFilterType) => {
    setActiveFilter(filter)
    setPage(0)
  }

  // Build query params
  const queryParams = useMemo(() => {
    const params: Record<string, string> = {
      skip: String(page * PAGE_SIZE),
      limit: String(PAGE_SIZE),
    }
    if (activeFilter !== "all") {
      params.media_type = activeFilter
    }
    return params
  }, [activeFilter, page])

  // Fetch media
  const {
    data: rawMedia,
    isLoading,
    isError,
    error,
  } = useQuery<MediaApiResponse[]>({
    queryKey: ["media", queryParams],
    queryFn: async () => {
      const res = await api.get<MediaApiResponse[]>("/media", {
        params: queryParams,
      })
      return Array.isArray(res.data) ? res.data : []
    },
  })

  // Transform to camelCase Media type
  const mediaItems = useMemo(
    () => (rawMedia ?? []).map(toMedia),
    [rawMedia],
  )

  // Sort client-side
  const sortedMedia = useMemo(() => {
    const sorted = [...mediaItems]
    if (sortBy === "chronological") {
      sorted.sort((a, b) => {
        const dateA = a.dateTaken ?? ""
        const dateB = b.dateTaken ?? ""
        return dateB.localeCompare(dateA)
      })
    } else {
      // date_added
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    }
    return sorted
  }, [mediaItems, sortBy])

  // Fetch all media for counts (without type filter)
  const { data: allMediaRaw } = useQuery<MediaApiResponse[]>({
    queryKey: ["media", "all-counts"],
    queryFn: async () => {
      const res = await api.get<MediaApiResponse[]>("/media", {
        params: { skip: "0", limit: "1000" },
      })
      return Array.isArray(res.data) ? res.data : []
    },
  })

  // Compute counts per type
  const counts = useMemo(() => {
    const items = allMediaRaw ?? []
    return {
      all: items.length,
      photo: items.filter((m) => m.media_type === "photo").length,
      document: items.filter((m) => m.media_type === "document").length,
      video: items.filter((m) => m.media_type === "video").length,
      audio: items.filter((m) => m.media_type === "audio").length,
    }
  }, [allMediaRaw])

  const hasNextPage = (rawMedia?.length ?? 0) === PAGE_SIZE

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      {/* Header */}
      <AppHeader />

      {/* Main content */}
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumbs */}
          <div className="mb-6">
            <Breadcrumbs
              items={[{ label: "Family Archive", active: true }]}
            />
          </div>

          {/* Page header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-earth-900 dark:text-dark-text font-serif">
                Family Archive
              </h1>
              <p className="text-sage-400 dark:text-dark-text-muted mt-1">
                Photos, documents, videos, and recordings from our family
                history
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-earth-900 font-medium text-sm hover:bg-primary-dark hover:text-white transition-colors shadow-sm">
              <Plus className="h-4 w-4" />
              Upload New Media
            </button>
          </div>

          {/* Filter bar */}
          <div className="mb-6">
            <MediaFilterBar
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
              sortBy={sortBy}
              onSortChange={setSortBy}
              counts={counts}
            />
          </div>

          {/* Content area */}
          {isLoading ? (
            <SkeletonGrid />
          ) : isError ? (
            <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm px-6 py-8 text-center max-w-md mx-auto">
              <p className="text-red-600 dark:text-red-400 font-medium mb-1">
                Failed to load media
              </p>
              <p className="text-sage-400 dark:text-dark-text-muted text-sm">
                {error instanceof Error ? error.message : "Unknown error"}
              </p>
            </div>
          ) : sortedMedia.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <MasonryGrid>
                {sortedMedia.map((item) => (
                  <MediaCard key={item.id} media={item} onClick={setSelectedMedia} />
                ))}
              </MasonryGrid>

              {selectedMedia && (
                <MediaDetailModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />
              )}

              {/* Load More */}
              {hasNextPage && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="px-6 py-2.5 rounded-lg border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card text-earth-900 dark:text-dark-text font-medium text-sm hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors shadow-sm"
                  >
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

function SkeletonGrid() {
  // Generate varied skeleton heights for masonry effect
  const skeletonHeights = [200, 280, 180, 240, 200, 320, 180, 260, 200, 240, 280, 180]

  return (
    <MasonryGrid>
      {skeletonHeights.map((height, i) => (
        <div
          key={i}
          className="break-inside-avoid mb-4 rounded-xl overflow-hidden border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card animate-pulse"
          style={{ height }}
        >
          <div className="h-full bg-sage-100 dark:bg-dark-surface" />
        </div>
      ))}
    </MasonryGrid>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-full bg-sage-100 dark:bg-dark-surface flex items-center justify-center mb-4">
        <Upload className="h-8 w-8 text-sage-300 dark:text-dark-text-muted" />
      </div>
      <h3 className="text-lg font-semibold text-earth-900 dark:text-dark-text mb-1">
        No media yet
      </h3>
      <p className="text-sage-400 dark:text-dark-text-muted text-sm mb-6 text-center max-w-xs">
        Start building your family archive by uploading photos, documents,
        videos, and audio recordings.
      </p>
      <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-earth-900 font-medium text-sm hover:bg-primary-dark hover:text-white transition-colors shadow-sm">
        <Plus className="h-4 w-4" />
        Upload New Media
      </button>
    </div>
  )
}

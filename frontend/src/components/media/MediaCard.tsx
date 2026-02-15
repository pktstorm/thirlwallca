import { FileText, Play, Music } from "lucide-react"
import type { Media } from "../../types/media"

interface MediaCardProps {
  media: Media
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

function formatDate(dateStr: string | null, approx: boolean): string | null {
  if (!dateStr) return null
  try {
    const date = new Date(dateStr)
    const formatted = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    return approx ? `~${formatted}` : formatted
  } catch {
    return dateStr
  }
}

function PhotoCard({ media }: MediaCardProps) {
  const dateStr = formatDate(media.dateTaken, media.dateTakenApprox)

  return (
    <div className="break-inside-avoid mb-4 rounded-xl overflow-hidden border border-sage-200 dark:border-dark-border shadow-sm hover:shadow-md transition-shadow group cursor-pointer relative">
      <img
        src={media.url}
        alt={media.title ?? "Photo"}
        className="w-full block"
        loading="lazy"
      />
      {/* Overlay — always visible on touch, hover on desktop */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex flex-col justify-end p-4 transition-opacity duration-200 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        {media.title && (
          <h3 className="text-white font-semibold text-sm leading-tight">
            {media.title}
          </h3>
        )}
        {dateStr && (
          <p className="text-white/80 text-xs mt-1">{dateStr}</p>
        )}
      </div>
    </div>
  )
}

function DocumentCard({ media }: MediaCardProps) {
  const dateStr = formatDate(media.dateTaken, media.dateTakenApprox)

  return (
    <div className="break-inside-avoid mb-4 rounded-xl overflow-hidden border border-sage-200 dark:border-dark-border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="h-[200px] bg-parchment dark:bg-dark-card flex flex-col items-center justify-center p-4 relative">
        {/* Document type badge */}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-medium">
          <FileText className="h-3 w-3" />
          Document
        </span>
        <FileText className="h-12 w-12 text-earth-800/40 dark:text-dark-text-muted/40 mb-3" />
        {media.title && (
          <h3 className="text-earth-900 dark:text-dark-text font-semibold text-sm text-center leading-tight line-clamp-2">
            {media.title}
          </h3>
        )}
        {dateStr && (
          <p className="text-sage-400 dark:text-dark-text-muted text-xs mt-1.5">{dateStr}</p>
        )}
      </div>
    </div>
  )
}

function VideoCard({ media }: MediaCardProps) {
  return (
    <div className="break-inside-avoid mb-4 rounded-xl overflow-hidden border border-sage-200 dark:border-dark-border shadow-sm hover:shadow-md transition-shadow group cursor-pointer relative">
      {media.thumbnailUrl ? (
        <img
          src={media.thumbnailUrl}
          alt={media.title ?? "Video"}
          className="w-full block"
          loading="lazy"
        />
      ) : (
        <div className="w-full aspect-video bg-sage-100 dark:bg-dark-surface flex items-center justify-center">
          <Play className="h-8 w-8 text-sage-300 dark:text-dark-text-muted" />
        </div>
      )}
      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <Play className="h-6 w-6 text-earth-900 dark:text-dark-text ml-0.5" fill="currentColor" />
        </div>
      </div>
      {/* Duration badge */}
      {media.durationSeconds != null && (
        <span className="absolute bottom-3 right-3 inline-flex items-center px-2 py-1 rounded-md bg-red-600 text-white text-xs font-medium shadow-sm">
          {formatDuration(media.durationSeconds)}
        </span>
      )}
      {/* Title overlay at bottom */}
      {media.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-8">
          <h3 className="text-white font-semibold text-sm leading-tight">
            {media.title}
          </h3>
        </div>
      )}
    </div>
  )
}

function AudioCard({ media }: MediaCardProps) {
  const dateStr = formatDate(media.dateTaken, media.dateTakenApprox)

  return (
    <div className="break-inside-avoid mb-4 rounded-xl overflow-hidden border border-sage-200 dark:border-dark-border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="h-[200px] bg-sage-50 dark:bg-dark-surface flex flex-col items-center justify-center p-4 relative">
        {/* Audio type badge */}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sage-200 dark:bg-dark-card text-sage-800 dark:text-dark-text text-xs font-medium">
          <Music className="h-3 w-3" />
          Audio
        </span>
        {/* Waveform-like icon */}
        <div className="flex items-end gap-[3px] h-10 mb-3">
          {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.3, 0.7, 1, 0.4, 0.6].map(
            (scale, i) => (
              <div
                key={i}
                className="w-1.5 bg-primary/60 rounded-full"
                style={{ height: `${scale * 40}px` }}
              />
            ),
          )}
        </div>
        {media.title && (
          <h3 className="text-earth-900 dark:text-dark-text font-semibold text-sm text-center leading-tight line-clamp-2">
            {media.title}
          </h3>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          {dateStr && (
            <p className="text-sage-400 dark:text-dark-text-muted text-xs">{dateStr}</p>
          )}
          {media.durationSeconds != null && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sage-200 dark:bg-dark-card text-sage-800 dark:text-dark-text text-xs font-medium">
              {formatDuration(media.durationSeconds)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function MediaCard({ media }: MediaCardProps) {
  switch (media.mediaType) {
    case "photo":
      return <PhotoCard media={media} />
    case "document":
      return <DocumentCard media={media} />
    case "video":
      return <VideoCard media={media} />
    case "audio":
      return <AudioCard media={media} />
    default:
      return <PhotoCard media={media} />
  }
}

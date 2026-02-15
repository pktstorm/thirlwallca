import { useState, useEffect, useCallback, useRef } from "react"
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  FileText,
  Image,
  Video,
  Music,
  UserPlus,
  Calendar,
  MapPin,
} from "lucide-react"
import type { Media } from "../../types/media"
import type { PersonSummary } from "../../types/person"

interface TaggedPerson {
  personId: string
  label: string | null
  person: PersonSummary | null
}

interface MediaLightboxProps {
  media: Media | null
  allMedia: Media[]
  taggedPeople?: TaggedPerson[]
  onClose: () => void
  onNavigate?: (media: Media) => void
  onTagPerson?: (mediaId: string) => void
}

function getMediaIcon(mediaType: Media["mediaType"]) {
  switch (mediaType) {
    case "photo":
      return Image
    case "video":
      return Video
    case "audio":
      return Music
    case "document":
      return FileText
  }
}

function formatDate(dateStr: string | null, approx: boolean): string {
  if (!dateStr) return "Unknown"
  const date = new Date(dateStr + "T00:00:00")
  const formatted = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  return approx ? `c. ${formatted}` : formatted
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "Unknown"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function MediaLightbox({
  media,
  allMedia,
  taggedPeople = [],
  onClose,
  onNavigate,
  onTagPerson,
}: MediaLightboxProps) {
  const [isVisible, setIsVisible] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)

  // Fade in on mount / when media changes
  useEffect(() => {
    if (media) {
      // Trigger the fade-in on the next frame
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      setIsVisible(false)
    }
  }, [media])

  // Find current index for prev/next navigation
  const currentIndex = media
    ? allMedia.findIndex((m) => m.id === media.id)
    : -1
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < allMedia.length - 1 && currentIndex !== -1

  const navigatePrev = useCallback(() => {
    if (hasPrev && onNavigate) {
      const prevMedia = allMedia[currentIndex - 1]
      if (prevMedia) onNavigate(prevMedia)
    }
  }, [hasPrev, onNavigate, allMedia, currentIndex])

  const navigateNext = useCallback(() => {
    if (hasNext && onNavigate) {
      const nextMedia = allMedia[currentIndex + 1]
      if (nextMedia) onNavigate(nextMedia)
    }
  }, [hasNext, onNavigate, allMedia, currentIndex])

  // Keyboard navigation
  useEffect(() => {
    if (!media) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose()
          break
        case "ArrowLeft":
          e.preventDefault()
          navigatePrev()
          break
        case "ArrowRight":
          e.preventDefault()
          navigateNext()
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [media, onClose, navigatePrev, navigateNext])

  // Lock body scroll when open
  useEffect(() => {
    if (media) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = ""
      }
    }
  }, [media])

  // Handle backdrop click (close only when clicking the backdrop itself)
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onClose()
      }
    },
    [onClose]
  )

  const handleDownload = useCallback(() => {
    if (!media) return
    const link = document.createElement("a")
    link.href = media.url
    link.download = media.title ?? "download"
    link.target = "_blank"
    link.rel = "noopener noreferrer"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [media])

  if (!media) return null

  const MediaIcon = getMediaIcon(media.mediaType)

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-sage-800/90 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Content container */}
      <div className="relative flex flex-col lg:flex-row w-full h-full max-w-7xl max-h-[95vh] mx-4 my-4 lg:my-8 bg-white dark:bg-dark-card rounded-2xl shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-white/90 dark:bg-dark-surface/90 hover:bg-white dark:hover:bg-dark-surface border border-sage-200 dark:border-dark-border text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text transition-colors shadow-sm"
        >
          <X className="h-5 w-5" />
        </button>

        {/* ─── Left: Media Display ─── */}
        <div className="relative flex-1 flex items-center justify-center bg-earth-900 min-h-[40vh] lg:min-h-0">
          {/* Navigation arrows */}
          {hasPrev && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigatePrev()
              }}
              className="absolute left-3 z-10 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors backdrop-blur-sm"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {hasNext && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigateNext()
              }}
              className="absolute right-3 z-10 p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors backdrop-blur-sm"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Media content */}
          {media.mediaType === "photo" ? (
            <img
              src={media.url}
              alt={media.title ?? "Media"}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
          ) : media.mediaType === "video" ? (
            <div className="flex flex-col items-center gap-4 p-8">
              <div className="w-24 h-24 rounded-2xl bg-sage-800 flex items-center justify-center">
                <Video className="h-12 w-12 text-sage-300" />
              </div>
              <p className="text-sm text-sage-300 text-center">
                Video preview
              </p>
            </div>
          ) : media.mediaType === "audio" ? (
            <div className="flex flex-col items-center gap-4 p-8">
              <div className="w-24 h-24 rounded-2xl bg-sage-800 flex items-center justify-center">
                <Music className="h-12 w-12 text-sage-300" />
              </div>
              <p className="text-sm text-sage-300 text-center">
                Audio file
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 p-8">
              <div className="w-24 h-24 rounded-2xl bg-parchment dark:bg-dark-surface flex items-center justify-center">
                <FileText className="h-12 w-12 text-earth-800 dark:text-dark-text" />
              </div>
              <p className="text-sm text-sage-300 text-center">
                Document
              </p>
            </div>
          )}

          {/* Image counter pill */}
          {allMedia.length > 1 && currentIndex !== -1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs font-medium px-3 py-1.5 rounded-full backdrop-blur-sm">
              {currentIndex + 1} / {allMedia.length}
            </div>
          )}
        </div>

        {/* ─── Right: Info Sidebar ─── */}
        <div className="lg:w-[380px] flex-shrink-0 flex flex-col border-t lg:border-t-0 lg:border-l border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card">
          {/* Header with action buttons */}
          <div className="flex items-center justify-between px-6 pt-6 pb-3">
            <div className="flex items-center gap-2">
              <MediaIcon className="h-4 w-4 text-sage-400 dark:text-dark-text-muted" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-sage-400 dark:text-dark-text-muted">
                {media.mediaType}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="p-2 rounded-lg hover:bg-sage-100 dark:hover:bg-dark-surface text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text transition-colors"
                title="Edit"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={handleDownload}
                className="p-2 rounded-lg hover:bg-sage-100 dark:hover:bg-dark-surface text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text transition-colors"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Scrollable info */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5 [scrollbar-width:thin] [scrollbar-color:var(--color-sage-300)_transparent]">
            {/* Title & Description */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-earth-900 dark:text-dark-text leading-tight">
                {media.title ?? "Untitled"}
              </h2>
              {media.description && (
                <p className="text-sm text-sage-400 dark:text-dark-text-muted leading-relaxed">
                  {media.description}
                </p>
              )}
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Date Taken */}
              <div className="bg-sage-50 dark:bg-dark-surface rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-sage-400 dark:text-dark-text-muted">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Date Taken
                  </span>
                </div>
                <p className="text-sm font-medium text-earth-900 dark:text-dark-text">
                  {formatDate(media.dateTaken, media.dateTakenApprox)}
                </p>
              </div>

              {/* Location */}
              <div className="bg-sage-50 dark:bg-dark-surface rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-sage-400 dark:text-dark-text-muted">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Location
                  </span>
                </div>
                <p className="text-sm font-medium text-earth-900 dark:text-dark-text">
                  {media.locationId ? "View location" : "Unknown"}
                </p>
              </div>
            </div>

            {/* File info */}
            <div className="bg-sage-50 dark:bg-dark-surface rounded-xl p-3 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-sage-400 dark:text-dark-text-muted">
                File Details
              </span>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-sage-400 dark:text-dark-text-muted">
                {media.mimeType && <span>{media.mimeType}</span>}
                <span>{formatFileSize(media.fileSizeBytes)}</span>
                {media.width != null && media.height != null && (
                  <span>
                    {media.width} x {media.height}
                  </span>
                )}
                {media.durationSeconds != null && (
                  <span>{media.durationSeconds}s</span>
                )}
              </div>
            </div>

            {/* Tagged People */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-sage-600 dark:text-dark-text-muted">
                Tagged People
              </h3>

              {taggedPeople.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {taggedPeople.map((tag) => (
                    <div
                      key={tag.personId}
                      className="flex items-center gap-2 bg-white dark:bg-dark-surface border border-sage-200 dark:border-dark-border rounded-full pl-1 pr-3 py-1"
                    >
                      {tag.person?.profilePhotoUrl ? (
                        <img
                          src={tag.person.profilePhotoUrl}
                          alt={`${tag.person.firstName} ${tag.person.lastName}`}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-sage-100 dark:bg-dark-surface flex items-center justify-center">
                          <span className="text-[10px] font-bold text-sage-400 dark:text-dark-text-muted">
                            {tag.person
                              ? getInitials(
                                  tag.person.firstName,
                                  tag.person.lastName
                                )
                              : "?"}
                          </span>
                        </div>
                      )}
                      <span className="text-xs font-medium text-earth-900 dark:text-dark-text">
                        {tag.label ??
                          (tag.person
                            ? `${tag.person.firstName} ${tag.person.lastName}`
                            : "Unknown")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-sage-300 dark:text-dark-text-muted">No people tagged</p>
              )}

              {onTagPerson && (
                <button
                  onClick={() => onTagPerson(media.id)}
                  className="flex items-center gap-1.5 text-xs font-medium text-sage-400 dark:text-dark-text-muted hover:text-primary-dark transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Tag Another Person
                </button>
              )}
            </div>

            {/* Upload info */}
            <div className="pt-3 border-t border-sage-100 dark:border-dark-border">
              <p className="text-xs text-sage-300 dark:text-dark-text-muted">
                Added{" "}
                {new Date(media.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

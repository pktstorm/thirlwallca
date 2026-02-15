import { Clock, Calendar } from "lucide-react"

// ── API response type (snake_case) ──

export interface TimelineEventApiResponse {
  id: string
  person_id: string
  title: string
  description: string | null
  event_date: string | null
  event_date_approx: string | null
  event_type: string
  icon: string | null
  media_id: string | null
  audio_s3_key: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface TimelineEvent {
  id: string
  personId: string
  title: string
  description: string | null
  eventDate: string | null
  eventDateApprox: string | null
  eventType: string
  icon: string | null
  mediaId: string | null
  audioS3Key: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export function mapApiTimelineEvent(data: TimelineEventApiResponse): TimelineEvent {
  return {
    id: data.id,
    personId: data.person_id,
    title: data.title,
    description: data.description,
    eventDate: data.event_date,
    eventDateApprox: data.event_date_approx,
    eventType: data.event_type,
    icon: data.icon,
    mediaId: data.media_id,
    audioS3Key: data.audio_s3_key,
    sortOrder: data.sort_order,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

// ── Helpers ──

function formatEventDate(date: string | null, approx: string | null): string {
  if (approx) return approx
  if (!date) return ""
  const d = new Date(date + "T00:00:00")
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function extractYear(date: string | null): string | null {
  if (!date) return null
  return date.split("-")[0] ?? null
}

// ── Props ──

interface TimelineSectionProps {
  events: TimelineEvent[]
  isLoading: boolean
}

export function TimelineSection({ events, isLoading }: TimelineSectionProps) {
  if (isLoading) {
    return (
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-600 dark:text-dark-text-muted">
          <Clock className="h-4 w-4" />
          Life Timeline
        </h3>
        <div className="flex flex-col items-center py-10">
          <div className="w-8 h-8 border-2 border-primary dark:border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sage-300 dark:text-dark-text-muted text-xs mt-3">Loading timeline...</p>
        </div>
      </section>
    )
  }

  if (events.length === 0) {
    return (
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-600 dark:text-dark-text-muted">
          <Clock className="h-4 w-4" />
          Life Timeline
        </h3>
        <div className="parchment-card rounded-xl p-8 text-center">
          <Clock className="h-10 w-10 text-sage-300 dark:text-dark-text-muted mx-auto mb-3" />
          <p className="text-sage-400 dark:text-dark-text-muted text-sm font-medium">
            No timeline events recorded yet
          </p>
          <p className="text-sage-300 dark:text-dark-text-muted text-xs mt-1">
            Life events will appear here as they are added.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-600 dark:text-dark-text-muted">
        <Clock className="h-4 w-4" />
        Life Timeline
      </h3>

      <div className="relative">
        {/* Vertical center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 bg-primary/30 dark:bg-primary/20" />

        <div className="space-y-8">
          {events.map((event, index) => {
            const isLeft = index % 2 === 0
            const dateDisplay = formatEventDate(event.eventDate, event.eventDateApprox)
            const year = extractYear(event.eventDate)

            return (
              <div key={event.id} className="relative flex items-start">
                {/* Center dot */}
                <div className="absolute left-1/2 top-4 -translate-x-1/2 z-10">
                  <div className="w-4 h-4 rounded-full bg-primary dark:bg-primary border-[3px] border-parchment dark:border-dark-surface shadow-sm" />
                </div>

                {/* Left side content */}
                <div className={`w-[calc(50%-1.5rem)] ${isLeft ? "" : "opacity-0 pointer-events-none"}`}>
                  {isLeft && (
                    <div className="parchment-card rounded-xl p-4 mr-4 shadow-sm">
                      {/* Date badge */}
                      {dateDisplay && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <Calendar className="h-3 w-3 text-primary-dark dark:text-primary" />
                          <span className="text-xs font-semibold text-primary-dark dark:text-primary">
                            {dateDisplay}
                          </span>
                        </div>
                      )}
                      <h4 className="font-serif text-base font-semibold text-earth-900 dark:text-dark-text leading-snug">
                        {event.title}
                      </h4>
                      {event.description && (
                        <p className="text-sm text-earth-800/80 dark:text-dark-text-muted leading-relaxed mt-1.5">
                          {event.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Spacer for the center line */}
                <div className="w-12 flex-shrink-0" />

                {/* Right side content */}
                <div className={`w-[calc(50%-1.5rem)] ${!isLeft ? "" : "opacity-0 pointer-events-none"}`}>
                  {!isLeft && (
                    <div className="parchment-card rounded-xl p-4 ml-4 shadow-sm">
                      {/* Date badge */}
                      {dateDisplay && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <Calendar className="h-3 w-3 text-primary-dark dark:text-primary" />
                          <span className="text-xs font-semibold text-primary-dark dark:text-primary">
                            {dateDisplay}
                          </span>
                        </div>
                      )}
                      <h4 className="font-serif text-base font-semibold text-earth-900 dark:text-dark-text leading-snug">
                        {event.title}
                      </h4>
                      {event.description && (
                        <p className="text-sm text-earth-800/80 dark:text-dark-text-muted leading-relaxed mt-1.5">
                          {event.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Year label on opposite side */}
                {year && (
                  <div
                    className={`absolute top-3.5 text-xs font-bold text-sage-300 dark:text-dark-text-muted ${
                      isLeft
                        ? "right-[calc(50%-1.5rem)] mr-4 hidden sm:block text-right"
                        : "left-[calc(50%-1.5rem)] ml-4 hidden sm:block text-left"
                    }`}
                    style={{ width: "4rem" }}
                  >
                    {/* Only show year if different from previous */}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

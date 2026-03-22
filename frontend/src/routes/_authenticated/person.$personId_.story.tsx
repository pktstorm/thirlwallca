import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { BookOpen, TreePine } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { useAuthStore } from "../../stores/authStore"
import { StoryHero } from "../../components/story/StoryHero"
import {
  TimelineSection,
  mapApiTimelineEvent,
} from "../../components/story/TimelineSection"
import { DiscussionPanel } from "../../components/story/DiscussionPanel"
import type { Person } from "../../types/person"
import type { Story } from "../../types/story"
import type { TimelineEventApiResponse } from "../../components/story/TimelineSection"

export const Route = createFileRoute(
  "/_authenticated/person/$personId_/story",
)({
  component: StoryPage,
})

// ── API response types (snake_case) ──

interface LocationSummaryApi {
  id: string
  city: string
  region: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
}

interface PersonApiResponse {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  maiden_name: string | null
  suffix: string | null
  gender: "male" | "female" | "other" | "unknown"
  birth_date: string | null
  birth_date_approx: boolean
  death_date: string | null
  death_date_approx: boolean
  is_living: boolean
  bio: string | null
  occupation: string | null
  profile_photo_url: string | null
  nicknames: string | null
  birth_place_text: string | null
  death_place_text: string | null
  birth_location: LocationSummaryApi | null
  death_location: LocationSummaryApi | null
  cause_of_death: string | null
  ethnicity: string | null
  religion: string | null
  education: string | null
  military_service: string | null
  burial_location: string | null
  notes: string | null
  birth_notes: string | null
  created_at: string
  updated_at: string
}

interface StoryApiResponse {
  id: string
  title: string
  subtitle: string | null
  content: unknown
  cover_image_url: string | null
  author_id: string
  published: boolean
  created_at: string
  updated_at: string
}

// ── Mappers ──

function mapApiPerson(data: PersonApiResponse): Person {
  return {
    id: data.id,
    firstName: data.first_name,
    middleName: data.middle_name,
    lastName: data.last_name,
    maidenName: data.maiden_name,
    suffix: data.suffix,
    gender: data.gender,
    birthDate: data.birth_date,
    birthDateApprox: data.birth_date_approx,
    deathDate: data.death_date,
    deathDateApprox: data.death_date_approx,
    isLiving: data.is_living,
    bio: data.bio,
    occupation: data.occupation,
    profilePhotoUrl: data.profile_photo_url,
    birthLocationId: null,
    deathLocationId: null,
    nicknames: data.nicknames ?? null,
    birthPlaceText: data.birth_place_text ?? null,
    deathPlaceText: data.death_place_text ?? null,
    birthLocation: data.birth_location ?? null,
    deathLocation: data.death_location ?? null,
    causeOfDeath: data.cause_of_death ?? null,
    ethnicity: data.ethnicity ?? null,
    religion: data.religion ?? null,
    education: data.education ?? null,
    militaryService: data.military_service ?? null,
    burialLocation: data.burial_location ?? null,
    notes: data.notes ?? null,
    birthNotes: data.birth_notes ?? null,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

function mapApiStory(data: StoryApiResponse): Story {
  return {
    id: data.id,
    title: data.title,
    subtitle: data.subtitle,
    content: data.content,
    coverImageUrl: data.cover_image_url,
    authorId: data.author_id,
    published: data.published,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

// ── Content renderer ──

function renderStoryContent(content: unknown): React.ReactNode {
  // Handle null/undefined
  if (!content) return null

  // Handle plain string
  if (typeof content === "string") {
    return content.split("\n").map((para, i) => (
      <p key={i} className="text-base text-earth-800 dark:text-dark-text leading-relaxed">
        {para}
      </p>
    ))
  }

  // Handle Plate.js-style JSON (array of blocks)
  if (Array.isArray(content)) {
    return content.map((block: Record<string, unknown>, i: number) => {
      const blockType = (block.type as string) ?? "paragraph"
      const children = block.children as Array<Record<string, unknown>> | undefined

      // Extract text from children
      const text = children
        ?.map((child) => child.text as string)
        .filter(Boolean)
        .join("")

      if (!text) return null

      switch (blockType) {
        case "h1":
          return (
            <h2
              key={i}
              className="font-serif text-2xl font-bold text-earth-900 dark:text-dark-text mt-6 mb-2"
            >
              {text}
            </h2>
          )
        case "h2":
          return (
            <h3
              key={i}
              className="font-serif text-xl font-semibold text-earth-900 dark:text-dark-text mt-5 mb-2"
            >
              {text}
            </h3>
          )
        case "h3":
          return (
            <h4
              key={i}
              className="font-serif text-lg font-semibold text-earth-900 dark:text-dark-text mt-4 mb-1"
            >
              {text}
            </h4>
          )
        case "blockquote":
          return (
            <blockquote
              key={i}
              className="border-l-4 border-primary/40 pl-4 italic text-earth-800/80 dark:text-dark-text-muted my-4"
            >
              {text}
            </blockquote>
          )
        default:
          return (
            <p key={i} className="text-base text-earth-800 dark:text-dark-text leading-relaxed">
              {text}
            </p>
          )
      }
    })
  }

  // Handle object with text property
  if (typeof content === "object" && content !== null) {
    const contentObj = content as Record<string, unknown>
    if (typeof contentObj.text === "string") {
      return (
        <p className="text-base text-earth-800 dark:text-dark-text leading-relaxed">
          {contentObj.text}
        </p>
      )
    }
  }

  return null
}

// ── Main Page ──

function StoryPage() {
  const { personId } = Route.useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const canEdit = user?.role === "admin" || user?.role === "editor"

  // ── Fetch person ──
  const {
    data: person,
    isLoading: personLoading,
    isError: personError,
    error: personErrorObj,
  } = useQuery({
    queryKey: ["person", personId],
    queryFn: async () => {
      const res = await api.get<PersonApiResponse>(`/persons/${personId}`)
      return mapApiPerson(res.data)
    },
  })

  // ── Fetch first published story for this person ──
  const {
    data: story,
    isLoading: storyLoading,
  } = useQuery({
    queryKey: ["stories", personId, "published"],
    queryFn: async () => {
      const res = await api.get<StoryApiResponse[]>("/stories", {
        params: { person_id: personId, published: true },
      })
      const first = res.data[0]
      return first ? mapApiStory(first) : null
    },
    enabled: !!person,
  })

  // ── Fetch timeline events ──
  const {
    data: timelineEvents = [],
    isLoading: timelineLoading,
  } = useQuery({
    queryKey: ["timeline-events", personId],
    queryFn: async () => {
      const res = await api.get<TimelineEventApiResponse[]>("/timeline-events", {
        params: { person_id: personId },
      })
      return res.data.map(mapApiTimelineEvent)
    },
    enabled: !!person,
  })

  // ── Loading state ──
  if (personLoading) {
    return (
      <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
        <AppHeader />
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sage-400 dark:text-dark-text-muted text-sm">Loading life story...</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (personError || !person) {
    return (
      <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
        <AppHeader />
        <div className="flex items-center justify-center h-screen">
          <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm px-8 py-6 max-w-md text-center space-y-3">
            <p className="text-red-600 font-semibold text-lg">
              Could not load life story
            </p>
            <p className="text-sage-400 dark:text-dark-text-muted text-sm">
              {personErrorObj instanceof Error
                ? personErrorObj.message
                : "The person you are looking for could not be found."}
            </p>
            <button
              onClick={() => navigate({ to: "/tree" })}
              className="mt-2 inline-flex items-center gap-2 bg-primary text-earth-900 font-bold text-sm uppercase tracking-wider px-5 py-2.5 rounded-lg hover:bg-primary-dark hover:text-white transition-colors"
            >
              <TreePine className="h-4 w-4" />
              Back to Tree
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Story loading state ──
  const isContentLoading = storyLoading

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      {/* Hero */}
      <StoryHero
        person={person}
        storyTitle={story?.title ?? null}
        storySubtitle={story?.subtitle ?? null}
        canEdit={canEdit}
      />

      {/* Main content area */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* ── Left column: Story + Timeline (~65%) ── */}
          <div className="flex-1 lg:w-[65%] space-y-10">
            {/* Story content */}
            <section className="space-y-4">
              {isContentLoading && (
                <div className="flex flex-col items-center py-10">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sage-300 dark:text-dark-text-muted text-xs mt-3">Loading story...</p>
                </div>
              )}

              {!isContentLoading && !story && (
                <div className="parchment-card rounded-xl p-8 text-center">
                  <BookOpen className="h-10 w-10 text-sage-300 dark:text-dark-text-muted mx-auto mb-3" />
                  <p className="text-sage-400 dark:text-dark-text-muted text-sm font-medium">
                    No published story yet
                  </p>
                  <p className="text-sage-300 dark:text-dark-text-muted text-xs mt-1">
                    {canEdit
                      ? "Click \"Edit Story\" to begin writing this person's life story."
                      : "A life story has not been written for this person yet."}
                  </p>
                </div>
              )}

              {!isContentLoading && story && (
                <div className="parchment-card rounded-xl p-6 sm:p-8 shadow-sm">
                  {/* Story title (if not shown in hero for some reason) */}
                  {story.title && (
                    <h2 className="font-serif text-3xl font-bold text-earth-900 dark:text-dark-text mb-2">
                      {story.title}
                    </h2>
                  )}
                  {story.subtitle && (
                    <p className="text-sage-400 dark:text-dark-text-muted text-sm italic mb-6">
                      {story.subtitle}
                    </p>
                  )}
                  <div className="space-y-4 font-serif">
                    {renderStoryContent(story.content)}
                  </div>
                </div>
              )}
            </section>

            {/* Timeline */}
            <TimelineSection events={timelineEvents} isLoading={timelineLoading} />
          </div>

          {/* ── Right column: Discussion panel (~35%) ── */}
          <div className="lg:w-[35%] flex-shrink-0">
            <div className="lg:sticky lg:top-6">
              <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl shadow-sm overflow-hidden max-h-[calc(100vh-3rem)]">
                {story ? (
                  <DiscussionPanel storyId={story.id} personId={personId} />
                ) : (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sage-300 dark:text-dark-text-muted text-sm">
                      Discussion will be available once a story is published.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

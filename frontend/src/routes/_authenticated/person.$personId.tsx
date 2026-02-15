import { useState, useRef } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  MapPin,
  Calendar,
  BookOpen,
  Image,
  Clock,
  Users,
  TreePine,
  Edit,
  Heart,
  User,
  ChevronRight,
  ArrowRight,
  GraduationCap,
  Shield,
  Church,
  Globe,
  StickyNote,
  Cross,
  Home,
  UserCheck,
  UserPlus,
  GitBranch,
  Camera,
  Loader2,
} from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { Breadcrumbs } from "../../components/layout/Breadcrumbs"
import { useAuthStore } from "../../stores/authStore"
import type { Person } from "../../types/person"
import type { Relationship } from "../../types/relationship"
import { EditPersonModal } from "../../components/person/EditPersonModal"

export const Route = createFileRoute("/_authenticated/person/$personId")({
  component: PersonProfilePage,
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

interface RelationshipApiResponse {
  id: string
  person_id: string
  related_person_id: string
  relationship: "parent_child" | "spouse"
  marriage_date: string | null
  divorce_date: string | null
  notes: string | null
}

interface ResidenceLocationApi {
  id: string
  city: string
  region: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
}

interface ResidenceApiResponse {
  id: string
  person_id: string
  location_id: string | null
  place_text: string | null
  location: ResidenceLocationApi | null
  from_date: string | null
  to_date: string | null
  is_current: boolean
  notes: string | null
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
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

function mapApiRelationship(data: RelationshipApiResponse): Relationship {
  return {
    id: data.id,
    personId: data.person_id,
    relatedPersonId: data.related_person_id,
    relationship: data.relationship,
    marriageDate: data.marriage_date,
    divorceDate: data.divorce_date,
    notes: data.notes,
  }
}

// ── Helpers ──

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function getInitialsBgColor(gender: Person["gender"]): string {
  switch (gender) {
    case "male":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
    case "female":
      return "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400"
    default:
      return "bg-sage-100 dark:bg-dark-surface text-sage-600 dark:text-dark-text-muted"
  }
}

function extractYear(dateStr: string | null): string | null {
  if (!dateStr) return null
  return dateStr.split("-")[0] ?? null
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

function buildFullName(person: Person): string {
  return [person.firstName, person.middleName, person.lastName, person.suffix]
    .filter(Boolean)
    .join(" ")
}

// ── Image resize utility ──

function resizeImage(file: File, maxSize = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement("canvas")
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width)
          width = maxSize
        } else {
          width = Math.round((width * maxSize) / height)
          height = maxSize
        }
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error("Failed to resize image"))
        },
        "image/jpeg",
        0.85,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to load image"))
    }
    img.src = url
  })
}

// ── Grouped relationships ──

interface GroupedRelationships {
  parents: { relationship: Relationship; person: Person }[]
  spouses: { relationship: Relationship; person: Person }[]
  children: { relationship: Relationship; person: Person }[]
}

function groupRelationships(
  personId: string,
  relationships: Relationship[],
  relatedPersons: Map<string, Person>,
): GroupedRelationships {
  const groups: GroupedRelationships = {
    parents: [],
    spouses: [],
    children: [],
  }

  for (const rel of relationships) {
    // Determine who the "other" person is
    const otherId =
      rel.personId === personId ? rel.relatedPersonId : rel.personId
    const otherPerson = relatedPersons.get(otherId)
    if (!otherPerson) continue

    if (rel.relationship === "spouse") {
      groups.spouses.push({ relationship: rel, person: otherPerson })
    } else if (rel.relationship === "parent_child") {
      // In parent_child: personId is the child, relatedPersonId is the parent
      if (rel.personId === personId) {
        // Current person is the child, other is the parent
        groups.parents.push({ relationship: rel, person: otherPerson })
      } else {
        // Current person is the parent, other is the child
        groups.children.push({ relationship: rel, person: otherPerson })
      }
    }
  }

  return groups
}

// ── Components ──

function PersonMiniCard({ person }: { person: Person }) {
  const birthYear = extractYear(person.birthDate)
  const deathYear = extractYear(person.deathDate)

  return (
    <Link
      to="/person/$personId"
      params={{ personId: person.id }}
      className="flex items-center gap-3 bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-3 hover:bg-white dark:hover:bg-dark-card hover:border-primary/40 hover:shadow-md transition-all group"
    >
      {/* Mini avatar */}
      {person.profilePhotoUrl ? (
        <img
          src={person.profilePhotoUrl}
          alt={buildFullName(person)}
          className="w-10 h-10 rounded-full object-cover border-2 border-sage-200 dark:border-dark-border group-hover:border-primary flex-shrink-0 transition-colors"
        />
      ) : (
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold border-2 border-sage-200 dark:border-dark-border group-hover:border-primary transition-colors ${getInitialsBgColor(person.gender)}`}
        >
          {getInitials(person.firstName, person.lastName)}
        </div>
      )}

      {/* Name + dates */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-earth-900 dark:text-dark-text truncate group-hover:text-primary-dark transition-colors">
          {buildFullName(person)}
        </p>
        {(birthYear || deathYear) && (
          <p className="text-xs text-sage-400 dark:text-dark-text-muted">
            {person.birthDateApprox && "c. "}
            {birthYear ?? "?"}
            {" \u2013 "}
            {person.isLiving
              ? "Present"
              : `${person.deathDateApprox ? "c. " : ""}${deathYear ?? "?"}`}
          </p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 text-sage-300 dark:text-dark-text-muted group-hover:text-primary flex-shrink-0 transition-colors" />
    </Link>
  )
}

function RelationshipGroup({
  title,
  icon,
  items,
}: {
  title: string
  icon: React.ReactNode
  items: { relationship: Relationship; person: Person }[]
}) {
  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-400 dark:text-dark-text-muted">
        {icon}
        {title}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map(({ person }) => (
          <PersonMiniCard key={person.id} person={person} />
        ))}
      </div>
    </div>
  )
}

// ── Main Page ──

function PersonProfilePage() {
  const { personId } = Route.useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const canEdit = user?.role === "admin" || user?.role === "editor"
  const [editOpen, setEditOpen] = useState(false)
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoProgress, setPhotoProgress] = useState(0)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const setLinkedPersonId = useAuthStore((s) => s.setLinkedPersonId)

  // Fetch person
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

  // Fetch relationships for this person
  const { data: relationships } = useQuery({
    queryKey: ["relationships", personId],
    queryFn: async () => {
      const res = await api.get<RelationshipApiResponse[]>("/relationships", {
        params: { person_id: personId },
      })
      return res.data.map(mapApiRelationship)
    },
    enabled: !!person,
  })

  // Fetch media for this person
  const { data: mediaItems } = useQuery<
    { id: string; s3_key: string; title: string | null; media_type: string }[]
  >({
    queryKey: ["person-media", personId],
    queryFn: async () => {
      const res = await api.get("/media", {
        params: { person_id: personId, limit: 20 },
      })
      return res.data
    },
    enabled: !!person,
  })

  // Fetch published story for this person
  const { data: story, isLoading: storyLoading } = useQuery({
    queryKey: ["stories", personId, "published"],
    queryFn: async () => {
      const res = await api.get<StoryApiResponse[]>("/stories", {
        params: { person_id: personId, published: true },
      })
      const first = res.data[0]
      return first ?? null
    },
    enabled: !!person,
  })

  // Fetch residences
  const { data: residences } = useQuery<ResidenceApiResponse[]>({
    queryKey: ["residences", personId],
    queryFn: async () => {
      const res = await api.get(`/persons/${personId}/residences`)
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: !!person,
  })

  const linkMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put("/auth/me/linked-person", { person_id: personId })
      return res.data
    },
    onSuccess: (data: { linked_person_id: string | null }) => {
      setLinkedPersonId(data.linked_person_id)
      queryClient.invalidateQueries({ queryKey: ["tree"] })
    },
  })

  const { data: relationshipPath } = useQuery<{
    path: { person_id: string; person_name: string; relationship: string; direction: string }[]
    label: string
    description: string
    found: boolean
  }>({
    queryKey: ["relationship-path", user?.linkedPersonId, personId],
    queryFn: async () => {
      const res = await api.get(`/tree/relationship/${user!.linkedPersonId}/to/${personId}`)
      return res.data
    },
    enabled: !!user?.linkedPersonId && user.linkedPersonId !== personId,
  })

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete("/auth/me/linked-person")
      return res.data
    },
    onSuccess: () => {
      setLinkedPersonId(null)
      setShowUnlinkConfirm(false)
      queryClient.invalidateQueries({ queryKey: ["tree"] })
    },
  })

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-selected
    e.target.value = ""

    setPhotoUploading(true)
    setPhotoProgress(0)

    try {
      // 1. Resize client-side
      const resizedBlob = await resizeImage(file)

      // 2. Get presigned upload URL
      const { data: uploadData } = await api.post(
        `/persons/${personId}/profile-photo/upload-url`,
        { filename: file.name, content_type: "image/jpeg" },
      )

      // 3. Upload to S3 with progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", uploadData.upload_url)
        xhr.setRequestHeader("Content-Type", "image/jpeg")
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setPhotoProgress(Math.round((ev.loaded / ev.total) * 100))
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`Upload failed: ${xhr.status}`))
        }
        xhr.onerror = () => reject(new Error("Upload failed"))
        xhr.send(resizedBlob)
      })

      // 4. Confirm upload
      await api.post(`/persons/${personId}/profile-photo/confirm`, {
        s3_key: uploadData.s3_key,
        s3_bucket: "thirlwall-media",
        file_size_bytes: resizedBlob.size,
        mime_type: "image/jpeg",
      })

      // 5. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["person", personId] })
      queryClient.invalidateQueries({ queryKey: ["tree"] })
    } catch (err) {
      console.error("Profile photo upload failed:", err)
    } finally {
      setPhotoUploading(false)
      setPhotoProgress(0)
    }
  }

  // Sort residences: current first, then by from_date descending
  const sortedResidences = residences
    ? [...residences].sort((a, b) => {
        if (a.is_current !== b.is_current) return a.is_current ? -1 : 1
        const aDate = a.from_date ?? ""
        const bDate = b.from_date ?? ""
        return bDate.localeCompare(aDate)
      })
    : []

  // Collect all related person IDs and fetch them
  const relatedPersonIds = relationships
    ? [
        ...new Set(
          relationships.flatMap((r) => [r.personId, r.relatedPersonId]),
        ),
      ].filter((id) => id !== personId)
    : []

  const { data: relatedPersons } = useQuery({
    queryKey: ["relatedPersons", personId, relatedPersonIds],
    queryFn: async () => {
      const results = await Promise.all(
        relatedPersonIds.map(async (id) => {
          const res = await api.get<PersonApiResponse>(`/persons/${id}`)
          return mapApiPerson(res.data)
        }),
      )
      const map = new Map<string, Person>()
      for (const p of results) {
        map.set(p.id, p)
      }
      return map
    },
    enabled: relatedPersonIds.length > 0,
  })

  // Group relationships
  const grouped =
    relationships && relatedPersons
      ? groupRelationships(personId, relationships, relatedPersons)
      : null

  // Derived values
  const fullName = person ? buildFullName(person) : ""
  const birthYear = person ? extractYear(person.birthDate) : null
  const deathYear = person ? extractYear(person.deathDate) : null

  // ── Loading ──
  if (personLoading) {
    return (
      <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
        <AppHeader />
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sage-400 dark:text-dark-text-muted text-sm">Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Error ──
  if (personError || !person) {
    return (
      <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
        <AppHeader />
        <div className="flex items-center justify-center h-screen">
          <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm px-8 py-6 max-w-md text-center space-y-3">
            <p className="text-red-600 font-semibold text-lg">
              Could not load profile
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

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      {/* ── Hero Section ── */}
      <div className="relative bg-gradient-to-br from-bg-dark via-primary-darker to-bg-dark overflow-hidden">
        {/* Subtle texture overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, rgba(48,232,110,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(48,232,110,0.15) 0%, transparent 40%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Header floats on top */}
        <AppHeader />

        {/* Hero content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 pt-20 pb-8 sm:px-6 sm:pt-24 sm:pb-12">
          {/* Breadcrumbs */}
          <div className="mb-8">
            <Breadcrumbs
              items={[
                {
                  label: "Family Tree",
                  onClick: () => navigate({ to: "/tree" }),
                },
                { label: fullName, active: true },
              ]}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6">
            {/* Profile photo */}
            <div className="flex-shrink-0">
              <div
                className={`relative ring-4 ring-primary rounded-full shadow-glow ${canEdit && !photoUploading ? "cursor-pointer group" : ""}`}
                onClick={() => {
                  if (canEdit && !photoUploading) photoInputRef.current?.click()
                }}
              >
                {person.profilePhotoUrl ? (
                  <img
                    src={person.profilePhotoUrl}
                    alt={fullName}
                    className="w-28 h-28 sm:w-40 sm:h-40 rounded-full object-cover border-4 border-bg-dark"
                  />
                ) : (
                  <div
                    className={`w-28 h-28 sm:w-40 sm:h-40 rounded-full border-4 border-bg-dark flex items-center justify-center ${getInitialsBgColor(person.gender)}`}
                  >
                    <span className="text-5xl font-bold">
                      {getInitials(person.firstName, person.lastName)}
                    </span>
                  </div>
                )}
                {/* Upload overlay */}
                {canEdit && !photoUploading && (
                  <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <Camera className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
                {/* Upload progress overlay */}
                {photoUploading && (
                  <div className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center">
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                    <span className="text-white text-xs font-bold mt-1">
                      {photoProgress}%
                    </span>
                  </div>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoSelected}
              />
            </div>

            {/* Name + key info */}
            <div className="flex-1 text-center sm:text-left pb-2">
              <h1 className="text-2xl sm:text-4xl font-bold text-white leading-tight">
                {fullName}
              </h1>

              {person.maidenName && (
                <p className="text-sage-300 text-lg mt-1">
                  n&eacute;e {person.maidenName}
                </p>
              )}

              {/* Date range pill */}
              {(birthYear || deathYear) && (
                <div className="mt-3 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-white/90 text-sm font-medium">
                    {person.birthDateApprox && "c. "}
                    {birthYear ?? "?"}
                    {" \u2013 "}
                    {person.isLiving
                      ? "Present"
                      : `${person.deathDateApprox ? "c. " : ""}${deathYear ?? "?"}`}
                  </span>
                </div>
              )}

              {person.occupation && (
                <p className="text-sage-300 text-sm mt-2 uppercase tracking-wider font-medium">
                  {person.occupation}
                </p>
              )}

              {relationshipPath?.found && relationshipPath.label !== "self" && (
                <div className="mt-2 inline-flex items-center gap-2 bg-primary/20 backdrop-blur-sm px-4 py-1.5 rounded-full border border-primary/30">
                  <GitBranch className="h-4 w-4 text-primary" />
                  <span className="text-white/90 text-sm font-medium">
                    {relationshipPath.description}
                  </span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-row sm:flex-col gap-2 flex-shrink-0 pb-2 flex-wrap">
              <Link
                to="/tree/$personId"
                params={{ personId: person.id }}
                className="inline-flex items-center justify-center gap-2 bg-primary text-earth-900 font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg hover:bg-primary-dark hover:text-white transition-colors shadow-lg"
              >
                <TreePine className="h-4 w-4" />
                View in Tree
              </Link>
              {canEdit && (
                <button
                  onClick={() => setEditOpen(true)}
                  className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm text-white font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  Edit Profile
                </button>
              )}
              {/* This Is Me / This Is You button */}
              {user?.linkedPersonId === personId ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUnlinkConfirm(!showUnlinkConfirm)}
                    className="flex items-center gap-2 bg-sage-800 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg hover:bg-sage-700 transition-colors"
                  >
                    <UserCheck className="h-4 w-4" />
                    This Is You
                  </button>
                  {showUnlinkConfirm && (
                    <div className="absolute top-full mt-2 left-0 bg-white dark:bg-dark-card rounded-xl shadow-xl border border-sage-200 dark:border-dark-border p-3 min-w-[200px] z-50">
                      <p className="text-sm text-earth-900 dark:text-dark-text mb-2">
                        Unlink your account from this person?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => unlinkMutation.mutate()}
                          disabled={unlinkMutation.isPending}
                          className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors"
                        >
                          {unlinkMutation.isPending ? "Unlinking..." : "Unlink"}
                        </button>
                        <button
                          onClick={() => setShowUnlinkConfirm(false)}
                          className="px-3 py-1.5 bg-sage-100 dark:bg-dark-surface text-sage-600 dark:text-dark-text-muted text-xs font-medium rounded-lg hover:bg-sage-200 dark:hover:bg-dark-border transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : !user?.linkedPersonId ? (
                <button
                  onClick={() => linkMutation.mutate()}
                  disabled={linkMutation.isPending}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg border border-white/20 hover:bg-white/20 transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  {linkMutation.isPending ? "Linking..." : "This Is Me"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-10 space-y-8 sm:space-y-10">
        {/* Born / Died detail cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Born card */}
          <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-xl border border-sage-200 dark:border-dark-border p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-sage-400 dark:text-dark-text-muted">
              <MapPin className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Born
              </span>
            </div>
            <div>
              <p className="text-base font-medium text-earth-900 dark:text-dark-text leading-snug">
                {person.birthPlaceText || "\u2014"}
              </p>
              <p className="text-sm text-sage-400 dark:text-dark-text-muted mt-1 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(person.birthDate, person.birthDateApprox)}
              </p>
            </div>
          </div>

          {/* Died card or Living badge */}
          {person.isLiving ? (
            <div className="bg-primary/10 dark:bg-primary/5 rounded-xl border border-primary/20 dark:border-primary/15 p-5 flex items-center justify-center shadow-sm">
              <span className="text-sm font-bold text-primary-dark dark:text-primary uppercase tracking-wider">
                Living
              </span>
            </div>
          ) : (
            <div className="bg-white/80 dark:bg-dark-card/80 backdrop-blur-sm rounded-xl border border-sage-200 dark:border-dark-border p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2 text-sage-400 dark:text-dark-text-muted">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-widest">
                  Died
                </span>
              </div>
              <div>
                <p className="text-base font-medium text-earth-900 dark:text-dark-text leading-snug">
                  {person.deathPlaceText || "\u2014"}
                </p>
                <p className="text-sm text-sage-400 dark:text-dark-text-muted mt-1 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(person.deathDate, person.deathDateApprox)}
                </p>
                {person.causeOfDeath && (
                  <p className="text-xs text-sage-400 dark:text-dark-text-muted mt-1">
                    {person.causeOfDeath}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Nicknames */}
        {person.nicknames && (
          <div className="flex flex-wrap gap-2">
            {person.nicknames.split(",").map((nick, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 bg-white/70 dark:bg-dark-card/70 border border-sage-200 dark:border-dark-border px-3 py-1.5 rounded-full text-sm text-earth-800 dark:text-dark-text"
              >
                <User className="h-3.5 w-3.5 text-sage-400 dark:text-dark-text-muted" />
                {nick.trim()}
              </span>
            ))}
          </div>
        )}

        {/* Residences */}
        {sortedResidences.length > 0 && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-600 dark:text-dark-text-muted">
              <Home className="h-4 w-4" />
              Residences
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sortedResidences.map((r) => (
                <div
                  key={r.id}
                  className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-sage-400 dark:text-dark-text-muted mb-1">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="text-xs font-bold uppercase tracking-widest">
                        {r.is_current ? "Current Residence" : "Residence"}
                      </span>
                    </div>
                    {r.is_current && (
                      <span className="text-xs font-semibold text-primary-dark bg-primary/10 px-2 py-0.5 rounded flex-shrink-0">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-earth-900 dark:text-dark-text">
                    {[r.location?.city, r.location?.region, r.location?.country].filter(Boolean).join(", ") || r.place_text || "Unknown location"}
                  </p>
                  {(r.from_date || r.to_date) && (
                    <p className="text-xs text-sage-400 dark:text-dark-text-muted mt-1 flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {r.from_date ?? "?"} {"\u2013"} {r.is_current ? "present" : (r.to_date ?? "?")}
                    </p>
                  )}
                  {r.notes && (
                    <p className="text-xs text-sage-400 dark:text-dark-text-muted mt-1 italic">
                      {r.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Bio section */}
        {person.bio && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-600 dark:text-dark-text-muted">
              <BookOpen className="h-4 w-4" />
              About
            </h3>
            <div className="relative bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border p-6 rounded-xl shadow-sm overflow-hidden">
              {/* Green left accent bar */}
              <div className="absolute left-0 top-0 w-1 h-full bg-primary rounded-l-xl" />
              <p className="text-base text-earth-800 dark:text-dark-text leading-relaxed pl-4">
                {person.bio}
              </p>
            </div>
          </section>
        )}

        {/* Additional Details */}
        {(person.ethnicity || person.religion || person.education || person.militaryService || person.burialLocation) && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-600 dark:text-dark-text-muted">
              <User className="h-4 w-4" />
              Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {person.ethnicity && (
                <div className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sage-400 dark:text-dark-text-muted mb-1">
                    <Globe className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold uppercase tracking-widest">Ethnicity</span>
                  </div>
                  <p className="text-sm font-medium text-earth-900 dark:text-dark-text">{person.ethnicity}</p>
                </div>
              )}
              {person.religion && (
                <div className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sage-400 dark:text-dark-text-muted mb-1">
                    <Church className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold uppercase tracking-widest">Religion</span>
                  </div>
                  <p className="text-sm font-medium text-earth-900 dark:text-dark-text">{person.religion}</p>
                </div>
              )}
              {person.education && (
                <div className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sage-400 dark:text-dark-text-muted mb-1">
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold uppercase tracking-widest">Education</span>
                  </div>
                  <p className="text-sm font-medium text-earth-900 dark:text-dark-text">{person.education}</p>
                </div>
              )}
              {person.militaryService && (
                <div className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sage-400 dark:text-dark-text-muted mb-1">
                    <Shield className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold uppercase tracking-widest">Military Service</span>
                  </div>
                  <p className="text-sm font-medium text-earth-900 dark:text-dark-text">{person.militaryService}</p>
                </div>
              )}
              {person.burialLocation && (
                <div className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sage-400 dark:text-dark-text-muted mb-1">
                    <Cross className="h-3.5 w-3.5" />
                    <span className="text-xs font-bold uppercase tracking-widest">Burial Location</span>
                  </div>
                  <p className="text-sm font-medium text-earth-900 dark:text-dark-text">{person.burialLocation}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Notes (admin/editor only) */}
        {canEdit && person.notes && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-600 dark:text-dark-text-muted">
              <StickyNote className="h-4 w-4" />
              Notes
            </h3>
            <div className="relative bg-amber-50/70 dark:bg-amber-900/10 backdrop-blur-sm border border-amber-200 dark:border-amber-800/30 p-6 rounded-xl shadow-sm overflow-hidden">
              <div className="absolute left-0 top-0 w-1 h-full bg-amber-400 dark:bg-amber-600 rounded-l-xl" />
              <p className="text-sm text-earth-800 dark:text-dark-text leading-relaxed pl-4 whitespace-pre-wrap">
                {person.notes}
              </p>
            </div>
          </section>
        )}

        {/* Relationships section */}
        <section className="space-y-5">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-600 dark:text-dark-text-muted">
            <Users className="h-4 w-4" />
            Family
          </h3>

          {!relationships && !grouped && (
            <div className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-6 text-center shadow-sm">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sage-400 dark:text-dark-text-muted text-sm">
                Loading relationships...
              </p>
            </div>
          )}

          {grouped && (
            <div className="space-y-6">
              <RelationshipGroup
                title="Parents"
                icon={<User className="h-3.5 w-3.5" />}
                items={grouped.parents}
              />
              <RelationshipGroup
                title={
                  grouped.spouses.length > 1 ? "Spouses" : "Spouse"
                }
                icon={<Heart className="h-3.5 w-3.5" />}
                items={grouped.spouses}
              />
              <RelationshipGroup
                title="Children"
                icon={<Users className="h-3.5 w-3.5" />}
                items={grouped.children}
              />

              {grouped.parents.length === 0 &&
                grouped.spouses.length === 0 &&
                grouped.children.length === 0 && (
                  <div className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-6 text-center shadow-sm">
                    <Users className="h-8 w-8 text-sage-300 dark:text-dark-text-muted mx-auto mb-2" />
                    <p className="text-sage-400 dark:text-dark-text-muted text-sm">
                      No family connections recorded yet.
                    </p>
                  </div>
                )}
            </div>
          )}
        </section>

        {/* Life Story section */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-600 dark:text-dark-text-muted">
            <BookOpen className="h-4 w-4" />
            Life Story
          </h3>

          {storyLoading && (
            <div className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-8 text-center shadow-sm">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sage-400 dark:text-dark-text-muted text-sm">Loading...</p>
            </div>
          )}

          {!storyLoading && story && (
            <Link
              to="/person/$personId/story"
              params={{ personId: person.id }}
              className="block bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-6 shadow-sm hover:bg-white dark:hover:bg-dark-card hover:border-primary/40 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h4 className="text-lg font-serif font-semibold text-earth-900 dark:text-dark-text group-hover:text-primary-dark transition-colors">
                    {story.title}
                  </h4>
                  {story.subtitle && (
                    <p className="text-sm text-sage-400 dark:text-dark-text-muted italic mt-1">
                      {story.subtitle}
                    </p>
                  )}
                  <p className="text-xs text-sage-400 dark:text-dark-text-muted mt-3 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Published
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-sage-300 dark:text-dark-text-muted group-hover:text-primary flex-shrink-0 mt-1 transition-colors" />
              </div>
            </Link>
          )}

          {!storyLoading && !story && (
            <div className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-8 text-center shadow-sm">
              <BookOpen className="h-10 w-10 text-sage-300 dark:text-dark-text-muted mx-auto mb-3" />
              <p className="text-sage-400 dark:text-dark-text-muted text-sm font-medium">
                No published story yet
              </p>
              <p className="text-sage-300 dark:text-dark-text-muted text-xs mt-1 mb-4">
                {canEdit
                  ? "Write this person's life story to share with the family."
                  : "A life story has not been written for this person yet."}
              </p>
              <div className="flex justify-center gap-3">
                <Link
                  to="/person/$personId/story"
                  params={{ personId: person.id }}
                  className="inline-flex items-center gap-2 bg-white dark:bg-dark-surface border border-sage-200 dark:border-dark-border text-earth-800 dark:text-dark-text font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg hover:bg-sage-50 dark:hover:bg-dark-card transition-colors"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  View Story Page
                </Link>
                {canEdit && (
                  <Link
                    to="/person/$personId/story-edit"
                    params={{ personId: person.id }}
                    className="inline-flex items-center gap-2 bg-primary text-earth-900 font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg hover:bg-primary-dark hover:text-white transition-colors"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Write Story
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Gallery */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-600 dark:text-dark-text-muted">
            <Image className="h-4 w-4" />
            Gallery
          </h3>
          {mediaItems && mediaItems.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {mediaItems.map((item) => (
                <img
                  key={item.id}
                  src={`/media/${item.s3_key}`}
                  alt={item.title ?? "Photo"}
                  className="w-full aspect-square rounded-lg border border-sage-200 dark:border-dark-border object-cover"
                />
              ))}
            </div>
          ) : (
            <div className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-8 text-center shadow-sm">
              <Image className="h-10 w-10 text-sage-300 dark:text-dark-text-muted mx-auto mb-3" />
              <p className="text-sage-400 dark:text-dark-text-muted text-sm font-medium">No photos yet</p>
              <p className="text-sage-300 dark:text-dark-text-muted text-xs mt-1">
                Photos and documents will be displayed here.
              </p>
            </div>
          )}
        </section>
      </div>

      {canEdit && person && (
        <EditPersonModal
          person={person}
          personId={personId}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  )
}

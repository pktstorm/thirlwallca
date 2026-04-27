import { useQuery } from "@tanstack/react-query"
import { api } from "../lib/api"
import type { OrbitData, ControlOptions } from "../components/orbital/orbitalTypes"

export interface UsePersonOrbitOptions {
  ancestorDepth: number
  descendantDepth: number
  includeSiblings: boolean
  includeSpouses: boolean
}

interface OrbitApiPersonRef {
  id: string
  given_name: string
  surname: string | null
  birth_year: number | null
  death_year: number | null
  is_living: boolean
  photo_url: string | null
  sex: string | null
}

interface OrbitApiAncestor extends OrbitApiPersonRef {
  parent_slot: "father" | "mother" | null
  parent_id: string | null
}

interface OrbitApiDescendant extends OrbitApiPersonRef {
  parent_id: string
  children: OrbitApiDescendant[]
}

interface OrbitApiSpouse extends OrbitApiPersonRef {
  spouse_of: string
}

interface OrbitApiResponse {
  focus: OrbitApiPersonRef
  ancestors_by_generation: OrbitApiAncestor[][]
  descendants: OrbitApiDescendant[]
  siblings: OrbitApiPersonRef[]
  spouses: OrbitApiSpouse[]
}

function toCamel(p: OrbitApiPersonRef) {
  return {
    id: p.id,
    givenName: p.given_name,
    surname: p.surname,
    birthYear: p.birth_year,
    deathYear: p.death_year,
    isLiving: p.is_living,
    photoUrl: p.photo_url,
    sex: p.sex,
  }
}

function descendantToCamel(d: OrbitApiDescendant): OrbitData["descendants"][number] {
  return {
    ...toCamel(d),
    parentId: d.parent_id,
    children: (d.children ?? []).map(descendantToCamel),
  }
}

function transform(apiResponse: OrbitApiResponse): OrbitData {
  return {
    focus: toCamel(apiResponse.focus),
    ancestorsByGeneration: apiResponse.ancestors_by_generation.map((gen) =>
      gen.map((a) => ({
        ...toCamel(a),
        parentSlot: a.parent_slot,
        parentId: a.parent_id,
      })),
    ),
    descendants: apiResponse.descendants.map(descendantToCamel),
    siblings: apiResponse.siblings.map(toCamel),
    spouses: apiResponse.spouses.map((s) => ({ ...toCamel(s), spouseOf: s.spouse_of })),
  }
}

export function usePersonOrbit(
  personId: string | null | undefined,
  opts: UsePersonOrbitOptions,
) {
  return useQuery<OrbitData>({
    queryKey: ["personOrbit", personId, opts],
    enabled: !!personId,
    queryFn: async () => {
      const res = await api.get<OrbitApiResponse>(`/persons/${personId}/orbit`, {
        params: {
          ancestor_depth: opts.ancestorDepth,
          descendant_depth: opts.descendantDepth,
          include_siblings: opts.includeSiblings,
          include_spouses: opts.includeSpouses,
        },
      })
      return transform(res.data)
    },
  })
}

export function buildControlOptions(
  display: {
    ancestorDepth: number
    descendantDepth: number
    showSpouses: boolean
    showPhotos: boolean
    highlightDirectLine: boolean
    livingDeceasedStyling: boolean
    labelDensity: "none" | "names" | "names-dates"
  },
  orbital: { showSiblings: boolean; colorByBranch: boolean; recenterOnSingleClick: boolean },
): ControlOptions {
  return { ...display, ...orbital }
}

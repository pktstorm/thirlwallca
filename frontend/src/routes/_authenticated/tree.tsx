import { useCallback, useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { Breadcrumbs } from "../../components/layout/Breadcrumbs"
import {
  FamilyTreeCanvas,
  type ApiTreeNode,
  type ApiTreeEdge,
} from "../../components/tree/FamilyTreeCanvas"
import { PersonDetailPanel } from "../../components/tree/PersonDetailPanel"
import { AddMemberButton } from "../../components/tree/AddMemberButton"
import { TimeSlider } from "../../components/tree/TimeSlider"
import { TreeViewToggle } from "../../components/tree/TreeViewToggle"
import { TreeSearch } from "../../components/tree/TreeSearch"
import { GenerationFilter } from "../../components/tree/GenerationFilter"
import { useTreeStore } from "../../stores/treeStore"
import { useUiStore } from "../../stores/uiStore"
import { useAuthStore } from "../../stores/authStore"
import { OrbitalCanvas } from "../../components/orbital/OrbitalCanvas"
import { OrbitalControlsPanel } from "../../components/orbital/OrbitalControlsPanel"

export const Route = createFileRoute("/_authenticated/tree")({
  component: TreePage,
})

interface TreeResponse {
  nodes: ApiTreeNode[]
  edges: ApiTreeEdge[]
}

function TreePage() {
  const queryClient = useQueryClient()
  const focusedPersonId = useTreeStore((s) => s.focusedPersonId)
  const setFocusedPerson = useTreeStore((s) => s.setFocusedPerson)
  const detailPanelOpen = useUiStore((s) => s.detailPanelOpen)
  const toggleDetailPanel = useUiStore((s) => s.toggleDetailPanel)
  const linkedPersonId = useAuthStore((s) => s.user?.linkedPersonId)
  const treeViewMode = useTreeStore((s) => s.treeViewMode)
  const branchPersonId = useTreeStore((s) => s.branchPersonId)

  // Progressive disclosure: merged expand data
  const [expandedData, setExpandedData] = useState<{ nodes: ApiTreeNode[]; edges: ApiTreeEdge[] }>({ nodes: [], edges: [] })

  const effectiveBranchPersonId = branchPersonId ?? linkedPersonId
  const effectiveMode = effectiveBranchPersonId && treeViewMode === "branch" ? "branch" : "full-tree"

  const { data, isLoading, isError, error } = useQuery<TreeResponse>({
    queryKey: ["tree", effectiveMode, effectiveBranchPersonId],
    queryFn: async () => {
      if (effectiveMode === "branch" && effectiveBranchPersonId) {
        const res = await api.get<TreeResponse>(`/tree/${effectiveBranchPersonId}`, {
          params: { depth: 4 },
        })
        return res.data
      }
      const res = await api.get<TreeResponse>("/tree")
      return res.data
    },
    placeholderData: keepPreviousData,
    enabled: treeViewMode !== "orbital",
  })

  // Reset expanded data when base data changes
  const prevQueryKey = useMemo(
    () => JSON.stringify(["tree", effectiveMode, effectiveBranchPersonId]),
    [effectiveMode, effectiveBranchPersonId],
  )
  const [lastQueryKey, setLastQueryKey] = useState(prevQueryKey)
  if (prevQueryKey !== lastQueryKey) {
    setLastQueryKey(prevQueryKey)
    setExpandedData({ nodes: [], edges: [] })
  }

  // Merge base data with expanded data
  const mergedData = useMemo<TreeResponse | undefined>(() => {
    if (!data) return undefined
    if (expandedData.nodes.length === 0 && expandedData.edges.length === 0) return data

    const existingNodeIds = new Set(data.nodes.map((n) => n.id))
    const existingEdgeIds = new Set(data.edges.map((e) => e.id))

    const newNodes = expandedData.nodes.filter((n) => !existingNodeIds.has(n.id))
    const newEdges = expandedData.edges.filter((e) => !existingEdgeIds.has(e.id))

    return {
      nodes: [...data.nodes, ...newNodes],
      edges: [...data.edges, ...newEdges],
    }
  }, [data, expandedData])

  // Expand mutation
  const expandMutation = useMutation({
    mutationFn: async ({ personId, direction }: { personId: string; direction: "up" | "down" | "both" }) => {
      const res = await api.get<TreeResponse>(`/tree/${personId}/expand`, {
        params: { direction },
      })
      return res.data
    },
    onSuccess: (result) => {
      setExpandedData((prev) => ({
        nodes: [...prev.nodes, ...result.nodes],
        edges: [...prev.edges, ...result.edges],
      }))
    },
  })

  const handleExpand = useCallback(
    (personId: string, direction: "up" | "down" | "both") => {
      expandMutation.mutate({ personId, direction })
    },
    [expandMutation],
  )

  const existingPersons = useMemo(
    () =>
      (mergedData?.nodes ?? []).map((n) => {
        const parts = [n.data.first_name]
        if (n.data.middle_name) parts.push(n.data.middle_name)
        parts.push(n.data.last_name)
        let label = parts.join(" ")
        if (n.data.birth_date) {
          const year = n.data.birth_date.split("-")[0]
          if (year) label += ` (b. ${year})`
        }
        return { id: n.id, label }
      }),
    [mergedData?.nodes],
  )

  const { minYear, maxYear } = useMemo(() => {
    const years: number[] = []
    for (const node of mergedData?.nodes ?? []) {
      if (node.data.birth_date) {
        const year = new Date(node.data.birth_date).getFullYear()
        if (!isNaN(year)) years.push(year)
      }
    }
    if (years.length === 0) return { minYear: 1800, maxYear: new Date().getFullYear() }
    return { minYear: Math.min(...years), maxYear: Math.max(...years) }
  }, [mergedData?.nodes])

  const centerOnPerson = useTreeStore((s) => s.centerOnPerson)

  const handleMemberCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["tree"] })
  }

  const breadcrumbLabel = useMemo(() => {
    if (effectiveMode === "full-tree") return "Full Tree"
    if (!mergedData) return "Branch"
    if (focusedPersonId) {
      const focusedNode = mergedData.nodes.find((n) => n.id === focusedPersonId)
      if (focusedNode) return `${focusedNode.data.first_name}'s Branch`
    }
    if (effectiveBranchPersonId) {
      const branchNode = mergedData.nodes.find((n) => n.id === effectiveBranchPersonId)
      if (branchNode) return `${branchNode.data.first_name}'s Branch`
    }
    return "Branch"
  }, [effectiveMode, focusedPersonId, effectiveBranchPersonId, mergedData])

  const nodeCount = mergedData?.nodes.length ?? 0

  return (
    <div className="h-screen w-screen bg-sage-50 dark:bg-bg-dark relative overflow-hidden">
      {/* Dot pattern background */}
      <div
        className="absolute inset-0 pointer-events-none [background-image:radial-gradient(circle,#c5d6cb_1px,transparent_1px)] dark:[background-image:radial-gradient(circle,rgba(48,232,110,0.15)_1px,transparent_1px)]"
        style={{ backgroundSize: "24px 24px" }}
      />

      {/* Header */}
      <AppHeader />

      {/* Controls row — simplified on mobile */}
      <div className="absolute top-14 sm:top-16 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-30 pointer-events-auto flex items-center gap-1.5 sm:gap-2 justify-center">
        <div className="hidden sm:block">
          <Breadcrumbs items={[{ label: breadcrumbLabel, active: true }]} />
        </div>
        <TreeViewToggle nodeCount={nodeCount} disabled={!linkedPersonId} />
        <TreeSearch treeNodes={mergedData?.nodes ?? []} />
      </div>

      {/* Canvas */}
      {treeViewMode !== "orbital" && isLoading && !data && (
        <div className="h-full w-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sage-400 dark:text-dark-text-muted text-sm">Loading family tree...</p>
          </div>
        </div>
      )}

      {treeViewMode !== "orbital" && isError && !data && (
        <div className="h-full w-full flex items-center justify-center">
          <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm dark:shadow-none px-6 py-4 max-w-md text-center">
            <p className="text-red-600 dark:text-red-400 font-medium mb-1">
              Failed to load tree
            </p>
            <p className="text-sage-400 dark:text-dark-text-muted text-sm">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </div>
      )}

      {treeViewMode === "orbital" ? (
        effectiveBranchPersonId ? (
          <>
            <OrbitalCanvas focusPersonId={effectiveBranchPersonId} />
            <OrbitalControlsPanel />
          </>
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border shadow-sm dark:shadow-none px-6 py-4 max-w-md text-center">
              <p className="text-earth-900 dark:text-dark-text font-medium mb-1">
                Link your profile to a person
              </p>
              <p className="text-sage-400 dark:text-dark-text-muted text-sm">
                The orbital view needs a focus person. Link your account to someone in the family tree to use it.
              </p>
            </div>
          </div>
        )
      ) : (
        mergedData && (
          <FamilyTreeCanvas
            nodes={mergedData.nodes}
            edges={mergedData.edges}
            focusPersonId={effectiveBranchPersonId ?? undefined}
            onExpand={handleExpand}
            isExpanding={expandMutation.isPending}
          />
        )
      )}

      {/* Person detail panel */}
      <PersonDetailPanel
        personId={detailPanelOpen ? focusedPersonId : null}
        onClose={() => {
          setFocusedPerson(null)
          if (detailPanelOpen) toggleDetailPanel()
        }}
        onCenterOnTree={centerOnPerson ?? undefined}
      />

      {/* Time slider - desktop, generation filter - mobile */}
      {mergedData && treeViewMode !== "orbital" && (
        <>
          {/* Desktop: time slider */}
          <div className="absolute bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:bottom-6 z-30 pointer-events-auto hidden sm:block">
            <TimeSlider minYear={minYear} maxYear={maxYear} />
          </div>
          {/* Mobile: generation filter dropdown — above bottom nav */}
          <div className="absolute bottom-16 left-14 z-30 pointer-events-auto sm:hidden">
            <GenerationFilter minYear={minYear} maxYear={maxYear} />
          </div>
        </>
      )}

      {/* Add Member button — above bottom nav on mobile */}
      <div className="absolute bottom-28 left-4 sm:bottom-6 sm:left-6 z-30 pointer-events-auto">
        <AddMemberButton
          existingPersons={existingPersons}
          onCreated={handleMemberCreated}
          defaultConnectTo={focusedPersonId}
        />
      </div>
    </div>
  )
}

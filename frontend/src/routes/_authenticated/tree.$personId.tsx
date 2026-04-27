import { useEffect } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { Breadcrumbs } from "../../components/layout/Breadcrumbs"
import {
  FamilyTreeCanvas,
  type ApiTreeNode,
  type ApiTreeEdge,
} from "../../components/tree/FamilyTreeCanvas"
import { PersonDetailPanel } from "../../components/tree/PersonDetailPanel"
import { useTreeStore } from "../../stores/treeStore"
import { useUiStore } from "../../stores/uiStore"
import { OrbitalCanvas } from "../../components/orbital/OrbitalCanvas"
import { OrbitalControlsPanel } from "../../components/orbital/OrbitalControlsPanel"
import { TreeDisplayControls } from "../../components/tree/TreeDisplayControls"

export const Route = createFileRoute("/_authenticated/tree/$personId")({
  component: TreePersonPage,
})

interface TreeResponse {
  nodes: ApiTreeNode[]
  edges: ApiTreeEdge[]
}

function TreePersonPage() {
  const { personId } = Route.useParams()
  const focusedPersonId = useTreeStore((s) => s.focusedPersonId)
  const setFocusedPerson = useTreeStore((s) => s.setFocusedPerson)
  const treeViewMode = useTreeStore((s) => s.treeViewMode)
  const detailPanelOpen = useUiStore((s) => s.detailPanelOpen)
  const toggleDetailPanel = useUiStore((s) => s.toggleDetailPanel)

  // Immediately sync focused person on mount and on param change
  useEffect(() => {
    setFocusedPerson(personId)
    if (!detailPanelOpen) toggleDetailPanel()
  }, [personId]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isError, error } = useQuery<TreeResponse>({
    queryKey: ["tree", personId],
    queryFn: async () => {
      const res = await api.get<TreeResponse>(`/tree/${personId}`)
      return res.data
    },
    enabled: treeViewMode !== "orbital",
  })

  // Find focused person name for breadcrumbs
  const focusedPerson = data?.nodes.find((n) => n.id === personId)
  const personLabel = focusedPerson?.label ?? "Person"

  return (
    <div className="h-screen w-screen bg-sage-50 dark:bg-bg-dark relative overflow-hidden">
      {/* Dot pattern background */}
      <div
        className="absolute inset-0 pointer-events-none [background-image:radial-gradient(circle,#c5d6cb_1px,transparent_1px)] dark:[background-image:radial-gradient(circle,rgba(48,232,110,0.15)_1px,transparent_1px)]"
        style={{
          backgroundSize: "24px 24px",
        }}
      />

      {/* Header */}
      <AppHeader />

      {/* Breadcrumbs - top center below header */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <Breadcrumbs
          items={[
            {
              label: "Family Tree",
              onClick: () => {
                window.history.back()
              },
            },
            { label: personLabel, active: true },
          ]}
        />
      </div>

      {/* Canvas */}
      {treeViewMode !== "orbital" && isLoading && (
        <div className="h-full w-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sage-400 dark:text-dark-text-muted text-sm">Loading family tree...</p>
          </div>
        </div>
      )}

      {treeViewMode !== "orbital" && isError && (
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
        <>
          <OrbitalCanvas focusPersonId={personId} />
          <OrbitalControlsPanel />
        </>
      ) : (
        <>
          {data && (
            <FamilyTreeCanvas
              nodes={data.nodes}
              edges={data.edges}
              focusPersonId={personId}
            />
          )}
          <TreeDisplayControls />
        </>
      )}

      {/* Person detail panel - right sidebar */}
      <PersonDetailPanel
        personId={detailPanelOpen ? (focusedPersonId ?? personId) : null}
        onClose={() => {
          setFocusedPerson(null)
          if (detailPanelOpen) toggleDetailPanel()
        }}
      />
    </div>
  )
}

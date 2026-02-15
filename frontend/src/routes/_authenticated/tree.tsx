import { useMemo } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
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
import { useTreeStore } from "../../stores/treeStore"
import { useUiStore } from "../../stores/uiStore"

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

  const { data, isLoading, isError, error } = useQuery<TreeResponse>({
    queryKey: ["tree"],
    queryFn: async () => {
      const res = await api.get<TreeResponse>("/tree")
      return res.data
    },
  })

  const existingPersons = useMemo(
    () =>
      (data?.nodes ?? []).map((n) => {
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
    [data?.nodes],
  )

  // Compute min/max years from tree node birth dates
  const { minYear, maxYear } = useMemo(() => {
    const years: number[] = []
    for (const node of data?.nodes ?? []) {
      if (node.data.birth_date) {
        const year = new Date(node.data.birth_date).getFullYear()
        if (!isNaN(year)) years.push(year)
      }
    }
    if (years.length === 0) return { minYear: 1800, maxYear: new Date().getFullYear() }
    return { minYear: Math.min(...years), maxYear: Math.max(...years) }
  }, [data?.nodes])

  const centerOnPerson = useTreeStore((s) => s.centerOnPerson)

  const handleMemberCreated = () => {
    queryClient.invalidateQueries({ queryKey: ["tree"] })
  }

  return (
    <div className="h-screen w-screen bg-sage-50 dark:bg-bg-dark relative overflow-hidden">
      {/* Dot pattern background (behind React Flow, which has its own) */}
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
            { label: "Family Tree", active: true },
          ]}
        />
      </div>

      {/* Canvas */}
      {isLoading && (
        <div className="h-full w-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sage-400 dark:text-dark-text-muted text-sm">Loading family tree...</p>
          </div>
        </div>
      )}

      {isError && (
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

      {data && (
        <FamilyTreeCanvas nodes={data.nodes} edges={data.edges} />
      )}

      {/* Person detail panel - right sidebar */}
      <PersonDetailPanel
        personId={detailPanelOpen ? focusedPersonId : null}
        onClose={() => {
          setFocusedPerson(null)
          if (detailPanelOpen) toggleDetailPanel()
        }}
        onCenterOnTree={centerOnPerson ?? undefined}
      />

      {/* Time slider - bottom center */}
      {data && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:bottom-6 z-30 pointer-events-auto">
          <TimeSlider minYear={minYear} maxYear={maxYear} />
        </div>
      )}

      {/* Add Member button - bottom left */}
      <div className="absolute bottom-20 left-4 sm:bottom-6 sm:left-6 z-30 pointer-events-auto">
        <AddMemberButton
          existingPersons={existingPersons}
          onCreated={handleMemberCreated}
          defaultConnectTo={focusedPersonId}
        />
      </div>
    </div>
  )
}

import { useReactFlow } from "@xyflow/react"
import { Plus, Minus, LocateFixed } from "lucide-react"
import { useAuthStore } from "../../stores/authStore"
import { useTreeStore } from "../../stores/treeStore"

export function TreeControls() {
  const { zoomIn, zoomOut } = useReactFlow()
  const linkedPersonId = useAuthStore((s) => s.user?.linkedPersonId)
  const centerOnPerson = useTreeStore((s) => s.centerOnPerson)
  const treeViewMode = useTreeStore((s) => s.treeViewMode)
  const setTreeViewMode = useTreeStore((s) => s.setTreeViewMode)
  const setBranchPersonId = useTreeStore((s) => s.setBranchPersonId)
  const setFocusedPerson = useTreeStore((s) => s.setFocusedPerson)

  function handleFindMe() {
    if (!linkedPersonId) return
    if (treeViewMode === "orbital") {
      setBranchPersonId(linkedPersonId)
      setFocusedPerson(linkedPersonId)
      return
    }
    // If centerOnPerson is available (person is in current data), center directly
    if (centerOnPerson) {
      centerOnPerson(linkedPersonId)
      setFocusedPerson(linkedPersonId)
      return
    }
    // Otherwise, switch to branch mode centered on me
    setBranchPersonId(null) // reset to default (linkedPersonId)
    if (treeViewMode !== "branch") {
      setTreeViewMode("branch")
    }
  }

  return (
    <div className="absolute bottom-44 sm:bottom-32 right-3 sm:right-4 z-10 flex flex-col gap-0 rounded-xl overflow-hidden shadow-lg dark:shadow-black/20 border border-sage-200 dark:border-dark-border">
      {treeViewMode !== "orbital" && (
        <>
          <button
            onClick={() => zoomIn({ duration: 200 })}
            className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm p-2.5 hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors text-earth-900 dark:text-dark-text border-b border-sage-200 dark:border-dark-border"
            aria-label="Zoom in"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => zoomOut({ duration: 200 })}
            className={`bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm p-2.5 hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors text-earth-900 dark:text-dark-text ${linkedPersonId ? "border-b border-sage-200 dark:border-dark-border" : ""}`}
            aria-label="Zoom out"
          >
            <Minus className="w-4 h-4" />
          </button>
        </>
      )}
      {linkedPersonId && (
        <button
          onClick={handleFindMe}
          className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm p-2.5 hover:bg-primary/10 dark:hover:bg-primary/10 transition-colors text-primary-dark dark:text-primary"
          aria-label="Find me on tree"
          title="Find me"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

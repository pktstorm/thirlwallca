import { GitBranch, TreePine } from "lucide-react"
import { useTreeStore, type TreeViewMode } from "../../stores/treeStore"

interface TreeViewToggleProps {
  nodeCount: number
  disabled?: boolean
}

export function TreeViewToggle({ nodeCount, disabled }: TreeViewToggleProps) {
  const treeViewMode = useTreeStore((s) => s.treeViewMode)
  const setTreeViewMode = useTreeStore((s) => s.setTreeViewMode)
  const setBranchPersonId = useTreeStore((s) => s.setBranchPersonId)

  function handleClick(mode: TreeViewMode) {
    if (disabled && mode === "branch") return
    if (mode === "branch") {
      // Reset to logged-in user's branch (clear override)
      setBranchPersonId(null)
    }
    setTreeViewMode(mode)
  }

  return (
    <div className="flex items-center bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm rounded-xl border border-sage-200 dark:border-dark-border shadow-sm dark:shadow-black/20 overflow-hidden">
      <button
        onClick={() => handleClick("branch")}
        disabled={disabled}
        title={disabled ? "Link your profile to a person to use Branch view" : "View a family branch"}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
          treeViewMode === "branch" && !disabled
            ? "bg-primary/10 text-primary-dark dark:text-primary"
            : "text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text"
        } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
      >
        <GitBranch className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Branch</span>
      </button>
      <div className="w-px h-5 bg-sage-200 dark:bg-dark-border" />
      <button
        onClick={() => handleClick("full-tree")}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
          treeViewMode === "full-tree" || disabled
            ? "bg-primary/10 text-primary-dark dark:text-primary"
            : "text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text"
        }`}
      >
        <TreePine className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Full Tree</span>
      </button>
      <div className="w-px h-5 bg-sage-200 dark:bg-dark-border" />
      <span className="px-2.5 py-2 text-xs text-sage-400 dark:text-dark-text-muted tabular-nums">
        {nodeCount}
      </span>
    </div>
  )
}

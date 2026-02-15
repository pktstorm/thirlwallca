import { useReactFlow } from "@xyflow/react"
import { useNavigate } from "@tanstack/react-router"
import { Plus, Minus, LocateFixed } from "lucide-react"
import { useAuthStore } from "../../stores/authStore"

export function TreeControls() {
  const { zoomIn, zoomOut } = useReactFlow()
  const navigate = useNavigate()
  const linkedPersonId = useAuthStore((s) => s.user?.linkedPersonId)

  return (
    <div className="absolute bottom-32 right-4 z-10 flex flex-col gap-0 rounded-xl overflow-hidden shadow-lg dark:shadow-black/20 border border-sage-200 dark:border-dark-border">
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
      {linkedPersonId && (
        <button
          onClick={() =>
            navigate({
              to: "/tree/$personId",
              params: { personId: linkedPersonId },
            } as any)
          }
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

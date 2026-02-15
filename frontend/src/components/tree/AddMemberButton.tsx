import { useState } from "react"
import { Plus } from "lucide-react"
import { AddMemberModal } from "./AddMemberModal"

interface AddMemberButtonProps {
  existingPersons: { id: string; label: string }[]
  onCreated: () => void
  defaultConnectTo?: string | null
}

export function AddMemberButton({
  existingPersons,
  onCreated,
  defaultConnectTo,
}: AddMemberButtonProps) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-3 bg-white dark:bg-dark-card pl-3 pr-5 py-2.5 rounded-full shadow-lg dark:shadow-black/20 border border-sage-200 dark:border-dark-border hover:shadow-xl dark:hover:shadow-black/30 hover:border-primary transition-all font-semibold text-sm dark:text-dark-text group"
      >
        <span className="bg-primary text-earth-900 rounded-full p-1.5 shadow-sm group-hover:scale-110 transition-transform">
          <Plus className="h-4 w-4" />
        </span>
        Add Member
      </button>

      <AddMemberModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={onCreated}
        existingPersons={existingPersons}
        defaultConnectTo={defaultConnectTo}
      />
    </>
  )
}

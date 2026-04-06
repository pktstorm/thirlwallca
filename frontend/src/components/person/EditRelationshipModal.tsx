import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { X, Save, Loader2, Trash2 } from "lucide-react"
import { api } from "../../lib/api"
import type { Relationship } from "../../types/relationship"
import type { Person } from "../../types/person"

interface EditRelationshipModalProps {
  open: boolean
  onClose: () => void
  relationship: Relationship
  otherPerson: Person
  personId: string
}

export function EditRelationshipModal({ open, onClose, relationship, otherPerson, personId }: EditRelationshipModalProps) {
  const queryClient = useQueryClient()
  const isSpouse = relationship.relationship === "spouse"

  const [marriageDate, setMarriageDate] = useState(relationship.marriageDate ?? "")
  const [divorceDate, setDivorceDate] = useState(relationship.divorceDate ?? "")
  const [marriagePlace, setMarriagePlace] = useState(relationship.marriagePlaceText ?? "")
  const [notes, setNotes] = useState(relationship.notes ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/relationships/${relationship.id}`, {
        marriage_date: marriageDate || null,
        divorce_date: divorceDate || null,
        marriage_place_text: marriagePlace || null,
        notes: notes || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relationships", personId] })
      queryClient.invalidateQueries({ queryKey: ["person-summary", personId] })
      onClose()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/relationships/${relationship.id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relationships", personId] })
      queryClient.invalidateQueries({ queryKey: ["relatedPersons", personId] })
      queryClient.invalidateQueries({ queryKey: ["tree"] })
      queryClient.invalidateQueries({ queryKey: ["person-summary", personId] })
      onClose()
    },
  })

  if (!open) return null

  const otherName = `${otherPerson.firstName} ${otherPerson.lastName}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-dark-card rounded-2xl shadow-xl border border-sage-200 dark:border-dark-border w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-sage-200 dark:border-dark-border">
          <h2 className="text-lg font-bold text-earth-900 dark:text-dark-text">
            {isSpouse ? "Edit Marriage" : "Edit Relationship"}
          </h2>
          <button onClick={onClose} className="p-1 text-sage-400 hover:text-earth-900 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Relationship info */}
          <div className="bg-sage-50 dark:bg-dark-surface rounded-lg px-3 py-2">
            <p className="text-sm text-earth-900 dark:text-dark-text font-medium">{otherName}</p>
            <p className="text-xs text-sage-400 capitalize">{relationship.relationship.replace("_", " ")}</p>
          </div>

          {isSpouse && (
            <>
              {/* Marriage date */}
              <div>
                <label className="block text-xs font-medium text-sage-600 dark:text-dark-text-muted mb-1">Marriage Date</label>
                <input type="date" value={marriageDate} onChange={(e) => setMarriageDate(e.target.value)}
                  className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
              </div>

              {/* Marriage place */}
              <div>
                <label className="block text-xs font-medium text-sage-600 dark:text-dark-text-muted mb-1">Marriage Place</label>
                <input type="text" value={marriagePlace} onChange={(e) => setMarriagePlace(e.target.value)}
                  placeholder="e.g., St. Mary's Church, London"
                  className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
              </div>

              {/* Divorce date */}
              <div>
                <label className="block text-xs font-medium text-sage-600 dark:text-dark-text-muted mb-1">Divorce Date <span className="text-sage-300 font-normal">(if applicable)</span></label>
                <input type="date" value={divorceDate} onChange={(e) => setDivorceDate(e.target.value)}
                  className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
              </div>
            </>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-sage-600 dark:text-dark-text-muted mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Any additional notes..."
              className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20 resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-sage-200 dark:border-dark-border flex items-center justify-between">
          {/* Delete */}
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <button onClick={() => deleteMutation.mutate()}
                className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600">
                {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm Remove"}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-sage-400">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors">
              <Trash2 className="h-3 w-3" /> Remove Relationship
            </button>
          )}

          {/* Save */}
          <button onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-dark text-white text-sm font-medium rounded-lg hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50">
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

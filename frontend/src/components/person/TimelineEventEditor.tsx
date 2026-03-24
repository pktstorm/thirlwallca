import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Edit, Trash2, X, Check, GripVertical } from "lucide-react"
import { api } from "../../lib/api"

interface TimelineEvent {
  id: string
  person_id: string
  title: string
  description: string | null
  event_date: string | null
  event_date_approx: boolean
  event_type: string | null
  sort_order: number
}

interface TimelineEventEditorProps {
  personId: string
  events: TimelineEvent[]
  canEdit: boolean
}

function EventForm({
  initial,
  personId,
  onClose,
}: {
  initial?: TimelineEvent
  personId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(initial?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [eventDate, setEventDate] = useState(initial?.event_date ?? "")
  const [eventType, setEventType] = useState(initial?.event_type ?? "")
  const [approx, setApprox] = useState(initial?.event_date_approx ?? false)

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/timeline-events", {
        person_id: personId,
        title,
        description: description || null,
        event_date: eventDate || null,
        event_date_approx: approx,
        event_type: eventType || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline-events", personId] })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/timeline-events/${initial!.id}`, {
        title,
        description: description || null,
        event_date: eventDate || null,
        event_date_approx: approx,
        event_type: eventType || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline-events", personId] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (initial) updateMutation.mutate()
    else createMutation.mutate()
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-dark-card rounded-xl border border-primary/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-primary-dark dark:text-primary">
          {initial ? "Edit Event" : "New Event"}
        </p>
        <button type="button" onClick={onClose} className="p-1 text-sage-400 hover:text-earth-900 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Event title"
        required
        className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm text-earth-900 dark:text-dark-text placeholder:text-sage-300 focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
      />

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm text-earth-900 dark:text-dark-text placeholder:text-sage-300 focus:outline-none focus:ring-2 focus:ring-primary-dark/20 resize-none"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-medium text-sage-400 dark:text-dark-text-muted uppercase tracking-wider mb-1 block">Date</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm text-earth-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
          />
          <label className="flex items-center gap-1.5 mt-1">
            <input type="checkbox" checked={approx} onChange={(e) => setApprox(e.target.checked)} className="rounded border-sage-300 text-primary-dark" />
            <span className="text-[10px] text-sage-400">Approximate</span>
          </label>
        </div>
        <div>
          <label className="text-[10px] font-medium text-sage-400 dark:text-dark-text-muted uppercase tracking-wider mb-1 block">Type</label>
          <input
            type="text"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder="e.g., milestone, career"
            className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm text-earth-900 dark:text-dark-text placeholder:text-sage-300 focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-sage-400 hover:text-earth-900 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary-dark text-white text-xs font-medium rounded-lg hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
          {isPending ? "Saving..." : initial ? "Update" : "Add Event"}
        </button>
      </div>
    </form>
  )
}

export function TimelineEventEditor({ personId, events, canEdit }: TimelineEventEditorProps) {
  const queryClient = useQueryClient()
  const [addingNew, setAddingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      await api.delete(`/timeline-events/${eventId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timeline-events", personId] })
    },
  })

  return (
    <div className="space-y-3">
      {/* Event list */}
      {events.map((event) => {
        if (editingId === event.id) {
          return (
            <EventForm
              key={event.id}
              initial={event}
              personId={personId}
              onClose={() => setEditingId(null)}
            />
          )
        }

        return (
          <div
            key={event.id}
            className="flex items-start gap-3 bg-white/70 dark:bg-dark-card/70 border border-sage-200 dark:border-dark-border rounded-xl p-3 group"
          >
            {canEdit && (
              <GripVertical className="h-4 w-4 text-sage-300 dark:text-dark-border mt-0.5 flex-shrink-0 cursor-grab" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-earth-900 dark:text-dark-text">{event.title}</p>
                {event.event_type && (
                  <span className="text-[9px] font-medium text-sage-400 bg-sage-50 dark:bg-dark-surface px-1.5 py-0.5 rounded">{event.event_type}</span>
                )}
              </div>
              {event.event_date && (
                <p className="text-xs text-sage-400 dark:text-dark-text-muted mt-0.5">
                  {event.event_date_approx ? "c. " : ""}{event.event_date}
                </p>
              )}
              {event.description && (
                <p className="text-xs text-sage-400 dark:text-dark-text-muted mt-1 line-clamp-2">{event.description}</p>
              )}
            </div>
            {canEdit && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => setEditingId(event.id)}
                  className="p-1 text-sage-300 hover:text-primary-dark transition-colors"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(event.id)}
                  className="p-1 text-sage-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Add new form */}
      {addingNew ? (
        <EventForm personId={personId} onClose={() => setAddingNew(false)} />
      ) : canEdit ? (
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary-dark dark:text-primary hover:text-primary transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Timeline Event
        </button>
      ) : null}

      {events.length === 0 && !addingNew && (
        <p className="text-sage-400 dark:text-dark-text-muted text-sm text-center py-4">
          No timeline events recorded yet.
        </p>
      )}
    </div>
  )
}

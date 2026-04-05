import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useMutation } from "@tanstack/react-query"
import { Save, Loader2 } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"

export const Route = createFileRoute("/_authenticated/events/new")({
  component: NewEventPage,
})

function NewEventPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [locationText, setLocationText] = useState("")
  const [category, setCategory] = useState("reunion")
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceNote, setRecurrenceNote] = useState("")

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/events", {
        title, description: description || null,
        event_date: eventDate || null, end_date: endDate || null,
        location_text: locationText || null, category,
        is_recurring: isRecurring, recurrence_note: recurrenceNote || null,
        published: true,
      })
      return res.data
    },
    onSuccess: (data) => {
      navigate({ to: "/events/$eventId", params: { eventId: data.id } } as any)
    },
  })

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      <AppHeader />
      <div className="max-w-2xl mx-auto px-4 pt-20 pb-20 sm:pt-24 sm:pb-12">
        <h1 className="text-2xl font-bold text-earth-900 dark:text-dark-text mb-6">Create Event</h1>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-sage-600 dark:text-dark-text-muted mb-1">Event Name *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., 2026 Thirlwall Family Reunion"
              className="w-full rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-sage-600 dark:text-dark-text-muted mb-1">Start Date</label>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-sage-600 dark:text-dark-text-muted mb-1">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-sage-600 dark:text-dark-text-muted mb-1">Location</label>
            <input type="text" value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder="e.g., Brockville, Ontario"
              className="w-full rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
          </div>

          <div>
            <label className="block text-sm font-medium text-sage-600 dark:text-dark-text-muted mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-4 py-3 text-sm focus:outline-none">
              <option value="reunion">Reunion</option>
              <option value="wedding">Wedding</option>
              <option value="memorial">Memorial</option>
              <option value="celebration">Celebration</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)}
                className="rounded border-sage-300 text-primary-dark" />
              <span className="text-sm text-earth-900 dark:text-dark-text">Recurring event</span>
            </label>
            {isRecurring && (
              <input type="text" value={recurrenceNote} onChange={(e) => setRecurrenceNote(e.target.value)}
                placeholder="e.g., Annually in August" className="flex-1 rounded-lg border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-3 py-2 text-sm focus:outline-none" />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-sage-600 dark:text-dark-text-muted mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6}
              placeholder="Details, agenda, logistics, what to bring..."
              className="w-full rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20 resize-y" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-sage-200 dark:border-dark-border">
            <button onClick={() => navigate({ to: "/events" })} className="px-4 py-2.5 text-sm text-sage-400">Cancel</button>
            <button onClick={() => createMutation.mutate()}
              disabled={!title.trim() || createMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-dark text-white font-medium text-sm rounded-xl hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Create Event
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

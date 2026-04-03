import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { FileSearch, Plus, Loader2, Check, AlertTriangle, Lightbulb, CheckCircle } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { useAuthStore } from "../../stores/authStore"
import { cn } from "../../lib/utils"

export const Route = createFileRoute("/_authenticated/research")({
  component: ResearchPage,
})

interface ResearchNote {
  id: string; title: string; body: string; status: string
  person_id: string | null; person_name: string | null
  author_name: string; created_at: string; updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Lightbulb }> = {
  open: { label: "Open", color: "bg-blue-50 text-blue-700 border-blue-200", icon: FileSearch },
  lead: { label: "Lead", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Lightbulb },
  brick_wall: { label: "Brick Wall", color: "bg-red-50 text-red-700 border-red-200", icon: AlertTriangle },
  resolved: { label: "Resolved", color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle },
}

function ResearchPage() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [status, setStatus] = useState("open")
  const [statusFilter, setStatusFilter] = useState("")

  const { data: notes, isLoading } = useQuery<ResearchNote[]>({
    queryKey: ["research-notes", statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      const res = await api.get("/research", { params })
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/research", { title, body, status, author_id: user!.id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research-notes"] })
      setShowForm(false); setTitle(""); setBody(""); setStatus("open")
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      await api.put(`/research/${id}`, { status: newStatus })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["research-notes"] }) },
  })

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      <AppHeader />
      <div className="max-w-3xl mx-auto px-4 pt-20 pb-20 sm:pt-24 sm:pb-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <FileSearch className="h-7 w-7 text-primary-dark" />
          </div>
          <h1 className="text-3xl font-bold text-earth-900 dark:text-dark-text">Research Notes</h1>
          <p className="text-sage-400 dark:text-dark-text-muted mt-2">Track leads, brick walls, and breakthroughs in your genealogy research.</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-1 bg-white/80 dark:bg-dark-card/80 rounded-xl border border-sage-200 dark:border-dark-border p-1">
            {[{ value: "", label: "All" }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))].map((s) => (
              <button key={s.value} onClick={() => setStatusFilter(s.value)}
                className={cn("px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                  statusFilter === s.value ? "bg-primary/10 text-primary-dark" : "text-sage-400 hover:text-earth-900")}>
                {s.label}
              </button>
            ))}
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-earth-900 font-medium text-sm rounded-xl hover:bg-primary-dark hover:text-white transition-colors">
            <Plus className="h-4 w-4" /> Add Note
          </button>
        </div>

        {showForm && (
          <div className="bg-white dark:bg-dark-card rounded-xl border border-primary/30 p-5 mb-6 space-y-3">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Research topic or question"
              className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What you know, what you're looking for, sources checked..." rows={4}
              className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20 resize-none" />
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none">
              <option value="open">Open</option>
              <option value="lead">Lead</option>
              <option value="brick_wall">Brick Wall</option>
              <option value="resolved">Resolved</option>
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-sage-400">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!title.trim() || !body.trim()}
                className="px-4 py-1.5 bg-primary-dark text-white text-sm font-medium rounded-lg hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50">
                Save Note
              </button>
            </div>
          </div>
        )}

        {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

        <div className="space-y-3">
          {notes?.map((note) => {
            const cfg = STATUS_CONFIG[note.status] ?? STATUS_CONFIG.open!
            const Icon = cfg.icon
            return (
              <div key={note.id} className={cn("bg-white dark:bg-dark-card rounded-xl border p-4", cfg.color.split(" ").pop())}>
                <div className="flex items-start gap-3">
                  <Icon className={cn("h-4 w-4 flex-shrink-0 mt-1", cfg.color.split(" ")[1])} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border", cfg.color)}>{cfg.label}</span>
                      <h3 className="text-sm font-semibold text-earth-900 dark:text-dark-text">{note.title}</h3>
                    </div>
                    <p className="text-sm text-earth-800 dark:text-dark-text leading-relaxed whitespace-pre-wrap">{note.body}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-sage-400">
                      <span>{note.author_name}</span>
                      <span>{new Date(note.updated_at).toLocaleDateString()}</span>
                      {note.status !== "resolved" && (
                        <button onClick={() => updateStatusMutation.mutate({ id: note.id, newStatus: "resolved" })}
                          className="text-primary-dark hover:text-primary flex items-center gap-0.5 font-medium">
                          <Check className="h-2.5 w-2.5" /> Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {!isLoading && notes?.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border">
              <FileSearch className="h-10 w-10 text-sage-300 mx-auto mb-3" />
              <p className="text-sage-400 text-sm">No research notes yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

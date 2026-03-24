import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { MessageSquare, Plus, Loader2, User, Trash2 } from "lucide-react"
import { api } from "../../lib/api"
import { useAuthStore } from "../../stores/authStore"

interface Memory {
  id: string
  person_id: string
  author_id: string
  author_name: string
  author_avatar_url: string | null
  body: string
  photo_s3_key: string | null
  created_at: string
}

interface ShareMemoryProps {
  personId: string
  personName: string
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 30) return `${diffDays} days ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

export function ShareMemory({ personId, personName }: ShareMemoryProps) {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [body, setBody] = useState("")

  const { data: memories, isLoading } = useQuery<Memory[]>({
    queryKey: ["memories", personId],
    queryFn: async () => {
      const res = await api.get("/memories", { params: { person_id: personId } })
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/memories", {
        person_id: personId,
        author_id: user!.id,
        body,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories", personId] })
      setBody("")
      setShowForm(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (memoryId: string) => {
      await api.delete(`/memories/${memoryId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories", personId] })
    },
  })

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-sage-600 dark:text-dark-text-muted">
          <MessageSquare className="h-4 w-4" />
          Family Memories
          {memories && memories.length > 0 && (
            <span className="bg-primary/10 text-primary-dark px-1.5 py-0.5 rounded-full text-[10px] font-bold ml-1">
              {memories.length}
            </span>
          )}
        </h3>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-dark dark:text-primary hover:text-primary transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Share a Memory
          </button>
        )}
      </div>

      {/* Share form */}
      {showForm && (
        <div className="bg-white dark:bg-dark-card rounded-xl border border-primary/30 p-4 space-y-3">
          <p className="text-sm text-earth-900 dark:text-dark-text font-medium">
            Share a memory of {personName}
          </p>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`"I remember when ${personName.split(" ")[0]}..."`}
            rows={3}
            className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2.5 text-sm text-earth-900 dark:text-dark-text placeholder:text-sage-300 focus:outline-none focus:ring-2 focus:ring-primary-dark/20 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setBody("") }} className="px-3 py-1.5 text-xs text-sage-400 hover:text-earth-900 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !body.trim()}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary-dark text-white text-xs font-medium rounded-lg hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Share Memory
            </button>
          </div>
        </div>
      )}

      {/* Memories list */}
      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-sage-400" />
        </div>
      )}

      {memories && memories.length > 0 && (
        <div className="space-y-3">
          {memories.map((m) => (
            <div key={m.id} className="bg-white/70 dark:bg-dark-card/70 backdrop-blur-sm border border-sage-200 dark:border-dark-border rounded-xl p-4 group">
              <div className="flex items-start gap-3">
                {m.author_avatar_url ? (
                  <img src={m.author_avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-sage-100 dark:bg-dark-surface flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-sage-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-earth-900 dark:text-dark-text">{m.author_name}</p>
                    <span className="text-[10px] text-sage-300 dark:text-dark-text-muted">{timeAgo(m.created_at)}</span>
                  </div>
                  <p className="text-sm text-earth-800 dark:text-dark-text mt-1 leading-relaxed whitespace-pre-wrap">{m.body}</p>
                  {m.photo_s3_key && (
                    <img src={`/media/${m.photo_s3_key}`} alt="" className="mt-2 rounded-lg max-h-48 object-cover border border-sage-200 dark:border-dark-border" />
                  )}
                </div>
                {user?.id === m.author_id && (
                  <button
                    onClick={() => deleteMutation.mutate(m.id)}
                    className="p-1 text-sage-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && memories?.length === 0 && !showForm && (
        <div className="bg-white/70 dark:bg-dark-card/70 border border-sage-200 dark:border-dark-border rounded-xl p-6 text-center">
          <MessageSquare className="h-8 w-8 text-sage-300 mx-auto mb-2" />
          <p className="text-sage-400 text-sm">No memories shared yet.</p>
          <p className="text-sage-300 text-xs mt-1">Be the first to share a memory of {personName}.</p>
        </div>
      )}
    </section>
  )
}

import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { MessageCircle, Plus, Check, Loader2, ChevronDown, Send } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { useAuthStore } from "../../stores/authStore"
import { cn } from "../../lib/utils"

export const Route = createFileRoute("/_authenticated/questions")({
  component: QuestionsPage,
})

interface Question {
  id: string; title: string; body: string | null; person_id: string | null
  person_name: string | null; author_name: string; is_resolved: boolean
  answer_count: number; created_at: string
}

interface Answer {
  id: string; body: string; author_name: string; created_at: string
}

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days}d ago`
  return new Date(d).toLocaleDateString()
}

function QuestionsPage() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState("")
  const [filterResolved, setFilterResolved] = useState(false)

  const { data: questions, isLoading } = useQuery<Question[]>({
    queryKey: ["questions", filterResolved],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (!filterResolved) params.is_resolved = "false"
      const res = await api.get("/questions", { params })
      return res.data
    },
  })

  const { data: expandedAnswers } = useQuery<Answer[]>({
    queryKey: ["question-answers", expandedId],
    queryFn: async () => {
      const res = await api.get(`/questions/${expandedId}`)
      return res.data.answers ?? []
    },
    enabled: !!expandedId,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/questions", { title, body: body || null, author_id: user!.id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions"] })
      setShowForm(false); setTitle(""); setBody("")
    },
  })

  const answerMutation = useMutation({
    mutationFn: async (questionId: string) => {
      await api.post(`/questions/${questionId}/answers`, { body: answerText, author_id: user!.id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["question-answers", expandedId] })
      queryClient.invalidateQueries({ queryKey: ["questions"] })
      setAnswerText("")
    },
  })

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => { await api.put(`/questions/${id}/resolve`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["questions"] }) },
  })

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      <AppHeader />
      <div className="max-w-3xl mx-auto px-4 pt-20 pb-20 sm:pt-24 sm:pb-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <MessageCircle className="h-7 w-7 text-primary-dark" />
          </div>
          <h1 className="text-3xl font-bold text-earth-900 dark:text-dark-text">Ask the Family</h1>
          <p className="text-sage-400 dark:text-dark-text-muted mt-2">Post questions, share what you know, and discover answers together.</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <label className="flex items-center gap-2 text-sm text-earth-900 dark:text-dark-text">
            <input type="checkbox" checked={filterResolved} onChange={(e) => setFilterResolved(e.target.checked)}
              className="rounded border-sage-300 text-primary-dark" />
            Show answered
          </label>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-earth-900 font-medium text-sm rounded-xl hover:bg-primary-dark hover:text-white transition-colors">
            <Plus className="h-4 w-4" /> Ask a Question
          </button>
        </div>

        {showForm && (
          <div className="bg-white dark:bg-dark-card rounded-xl border border-primary/30 p-5 mb-6 space-y-3">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Your question..."
              className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add more detail (optional)" rows={3}
              className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20 resize-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-sage-400">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!title.trim() || createMutation.isPending}
                className="flex items-center gap-1 px-4 py-1.5 bg-primary-dark text-white text-sm font-medium rounded-lg hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50">
                Post Question
              </button>
            </div>
          </div>
        )}

        {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

        <div className="space-y-3">
          {questions?.map((q) => (
            <div key={q.id} className={cn("bg-white dark:bg-dark-card rounded-xl border overflow-hidden", q.is_resolved ? "border-sage-200 dark:border-dark-border" : "border-primary/20")}>
              <button onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors">
                <MessageCircle className={cn("h-4 w-4 flex-shrink-0 mt-1", q.is_resolved ? "text-sage-300" : "text-primary")} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-earth-900 dark:text-dark-text">{q.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-sage-400">
                    <span>{q.author_name}</span>
                    <span>\u2022</span>
                    <span>{timeAgo(q.created_at)}</span>
                    <span>\u2022</span>
                    <span>{q.answer_count} answer{q.answer_count !== 1 ? "s" : ""}</span>
                    {q.is_resolved && <span className="bg-primary/10 text-primary-dark px-1.5 py-0.5 rounded-full font-bold">Answered</span>}
                  </div>
                </div>
                <ChevronDown className={cn("h-3.5 w-3.5 text-sage-300 transition-transform", expandedId === q.id && "rotate-180")} />
              </button>

              {expandedId === q.id && (
                <div className="px-4 pb-4 border-t border-sage-100 dark:border-dark-border space-y-3">
                  {q.body && <p className="text-sm text-earth-800 dark:text-dark-text pt-3">{q.body}</p>}

                  {expandedAnswers && expandedAnswers.length > 0 && (
                    <div className="space-y-2 pt-2">
                      {expandedAnswers.map((a) => (
                        <div key={a.id} className="bg-sage-50 dark:bg-dark-surface rounded-lg p-3">
                          <p className="text-sm text-earth-800 dark:text-dark-text">{a.body}</p>
                          <p className="text-[10px] text-sage-300 mt-1">{a.author_name} \u2022 {timeAgo(a.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <input type="text" value={answerText} onChange={(e) => setAnswerText(e.target.value)} placeholder="Write an answer..."
                      className="flex-1 rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
                    <button onClick={() => answerMutation.mutate(q.id)} disabled={!answerText.trim() || answerMutation.isPending}
                      className="px-3 py-2 bg-primary-dark text-white rounded-lg hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50">
                      <Send className="h-4 w-4" />
                    </button>
                  </div>

                  {!q.is_resolved && (
                    <button onClick={() => resolveMutation.mutate(q.id)}
                      className="text-xs text-primary-dark hover:text-primary flex items-center gap-1 transition-colors">
                      <Check className="h-3 w-3" /> Mark as answered
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {!isLoading && questions?.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border">
              <MessageCircle className="h-10 w-10 text-sage-300 mx-auto mb-3" />
              <p className="text-sage-400 text-sm">No questions yet. Be the first to ask!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

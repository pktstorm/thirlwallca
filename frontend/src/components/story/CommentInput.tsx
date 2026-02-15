import { useState } from "react"
import { Send } from "lucide-react"

interface CommentInputProps {
  onSubmit: (body: string) => void
  isSubmitting: boolean
  placeholder?: string
  autoFocus?: boolean
}

export function CommentInput({
  onSubmit,
  isSubmitting,
  placeholder = "Share your thoughts with the family...",
  autoFocus = false,
}: CommentInputProps) {
  const [body, setBody] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setBody("")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={3}
        className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-surface px-4 py-3 text-sm text-earth-900 dark:text-dark-text placeholder-sage-300 dark:placeholder-dark-text-muted focus:border-primary dark:focus:border-primary focus:ring-2 focus:ring-primary/20 dark:focus:ring-primary/30 focus:outline-none resize-none transition-colors"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || !body.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary dark:bg-primary px-4 py-2 text-sm font-bold uppercase tracking-wider text-earth-900 dark:text-earth-900 transition-colors hover:bg-primary-dark hover:text-white dark:hover:bg-primary-dark dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="h-4 w-4" />
          {isSubmitting ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  )
}

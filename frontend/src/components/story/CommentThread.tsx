import { useState } from "react"
import { Heart, Reply, User } from "lucide-react"
import type { Comment } from "../../types/comment"
import { CommentInput } from "./CommentInput"

interface CommentThreadProps {
  comment: Comment
  currentUserId: string | undefined
  onLike: (commentId: string) => void
  onReply: (body: string, parentCommentId: string) => void
  isReplying: boolean
  depth?: number
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMinutes < 1) return "just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: diffDays > 365 ? "numeric" : undefined,
  })
}

export function CommentThread({
  comment,
  currentUserId,
  onLike,
  onReply,
  isReplying,
  depth = 0,
}: CommentThreadProps) {
  const [showReplyInput, setShowReplyInput] = useState(false)
  const isOwnComment = currentUserId === comment.authorId
  const maxNestingDepth = 3

  const handleReply = (body: string) => {
    onReply(body, comment.id)
    setShowReplyInput(false)
  }

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-sage-100 dark:border-dark-border pl-4" : ""}>
      <div className="group py-3">
        {/* Author row */}
        <div className="flex items-center gap-2.5 mb-1.5">
          {comment.authorAvatarUrl ? (
            <img
              src={comment.authorAvatarUrl}
              alt={comment.authorName}
              className="h-7 w-7 rounded-full object-cover border border-sage-200 dark:border-dark-border flex-shrink-0"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-sage-100 dark:bg-dark-surface flex items-center justify-center flex-shrink-0">
              <User className="h-3.5 w-3.5 text-sage-400 dark:text-dark-text-muted" />
            </div>
          )}
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-sm font-semibold text-earth-900 dark:text-dark-text truncate">
              {comment.authorName}
              {isOwnComment && (
                <span className="ml-1.5 text-xs font-normal text-primary-dark dark:text-primary">
                  (you)
                </span>
              )}
            </span>
            <span className="text-xs text-sage-300 dark:text-dark-text-muted flex-shrink-0">
              {formatRelativeTime(comment.createdAt)}
            </span>
          </div>
        </div>

        {/* Body */}
        <p className="text-sm text-earth-800 dark:text-dark-text leading-relaxed pl-[2.375rem]">
          {comment.body}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-4 mt-2 pl-[2.375rem]">
          <button
            onClick={() => onLike(comment.id)}
            className={`inline-flex items-center gap-1 text-xs transition-colors ${
              comment.isLikedByMe
                ? "text-red-500 dark:text-red-400 font-semibold"
                : "text-sage-300 dark:text-dark-text-muted hover:text-red-400 dark:hover:text-red-400"
            }`}
          >
            <Heart
              className="h-3.5 w-3.5"
              fill={comment.isLikedByMe ? "currentColor" : "none"}
            />
            {comment.likesCount > 0 && (
              <span>{comment.likesCount}</span>
            )}
          </button>

          {depth < maxNestingDepth && (
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="inline-flex items-center gap-1 text-xs text-sage-300 dark:text-dark-text-muted hover:text-primary-dark dark:hover:text-primary transition-colors"
            >
              <Reply className="h-3.5 w-3.5" />
              Reply
            </button>
          )}
        </div>

        {/* Reply input */}
        {showReplyInput && (
          <div className="mt-3 pl-[2.375rem]">
            <CommentInput
              onSubmit={handleReply}
              isSubmitting={isReplying}
              placeholder="Write a reply..."
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-0">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onLike={onLike}
              onReply={onReply}
              isReplying={isReplying}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

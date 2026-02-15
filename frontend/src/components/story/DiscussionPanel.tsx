import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MessageCircle } from "lucide-react"
import { api } from "../../lib/api"
import { useAuthStore } from "../../stores/authStore"
import type { Comment } from "../../types/comment"
import { CommentInput } from "./CommentInput"
import { CommentThread } from "./CommentThread"

// ── API response type (snake_case) ──

interface CommentApiResponse {
  id: string
  body: string
  author_id: string
  person_id: string | null
  story_id: string | null
  media_id: string | null
  parent_comment_id: string | null
  likes_count: number
  created_at: string
  updated_at: string
}

// ── Mapper ──

function mapApiComment(data: CommentApiResponse, currentUserId: string | undefined): Comment {
  return {
    id: data.id,
    body: data.body,
    authorId: data.author_id,
    authorName: data.author_id === currentUserId ? "You" : "Family Member",
    authorAvatarUrl: null,
    personId: data.person_id,
    storyId: data.story_id,
    mediaId: data.media_id,
    parentCommentId: data.parent_comment_id,
    likesCount: data.likes_count,
    isLikedByMe: false,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

/**
 * Nest flat comments by parentCommentId into a tree structure.
 */
function nestComments(flat: Comment[]): Comment[] {
  const map = new Map<string, Comment>()
  const roots: Comment[] = []

  for (const c of flat) {
    map.set(c.id, { ...c, replies: [] })
  }

  for (const c of flat) {
    const node = map.get(c.id)!
    if (c.parentCommentId) {
      const parent = map.get(c.parentCommentId)
      if (parent) {
        parent.replies = parent.replies ?? []
        parent.replies.push(node)
      } else {
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  }

  return roots
}

// ── Props ──

interface DiscussionPanelProps {
  storyId: string
  personId: string
}

export function DiscussionPanel({ storyId, personId }: DiscussionPanelProps) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  // ── Fetch comments ──
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["comments", "story", storyId],
    queryFn: async () => {
      const res = await api.get<CommentApiResponse[]>("/comments", {
        params: { story_id: storyId },
      })
      return res.data.map((c) => mapApiComment(c, user?.id))
    },
  })

  const nested = nestComments(comments)

  // ── Post comment ──
  const postMutation = useMutation({
    mutationFn: async ({
      body,
      parentCommentId,
    }: {
      body: string
      parentCommentId?: string
    }) => {
      await api.post("/comments", {
        body,
        author_id: user?.id,
        story_id: storyId,
        person_id: personId,
        parent_comment_id: parentCommentId ?? null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", "story", storyId] })
    },
  })

  // ── Like toggle ──
  const likeMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await api.post<{ action: "liked" | "unliked"; likes_count: number }>(
        `/comments/${commentId}/like`,
      )
      return { commentId, ...res.data }
    },
    onMutate: async (commentId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["comments", "story", storyId] })
      const previous = queryClient.getQueryData<Comment[]>(["comments", "story", storyId])

      queryClient.setQueryData<Comment[]>(["comments", "story", storyId], (old) => {
        if (!old) return old
        return old.map((c) =>
          c.id === commentId
            ? {
                ...c,
                isLikedByMe: !c.isLikedByMe,
                likesCount: c.isLikedByMe ? c.likesCount - 1 : c.likesCount + 1,
              }
            : c,
        )
      })

      return { previous }
    },
    onError: (_err, _commentId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["comments", "story", storyId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", "story", storyId] })
    },
  })

  const handlePost = (body: string) => {
    postMutation.mutate({ body })
  }

  const handleReply = (body: string, parentCommentId: string) => {
    postMutation.mutate({ body, parentCommentId })
  }

  const handleLike = (commentId: string) => {
    likeMutation.mutate(commentId)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-sage-200 dark:border-dark-border">
        <MessageCircle className="h-5 w-5 text-primary-dark dark:text-primary" />
        <h2 className="text-base font-bold text-earth-900 dark:text-dark-text">Family Discussion</h2>
        {comments.length > 0 && (
          <span className="ml-auto text-xs font-medium text-sage-300 dark:text-dark-text-muted bg-sage-50 dark:bg-dark-surface px-2 py-0.5 rounded-full">
            {comments.length}
          </span>
        )}
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
        {commentsLoading && (
          <div className="flex flex-col items-center py-10">
            <div className="w-8 h-8 border-2 border-primary dark:border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sage-300 dark:text-dark-text-muted text-xs mt-3">Loading discussion...</p>
          </div>
        )}

        {!commentsLoading && nested.length === 0 && (
          <div className="text-center py-10">
            <MessageCircle className="h-10 w-10 text-sage-200 dark:text-dark-text-muted mx-auto mb-3" />
            <p className="text-sage-400 dark:text-dark-text-muted text-sm font-medium">No comments yet</p>
            <p className="text-sage-300 dark:text-dark-text-muted text-xs mt-1">
              Be the first to share your thoughts.
            </p>
          </div>
        )}

        {nested.map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            currentUserId={user?.id}
            onLike={handleLike}
            onReply={handleReply}
            isReplying={postMutation.isPending}
          />
        ))}
      </div>

      {/* New comment input */}
      {user && (
        <div className="border-t border-sage-200 dark:border-dark-border px-5 py-4 bg-sage-50/50 dark:bg-dark-surface/50">
          <CommentInput onSubmit={handlePost} isSubmitting={postMutation.isPending} />
        </div>
      )}
    </div>
  )
}

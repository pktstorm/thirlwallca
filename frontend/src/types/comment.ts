export interface Comment {
  id: string
  body: string
  authorId: string
  authorName: string
  authorAvatarUrl: string | null
  personId: string | null
  storyId: string | null
  mediaId: string | null
  parentCommentId: string | null
  likesCount: number
  isLikedByMe: boolean
  createdAt: string
  updatedAt: string
  replies?: Comment[]
}

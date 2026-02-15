export type UserRole = "admin" | "editor" | "viewer"

export interface User {
  id: string
  email: string
  displayName: string
  role: UserRole
  linkedPersonId: string | null
  avatarUrl: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

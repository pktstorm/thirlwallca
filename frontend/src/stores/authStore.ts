import { create } from "zustand"
import { signOut } from "aws-amplify/auth"

interface User {
  id: string
  email: string
  displayName: string
  role: "admin" | "editor" | "viewer"
  linkedPersonId: string | null
  avatarUrl: string | null
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setLinkedPersonId: (personId: string | null) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setLinkedPersonId: (personId) =>
    set((s) => ({
      user: s.user ? { ...s.user, linkedPersonId: personId } : null,
    })),
  logout: async () => {
    try {
      await signOut()
    } catch {
      // Ignore errors — clear local state regardless
    }
    set({ user: null, isAuthenticated: false, isLoading: false })
  },
}))

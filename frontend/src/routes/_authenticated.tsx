import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { UserPlus, X } from "lucide-react"
import { fetchAuthSession } from "aws-amplify/auth"
import { api } from "../lib/api"
import { useAuthStore } from "../stores/authStore"
import { NavSidebar } from "../components/layout/NavSidebar"
import { MobileBottomNav } from "../components/layout/MobileBottomNav"

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    try {
      const session = await fetchAuthSession()
      if (!session.tokens) {
        throw redirect({ to: "/login" })
      }
    } catch (e: any) {
      if (e.to === "/login") throw e
      throw redirect({ to: "/login" })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [dismissedLinkBanner, setDismissedLinkBanner] = useState(
    () => localStorage.getItem("dismissed_link_banner") === "1",
  )

  // Bootstrap user profile on mount if not already loaded
  useEffect(() => {
    if (user) return

    let cancelled = false
    api
      .get("/auth/me")
      .then(({ data }) => {
        if (cancelled) return
        setUser({
          id: data.id,
          email: data.email,
          displayName: data.display_name,
          role: data.role,
          linkedPersonId: data.linked_person_id,
          avatarUrl: data.avatar_url,
        })
      })
      .catch(() => {
        // Token is invalid — the 401 interceptor will redirect to login
      })

    return () => {
      cancelled = true
    }
  }, [user, setUser])

  const handleDismissBanner = () => {
    setDismissedLinkBanner(true)
    localStorage.setItem("dismissed_link_banner", "1")
  }

  return (
    <>
      <NavSidebar />
      {/* Onboarding banner for users not yet linked to a person */}
      {user && !user.linkedPersonId && !dismissedLinkBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary/10 dark:bg-primary/5 border-b border-primary/20 dark:border-primary/10 px-4 py-2.5 flex items-center justify-center gap-3">
          <UserPlus className="h-4 w-4 text-primary-dark dark:text-primary shrink-0" />
          <p className="text-sm text-earth-800 dark:text-dark-text">
            Find yourself in the family tree and click{" "}
            <strong className="text-primary-dark dark:text-primary">&ldquo;This Is Me&rdquo;</strong>{" "}
            on your profile to unlock personalized features.
          </p>
          <button
            onClick={handleDismissBanner}
            className="p-1 rounded-lg text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text hover:bg-sage-100 dark:hover:bg-dark-surface transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <Outlet />
      <MobileBottomNav />
    </>
  )
}

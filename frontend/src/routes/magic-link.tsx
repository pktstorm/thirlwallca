import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { TreePine, Loader2, CheckCircle, XCircle } from "lucide-react"
import { api } from "../lib/api"
import { useAuthStore } from "../stores/authStore"

type MagicLinkSearch = {
  token?: string
  email?: string
}

export const Route = createFileRoute("/magic-link")({
  validateSearch: (search: Record<string, unknown>): MagicLinkSearch => ({
    token: search.token as string | undefined,
    email: search.email as string | undefined,
  }),
  component: MagicLinkPage,
})

function MagicLinkPage() {
  const navigate = useNavigate()
  const { token, email } = Route.useSearch()
  const setUser = useAuthStore((s) => s.setUser)

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !email) {
      setStatus("error")
      setError("Invalid magic link. Please request a new one.")
      return
    }

    let cancelled = false

    const verify = async () => {
      try {
        const { data } = await api.post("/auth/magic-link/verify", {
          email,
          code: token,
        })

        if (cancelled) return

        // Store ID token (has email + custom:role claims) for API auth
        localStorage.setItem("access_token", data.id_token || data.access_token)
        if (data.refresh_token) {
          localStorage.setItem("refresh_token", data.refresh_token)
        }
        // Fetch user profile
        const { data: meData } = await api.get("/auth/me")
        setUser({
          id: meData.id,
          email: meData.email,
          displayName: meData.display_name,
          role: meData.role,
          linkedPersonId: meData.linked_person_id,
          avatarUrl: meData.avatar_url,
        })
        setStatus("success")

        // Brief pause to show success state, then redirect
        setTimeout(() => {
          if (!cancelled) {
            navigate({ to: "/tree" })
          }
        }, 1500)
      } catch (err: any) {
        if (cancelled) return

        const message =
          err.response?.data?.detail ||
          err.response?.data?.message ||
          "This magic link is invalid or has expired. Please request a new one."
        setStatus("error")
        setError(message)
      }
    }

    verify()

    return () => {
      cancelled = true
    }
  }, [token, email, navigate, setUser])

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
      {/* Background image */}
      <img
        src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80"
        alt=""
        className="absolute inset-0 z-0 h-full w-full object-cover"
      />
      {/* Dark overlay with green tint */}
      <div className="absolute inset-0 z-[1] bg-bg-dark/70" />

      {/* Content */}
      <main className="relative z-10 w-full max-w-md px-4 py-12">
        {/* Logo header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 backdrop-blur-sm">
            <TreePine className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">
            Thirlwall.ca
          </h1>
          <p className="mt-1 text-slate-200 drop-shadow-md">
            Explore the roots of your history
          </p>
        </div>

        {/* Glass card */}
        <div className="glass-card rounded-xl p-8">
          {/* Loading state */}
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary-dark dark:text-primary" />
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-dark-text">
                  Verifying your magic link
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-muted">
                  Please wait while we sign you in...
                </p>
              </div>
            </div>
          )}

          {/* Success state */}
          {status === "success" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                <CheckCircle className="h-8 w-8 text-primary-dark dark:text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-dark-text">
                  You're signed in!
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-muted">
                  Redirecting you now...
                </p>
              </div>
            </div>
          )}

          {/* Error state */}
          {status === "error" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-dark-text">
                  Verification failed
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-muted">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate({ to: "/login" })}
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary-dark px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary hover:text-gray-900 dark:hover:text-earth-900"
              >
                Back to sign in
              </button>
            </div>
          )}

          {/* Bottom text */}
          <p className="mt-4 text-center text-xs text-gray-400 dark:text-dark-text-muted">
            This is a private family site.
          </p>
        </div>
      </main>
    </div>
  )
}

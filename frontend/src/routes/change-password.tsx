import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Lock, Loader2, CheckCircle } from "lucide-react"
import { confirmSignIn } from "aws-amplify/auth"
import { api } from "../lib/api"
import { useAuthStore } from "../stores/authStore"

export const Route = createFileRoute("/change-password")({
  component: ChangePasswordPage,
})

function ChangePasswordPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const passwordValid =
    newPassword.length >= 8 &&
    /[a-z]/.test(newPassword) &&
    /[A-Z]/.test(newPassword) &&
    /\d/.test(newPassword)

  const passwordsMatch = newPassword === confirmPassword && newPassword !== ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordValid || !passwordsMatch) return

    setError(null)
    setIsLoading(true)

    try {
      const result = await confirmSignIn({
        challengeResponse: newPassword,
      })

      if (!result.isSignedIn) {
        setError("Password change did not complete. Please try again.")
        return
      }

      setSuccess(true)

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

      setTimeout(() => {
        navigate({ to: "/tree" })
      }, 1500)
    } catch (err: any) {
      setError(err.message || "Failed to change password. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
      {/* Background image */}
      <img
        src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80"
        alt=""
        className="absolute inset-0 z-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 z-[1] bg-bg-dark/70" />

      <main className="relative z-10 w-full max-w-md px-4 py-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src="/logo.png"
            alt="Thirlwall Family Crest"
            className="mb-4 h-24 w-auto drop-shadow-lg"
          />
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">
            Thirlwall.ca
          </h1>
        </div>

        <div className="glass-card rounded-xl p-8">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                <CheckCircle className="h-8 w-8 text-primary-dark dark:text-primary" />
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-dark-text">
                Password updated!
              </p>
              <p className="text-sm text-gray-500 dark:text-dark-text-muted">
                Redirecting you now...
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-dark-text">
                Set your password
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-muted">
                Please choose a new password to continue.
              </p>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="new-password"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-muted"
                  >
                    New password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="new-password"
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-text-muted focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-muted"
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="confirm-password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-text-muted focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
                    />
                  </div>
                </div>

                {/* Password requirements */}
                <div className="space-y-1 text-xs">
                  <p
                    className={
                      newPassword.length >= 8
                        ? "text-primary-dark dark:text-primary"
                        : "text-gray-400 dark:text-dark-text-muted"
                    }
                  >
                    {newPassword.length >= 8 ? "\u2713" : "\u2022"} At least 8
                    characters
                  </p>
                  <p
                    className={
                      /[a-z]/.test(newPassword)
                        ? "text-primary-dark dark:text-primary"
                        : "text-gray-400 dark:text-dark-text-muted"
                    }
                  >
                    {/[a-z]/.test(newPassword) ? "\u2713" : "\u2022"} One
                    lowercase letter
                  </p>
                  <p
                    className={
                      /[A-Z]/.test(newPassword)
                        ? "text-primary-dark dark:text-primary"
                        : "text-gray-400 dark:text-dark-text-muted"
                    }
                  >
                    {/[A-Z]/.test(newPassword) ? "\u2713" : "\u2022"} One
                    uppercase letter
                  </p>
                  <p
                    className={
                      /\d/.test(newPassword)
                        ? "text-primary-dark dark:text-primary"
                        : "text-gray-400 dark:text-dark-text-muted"
                    }
                  >
                    {/\d/.test(newPassword) ? "\u2713" : "\u2022"} One number
                  </p>
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-red-500">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !passwordValid || !passwordsMatch}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-dark py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary hover:text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {isLoading ? "Updating..." : "Set password"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { Lock, Loader2, CheckCircle } from "lucide-react"
import { updatePassword } from "aws-amplify/auth"
import { AppHeader } from "../../components/layout/AppHeader"

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
})

function SettingsPage() {
  const [oldPassword, setOldPassword] = useState("")
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordValid || !passwordsMatch) return

    setError(null)
    setIsLoading(true)

    try {
      await updatePassword({ oldPassword, newPassword })
      setSuccess(true)
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || "Failed to change password.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-dark-bg">
      <AppHeader hideSearch />

      <main className="mx-auto max-w-2xl px-4 pt-20 pb-12">
        <h1 className="text-xl sm:text-2xl font-bold text-earth-900 dark:text-dark-text">
          Settings
        </h1>

        {/* Change Password Section */}
        <div className="mt-8 rounded-xl bg-white dark:bg-dark-card border border-sage-200 dark:border-dark-border p-6">
          <h2 className="text-lg font-semibold text-earth-900 dark:text-dark-text">
            Change Password
          </h2>
          <p className="mt-1 text-sm text-sage-500 dark:text-dark-text-muted">
            Update your password to keep your account secure.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary-dark dark:text-primary">
              <CheckCircle className="h-4 w-4 shrink-0" />
              Password updated successfully.
            </div>
          )}

          <form
            onSubmit={handleChangePassword}
            className="mt-6 space-y-4 max-w-sm"
          >
            <div>
              <label
                htmlFor="old-password"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-muted"
              >
                Current password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="old-password"
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-text-muted focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="settings-new-password"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-muted"
              >
                New password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="settings-new-password"
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
                htmlFor="settings-confirm-password"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-muted"
              >
                Confirm new password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="settings-confirm-password"
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
                {/[a-z]/.test(newPassword) ? "\u2713" : "\u2022"} One lowercase
                letter
              </p>
              <p
                className={
                  /[A-Z]/.test(newPassword)
                    ? "text-primary-dark dark:text-primary"
                    : "text-gray-400 dark:text-dark-text-muted"
                }
              >
                {/[A-Z]/.test(newPassword) ? "\u2713" : "\u2022"} One uppercase
                letter
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
              disabled={
                isLoading || !passwordValid || !passwordsMatch || !oldPassword
              }
              className="flex items-center justify-center gap-2 rounded-lg bg-primary-dark px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary hover:text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {isLoading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

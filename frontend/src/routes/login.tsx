import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useState } from "react"
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react"
import { signIn, signOut } from "aws-amplify/auth"
import { api } from "../lib/api"
import { useAuthStore } from "../stores/authStore"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Clear any stale sign-in session
      try { await signOut() } catch { /* ignore */ }

      const result = await signIn({
        username: email,
        password,
        options: { authFlowType: "USER_PASSWORD_AUTH" },
      })

      if (
        result.nextStep.signInStep ===
        "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED"
      ) {
        navigate({ to: "/change-password" })
        return
      }

      if (!result.isSignedIn) {
        setError("Sign-in was not completed. Please try again.")
        return
      }

      // Fetch user profile from backend
      const { data: meData } = await api.get("/auth/me")
      setUser({
        id: meData.id,
        email: meData.email,
        displayName: meData.display_name,
        role: meData.role,
        linkedPersonId: meData.linked_person_id,
        avatarUrl: meData.avatar_url,
      })
      navigate({ to: "/tree" })
    } catch (err: any) {
      const message =
        err.message || "Invalid email or password. Please try again."
      setError(message)
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
      {/* Dark overlay with green tint */}
      <div className="absolute inset-0 z-[1] bg-bg-dark/70" />

      {/* Content */}
      <main className="relative z-10 w-full max-w-md px-4 py-12">
        {/* Logo header - above card */}
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src="/logo.png"
            alt="Thirlwall Family Crest"
            className="mb-4 h-24 w-auto drop-shadow-lg"
          />
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">
            Thirlwall.ca
          </h1>
          <p className="mt-1 text-slate-200 drop-shadow-md">
            Explore the roots of your history
          </p>
        </div>

        {/* Glass card */}
        <div className="glass-card rounded-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-dark-text">
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-muted">
            Please enter your details to sign in.
          </p>

          {/* Error display */}
          {error && (
            <div className="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-muted"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-text-muted focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
                />
              </div>
            </div>

            {/* Password field with show/hide toggle */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-muted"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 pl-10 pr-10 text-sm text-gray-900 dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-text-muted focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Sign in button */}
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-dark py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary hover:text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200 dark:bg-dark-border" />
            <span className="text-xs text-gray-400 dark:text-dark-text-muted">or</span>
            <div className="h-px flex-1 bg-gray-200 dark:bg-dark-border" />
          </div>

          {/* Request Access button */}
          <Link
            to="/request-access"
            className="mt-4 flex w-full items-center justify-center rounded-lg border border-gray-200 dark:border-dark-border bg-white/50 dark:bg-dark-surface/50 py-2.5 text-sm font-medium text-gray-700 dark:text-dark-text transition-colors hover:bg-gray-50 dark:hover:bg-dark-surface hover:border-gray-300"
          >
            Request Access
          </Link>

          {/* Bottom text */}
          <p className="mt-6 text-center text-xs text-gray-400 dark:text-dark-text-muted">
            This is a private family site.
          </p>
        </div>
      </main>
    </div>
  )
}

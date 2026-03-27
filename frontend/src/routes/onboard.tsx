import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState, useEffect, useMemo } from "react"
import { Lock, Eye, EyeOff, Loader2, Search, Check, AlertCircle } from "lucide-react"
import { signIn, signOut } from "aws-amplify/auth"
import { api } from "../lib/api"
import { useAuthStore } from "../stores/authStore"

export const Route = createFileRoute("/onboard")({
  component: OnboardPage,
})

interface OnboardInfo {
  email: string
  first_name: string
  last_name: string
  valid: boolean
}

interface PersonOption {
  id: string
  first_name: string
  last_name: string
  birth_date: string | null
  gender: string
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Lowercase", met: /[a-z]/.test(password) },
    { label: "Uppercase", met: /[A-Z]/.test(password) },
    { label: "Number", met: /\d/.test(password) },
  ]
  const strength = checks.filter((c) => c.met).length

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= strength
                ? strength <= 2
                  ? "bg-red-400"
                  : strength === 3
                    ? "bg-yellow-400"
                    : "bg-primary"
                : "bg-gray-200 dark:bg-dark-border"
            }`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map((c) => (
          <span
            key={c.label}
            className={`text-[10px] flex items-center gap-0.5 ${
              c.met ? "text-primary-dark dark:text-primary" : "text-gray-400 dark:text-dark-text-muted"
            }`}
          >
            {c.met ? <Check className="h-2.5 w-2.5" /> : <span className="w-2.5" />}
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function OnboardPage() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const token = new URLSearchParams(window.location.search).get("token") ?? ""

  const [info, setInfo] = useState<OnboardInfo | null>(null)
  const [validating, setValidating] = useState(true)
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null)

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [personQuery, setPersonQuery] = useState("")
  const [personResults, setPersonResults] = useState<PersonOption[]>([])
  const [selectedPerson, setSelectedPerson] = useState<PersonOption | null>(null)
  const [searchingPersons, setSearchingPersons] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setInvalidMessage("No token provided. Please use the link from your email.")
      setValidating(false)
      return
    }

    api
      .get("/auth/onboard/validate", { params: { token } })
      .then(({ data }) => {
        setInfo(data)
        // Pre-populate person search with their name
        setPersonQuery(`${data.first_name} ${data.last_name}`)
      })
      .catch((err) => {
        setInvalidMessage(err.response?.data?.detail || "Invalid or expired link.")
      })
      .finally(() => setValidating(false))
  }, [token])

  // Search persons when query changes
  useEffect(() => {
    if (!personQuery.trim() || personQuery.trim().length < 2) {
      setPersonResults([])
      return
    }

    const timeout = setTimeout(async () => {
      setSearchingPersons(true)
      try {
        const { data } = await api.get("/search", {
          params: { q: personQuery, limit: 10 },
        })
        setPersonResults(
          data.map((p: any) => ({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            birth_date: p.birth_date,
            gender: p.gender,
          })),
        )
      } catch {
        setPersonResults([])
      } finally {
        setSearchingPersons(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [personQuery])

  const passwordValid = useMemo(() => {
    return (
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password)
    )
  }, [password])

  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordValid || !passwordsMatch) return

    setError(null)
    setIsSubmitting(true)

    try {
      // Complete onboarding
      await api.post("/auth/onboard/complete", {
        token,
        password,
        linked_person_id: selectedPerson?.id ?? null,
      })

      // Sign in with Amplify
      try { await signOut() } catch { /* ignore */ }
      const result = await signIn({
        username: info!.email,
        password,
        options: { authFlowType: "USER_PASSWORD_AUTH" },
      })

      if (!result.isSignedIn) {
        // Might need force change — try navigating to change-password
        if (result.nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
          navigate({ to: "/change-password" })
          return
        }
        setError("Account created but auto-login failed. Please sign in manually.")
        return
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
      navigate({ to: "/tree" })
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || "Something went wrong."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-50 dark:bg-bg-dark">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-sage-400 dark:text-dark-text-muted">Validating your link...</p>
        </div>
      </div>
    )
  }

  // Invalid token
  if (invalidMessage) {
    return (
      <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
        <img src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80" alt="" className="absolute inset-0 z-0 h-full w-full object-cover" />
        <div className="absolute inset-0 z-[1] bg-bg-dark/70" />
        <main className="relative z-10 w-full max-w-md px-4">
          <div className="glass-card rounded-xl p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text">Invalid Link</h2>
            <p className="text-sm text-gray-500 dark:text-dark-text-muted">{invalidMessage}</p>
            <a href="/login" className="inline-block text-sm font-medium text-primary-dark hover:text-primary transition-colors">
              Go to sign in
            </a>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center">
      <img src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=1920&q=80" alt="" className="absolute inset-0 z-0 h-full w-full object-cover" />
      <div className="absolute inset-0 z-[1] bg-bg-dark/70" />

      <main className="relative z-10 w-full max-w-md px-4 py-12">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/logo.png" alt="Thirlwall Family Crest" className="mb-4 h-20 w-auto drop-shadow-lg" />
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">Welcome, {info?.first_name}!</h1>
          <p className="mt-1 text-slate-200 drop-shadow-md">Set up your account to get started.</p>
        </div>

        <div className="glass-card rounded-xl p-8">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email (read-only) */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-muted">
                Email
              </label>
              <p className="text-sm text-gray-900 dark:text-dark-text bg-gray-50 dark:bg-dark-surface rounded-lg px-3 py-2.5 border border-gray-200 dark:border-dark-border">
                {info?.email}
              </p>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-muted">
                Create your password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder=""
                  className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 pl-10 pr-10 text-sm text-gray-900 dark:text-dark-text placeholder:text-gray-400 focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrength password={password} />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-muted">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder=""
                  className={`w-full rounded-lg border bg-white dark:bg-dark-surface py-2.5 pl-10 pr-10 text-sm text-gray-900 dark:text-dark-text placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-dark/20 ${
                    confirmPassword && !passwordsMatch
                      ? "border-red-300 focus:border-red-400"
                      : "border-gray-200 dark:border-dark-border focus:border-primary-dark"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="mt-1 text-xs text-red-500">Passwords don't match.</p>
              )}
            </div>

            {/* Person picker */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-muted">
                Which person are you on the family tree?
              </label>
              <p className="mb-2 text-xs text-gray-400 dark:text-dark-text-muted">
                Optional — you can set this later from your profile.
              </p>

              {selectedPerson ? (
                <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
                  <Check className="h-4 w-4 text-primary-dark flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-text">
                      {selectedPerson.first_name} {selectedPerson.last_name}
                    </p>
                    {selectedPerson.birth_date && (
                      <p className="text-xs text-gray-400">b. {selectedPerson.birth_date.split("-")[0]}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPerson(null)
                      setPersonQuery(info ? `${info.first_name} ${info.last_name}` : "")
                    }}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={personQuery}
                    onChange={(e) => setPersonQuery(e.target.value)}
                    placeholder="Search by name..."
                    className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-dark-text placeholder:text-gray-400 focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
                  />
                  {searchingPersons && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                  )}

                  {personResults.length > 0 && (
                    <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-lg">
                      {personResults.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPerson(p)
                              setPersonResults([])
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors"
                          >
                            <span className="font-medium text-gray-900 dark:text-dark-text">
                              {p.first_name} {p.last_name}
                            </span>
                            {p.birth_date && (
                              <span className="ml-2 text-xs text-gray-400">
                                b. {p.birth_date.split("-")[0]}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !passwordValid || !passwordsMatch}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-dark py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary hover:text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSubmitting ? "Setting up..." : "Complete Setup"}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

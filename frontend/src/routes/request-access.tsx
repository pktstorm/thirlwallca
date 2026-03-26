import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Mail, User, Loader2, ArrowLeft, CheckCircle, KeyRound } from "lucide-react"
import { api } from "../lib/api"

export const Route = createFileRoute("/request-access")({
  component: RequestAccessPage,
})

function RequestAccessPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [signupCode, setSignupCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const payload: Record<string, string> = {
        email,
        first_name: firstName,
        last_name: lastName,
      }
      if (signupCode.trim()) {
        payload.signup_code = signupCode.trim()
      }
      const { data } = await api.post("/auth/request-access", payload)

      // If auto-approved via signup code, redirect to onboard page
      if (data.auto_approved && data.onboard_token) {
        navigate({ to: `/onboard?token=${data.onboard_token}` } as any)
        return
      }

      setSuccessMessage(data.detail)
    } catch (err: any) {
      const message = err.response?.data?.detail || err.message || "Something went wrong. Please try again."
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
      <div className="absolute inset-0 z-[1] bg-bg-dark/70" />

      <main className="relative z-10 w-full max-w-md px-4 py-12">
        {/* Logo header */}
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
          {successMessage ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary-dark" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-text">
                Request Submitted
              </h2>
              <p className="text-sm text-gray-500 dark:text-dark-text-muted leading-relaxed">
                {successMessage}
              </p>
              <Link
                to="/login"
                className="mt-4 flex items-center gap-2 text-sm font-medium text-primary-dark hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-dark-text">
                Request Access
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-dark-text-muted">
                Submit your details and a family administrator will review your request.
              </p>

              {error && (
                <div className="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {/* First Name */}
                <div>
                  <label
                    htmlFor="firstName"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-muted"
                  >
                    First name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="firstName"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-text-muted focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
                    />
                  </div>
                </div>

                {/* Last Name */}
                <div>
                  <label
                    htmlFor="lastName"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-muted"
                  >
                    Last name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="lastName"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Thirlwall"
                      className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-text-muted focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
                    />
                  </div>
                </div>

                {/* Email */}
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

                {/* Signup code (optional) */}
                <div>
                  <label
                    htmlFor="signupCode"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-dark-text-muted"
                  >
                    Signup code <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="signupCode"
                      type="text"
                      value={signupCode}
                      onChange={(e) => setSignupCode(e.target.value)}
                      placeholder="Enter code if you have one"
                      className="w-full rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface py-2.5 pl-10 pr-4 text-sm text-gray-900 dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-text-muted focus:border-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400 dark:text-dark-text-muted">
                    If you received a signup code, enter it to skip the approval process.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-dark py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary hover:text-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {isLoading ? "Submitting..." : signupCode.trim() ? "Sign Up" : "Submit Request"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="text-sm font-medium text-gray-500 dark:text-dark-text-muted hover:text-primary-dark transition-colors"
                >
                  Already have an account? Sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

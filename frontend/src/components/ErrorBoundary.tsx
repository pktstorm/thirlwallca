import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle } from "lucide-react"

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-bg-light dark:bg-bg-dark p-4">
          <div className="max-w-md w-full bg-white dark:bg-dark-card rounded-2xl shadow-xl border border-sage-200 dark:border-dark-border p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-earth-900 dark:text-dark-text mb-3">
              Something went wrong
            </h1>
            <p className="text-sage-400 dark:text-dark-text-muted mb-6 text-sm leading-relaxed">
              {this.state.error?.message ||
                "An unexpected error occurred. Please try again."}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-primary text-earth-900 font-semibold rounded-xl hover:bg-primary-dark transition-colors text-sm shadow-sm"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  window.location.href = "/"
                }}
                className="px-5 py-2.5 bg-sage-100 dark:bg-sage-800 text-earth-800 dark:text-dark-text font-semibold rounded-xl hover:bg-sage-200 dark:hover:bg-sage-800/80 transition-colors text-sm"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

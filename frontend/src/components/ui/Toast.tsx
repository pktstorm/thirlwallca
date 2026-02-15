import { useEffect } from "react"
import { CheckCircle, XCircle, Info, X } from "lucide-react"
import { useToastStore, type ToastType } from "../../stores/toastStore"

const iconMap: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

const colorMap: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: {
    bg: "bg-green-50 dark:bg-green-950/50",
    icon: "text-green-500",
    border: "border-green-200 dark:border-green-800",
  },
  error: {
    bg: "bg-red-50 dark:bg-red-950/50",
    icon: "text-red-500",
    border: "border-red-200 dark:border-red-800",
  },
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/50",
    icon: "text-blue-500",
    border: "border-blue-200 dark:border-blue-800",
  },
}

function ToastItem({ id, type, message, duration }: {
  id: string
  type: ToastType
  message: string
  duration: number
}) {
  const removeToast = useToastStore((s) => s.removeToast)
  const Icon = iconMap[type]
  const colors = colorMap[type]

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(id)
    }, duration)
    return () => clearTimeout(timer)
  }, [id, duration, removeToast])

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md animate-slide-in-right ${colors.bg} ${colors.border}`}
    >
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${colors.icon}`} />
      <p className="text-sm text-earth-900 dark:text-dark-text flex-1">
        {message}
      </p>
      <button
        onClick={() => removeToast(id)}
        className="shrink-0 p-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-sage-400 dark:text-dark-text-muted"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[100] flex flex-col gap-2 sm:w-80">
      {toasts.map((t) => (
        <ToastItem
          key={t.id}
          id={t.id}
          type={t.type}
          message={t.message}
          duration={t.duration}
        />
      ))}
    </div>
  )
}

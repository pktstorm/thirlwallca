import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Check, X, Clock, Loader2, UserCheck, UserX, ChevronDown } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { useAuthStore } from "../../stores/authStore"

export const Route = createFileRoute("/_authenticated/admin/signup-requests")({
  component: SignupRequestsPage,
})

interface SignupRequest {
  id: string
  email: string
  first_name: string
  last_name: string
  status: "pending" | "approved" | "rejected"
  reviewed_by: string | null
  reviewed_at: string | null
  reject_reason: string | null
  created_at: string
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded-full">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      )
    case "approved":
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-primary-dark dark:text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          <UserCheck className="h-3 w-3" />
          Approved
        </span>
      )
    case "rejected":
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">
          <UserX className="h-3 w-3" />
          Rejected
        </span>
      )
    default:
      return null
  }
}

function SignupRequestsPage() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>("pending")
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const { data: requests, isLoading } = useQuery<SignupRequest[]>({
    queryKey: ["signup-requests", statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (statusFilter !== "all") params.status = statusFilter
      const res = await api.get("/admin/signup-requests", { params })
      return res.data
    },
  })

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/admin/signup-requests/${id}/approve`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signup-requests"] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string | null }) => {
      await api.post(`/admin/signup-requests/${id}/reject`, { reason })
    },
    onSuccess: () => {
      setRejectingId(null)
      setRejectReason("")
      queryClient.invalidateQueries({ queryKey: ["signup-requests"] })
    },
  })

  if (user?.role !== "admin") {
    return (
      <div className="h-screen w-screen bg-sage-50 dark:bg-bg-dark">
        <AppHeader />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p className="text-sage-400 dark:text-dark-text-muted">Admin access required.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen bg-sage-50 dark:bg-bg-dark overflow-auto">
      <AppHeader />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-earth-900 dark:text-dark-text">Signup Requests</h1>
            <p className="text-sm text-sage-400 dark:text-dark-text-muted mt-1">
              Review and approve family members requesting access.
            </p>
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-white dark:bg-dark-card border border-sage-200 dark:border-dark-border rounded-lg px-3 py-2 pr-8 text-sm text-earth-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-sage-400 pointer-events-none" />
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && requests?.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border">
            <p className="text-sage-400 dark:text-dark-text-muted">No {statusFilter === "all" ? "" : statusFilter} requests.</p>
          </div>
        )}

        <div className="space-y-3">
          {requests?.map((req) => (
            <div
              key={req.id}
              className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-earth-900 dark:text-dark-text">
                      {req.first_name} {req.last_name}
                    </h3>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-sm text-sage-400 dark:text-dark-text-muted mt-0.5">
                    {req.email}
                  </p>
                  <p className="text-xs text-sage-300 dark:text-dark-text-muted/50 mt-1">
                    Requested {new Date(req.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  {req.reject_reason && (
                    <p className="text-xs text-red-500 mt-1">Reason: {req.reject_reason}</p>
                  )}
                </div>

                {req.status === "pending" && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => approveMutation.mutate(req.id)}
                      disabled={approveMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-dark text-white text-sm font-medium rounded-lg hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50"
                    >
                      {approveMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingId(req.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-sage-200 dark:border-dark-border text-sage-400 dark:text-dark-text-muted text-sm font-medium rounded-lg hover:bg-red-50 hover:border-red-200 hover:text-red-600 dark:hover:bg-red-900/10 dark:hover:text-red-400 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                )}
              </div>

              {/* Reject reason dialog */}
              {rejectingId === req.id && (
                <div className="mt-3 pt-3 border-t border-sage-100 dark:border-dark-border space-y-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason for rejection (optional)"
                    className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm text-earth-900 dark:text-dark-text placeholder:text-sage-300 focus:outline-none focus:ring-2 focus:ring-primary-dark/20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => rejectMutation.mutate({ id: req.id, reason: rejectReason || null })}
                      disabled={rejectMutation.isPending}
                      className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {rejectMutation.isPending ? "..." : "Confirm Reject"}
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectReason("") }}
                      className="px-3 py-1.5 bg-sage-100 dark:bg-dark-surface text-sage-600 dark:text-dark-text-muted text-xs font-medium rounded-lg hover:bg-sage-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

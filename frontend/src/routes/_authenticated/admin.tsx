import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  Shield, Users, ScrollText, Check, X, Loader2, ChevronDown,
  UserCheck, Filter, KeyRound, Plus, Trash2, Copy, AlertTriangle, CheckCircle,
} from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { useAuthStore } from "../../stores/authStore"
import { cn } from "../../lib/utils"

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
})

type Tab = "users" | "codes" | "errors" | "audit"

// --- Types ---

interface SignupRequest {
  id: string; email: string; first_name: string; last_name: string
  status: "pending" | "approved" | "rejected"
  reviewed_at: string | null; reject_reason: string | null; created_at: string
}

interface AdminUser {
  id: string; email: string; display_name: string; role: string
  is_active: boolean; last_login_at: string | null
  linked_person_id: string | null; created_at: string
}

interface AuditLogEntry {
  id: string; user_id: string | null; user_name: string | null
  action: string; entity_type: string; entity_id: string | null
  entity_label: string | null; details: Record<string, unknown> | null
  created_at: string
}

interface AuditStats {
  total_entries: number; actions: Record<string, number>
  entity_types: Record<string, number>; top_users: { name: string; count: number }[]
}

// --- Helpers ---

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function actionBadge(action: string) {
  const colors: Record<string, string> = {
    create: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    update: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    delete: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    approve: "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400",
    reject: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    login: "bg-sage-50 text-sage-700 dark:bg-dark-surface dark:text-dark-text-muted",
  }
  return colors[action] ?? "bg-sage-50 text-sage-700"
}

function roleBadge(role: string) {
  const colors: Record<string, string> = {
    admin: "bg-primary/10 text-primary-dark",
    editor: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    viewer: "bg-sage-50 text-sage-600 dark:bg-dark-surface dark:text-dark-text-muted",
  }
  return colors[role] ?? "bg-sage-50 text-sage-600"
}

// --- Users Tab ---

function UsersTab() {
  const queryClient = useQueryClient()
  const [signupFilter, setSignupFilter] = useState("pending")
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const { data: signupRequests, isLoading: signupsLoading } = useQuery<SignupRequest[]>({
    queryKey: ["admin-signups", signupFilter],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (signupFilter !== "all") params.status = signupFilter
      const res = await api.get("/admin/signup-requests", { params })
      return res.data
    },
  })

  const { data: users, isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => { const res = await api.get("/admin/users"); return res.data },
  })

  const approveMutation = useMutation({
    mutationFn: async (id: string) => { await api.post(`/admin/signup-requests/${id}/approve`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-signups"] }) },
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string | null }) => {
      await api.post(`/admin/signup-requests/${id}/reject`, { reason })
    },
    onSuccess: () => { setRejectingId(null); setRejectReason(""); queryClient.invalidateQueries({ queryKey: ["admin-signups"] }) },
  })

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await api.put(`/admin/users/${userId}/role`, null, { params: { role } })
    },
    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-users"] })
      const prev = queryClient.getQueryData<AdminUser[]>(["admin-users"])
      queryClient.setQueryData<AdminUser[]>(["admin-users"], (old) =>
        old?.map((u) => u.id === userId ? { ...u, role } : u)
      )
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["admin-users"], context.prev)
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }) },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async (userId: string) => { await api.put(`/admin/users/${userId}/deactivate`) },
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: ["admin-users"] })
      const prev = queryClient.getQueryData<AdminUser[]>(["admin-users"])
      queryClient.setQueryData<AdminUser[]>(["admin-users"], (old) =>
        old?.map((u) => u.id === userId ? { ...u, is_active: !u.is_active } : u)
      )
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(["admin-users"], context.prev)
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }) },
  })

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => { await api.delete(`/admin/users/${userId}`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }) },
  })

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.post(`/admin/users/${userId}/reset-password`)
      return res.data
    },
  })

  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null)
  const [resetSuccessUserId, setResetSuccessUserId] = useState<string | null>(null)

  const pendingCount = signupRequests?.filter((r) => r.status === "pending").length ?? 0

  return (
    <div className="space-y-8">
      {/* Pending Signup Requests */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-earth-900 dark:text-dark-text flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Signup Requests
            {pendingCount > 0 && (
              <span className="bg-primary/10 text-primary-dark text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </h2>
          <select value={signupFilter} onChange={(e) => setSignupFilter(e.target.value)}
            className="text-xs bg-white dark:bg-dark-card border border-sage-200 dark:border-dark-border rounded-lg px-2 py-1.5 focus:outline-none">
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>

        {signupsLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}

        {signupRequests?.length === 0 && !signupsLoading && (
          <p className="text-sage-400 text-sm text-center py-6 bg-white/80 dark:bg-dark-card/80 rounded-xl border border-sage-200 dark:border-dark-border">No {signupFilter} requests.</p>
        )}

        <div className="space-y-2">
          {signupRequests?.map((req) => (
            <div key={req.id} className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-earth-900 dark:text-dark-text text-sm">{req.first_name} {req.last_name}</p>
                  <p className="text-xs text-sage-400">{req.email}</p>
                  <p className="text-[10px] text-sage-300 mt-1">{timeAgo(req.created_at)}</p>
                </div>
                {req.status === "pending" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => approveMutation.mutate(req.id)} disabled={approveMutation.isPending}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-primary-dark text-white text-xs font-medium rounded-lg hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50">
                      <Check className="h-3 w-3" /> Approve
                    </button>
                    <button onClick={() => setRejectingId(req.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 border border-sage-200 dark:border-dark-border text-sage-400 text-xs font-medium rounded-lg hover:text-red-600 hover:border-red-200 transition-colors">
                      <X className="h-3 w-3" /> Reject
                    </button>
                  </div>
                )}
                {req.status !== "pending" && (
                  <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                    req.status === "approved" ? "bg-primary/10 text-primary-dark" : "bg-red-50 text-red-600")}>
                    {req.status}
                  </span>
                )}
              </div>
              {rejectingId === req.id && (
                <div className="mt-3 pt-3 border-t border-sage-100 dark:border-dark-border flex gap-2">
                  <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason (optional)"
                    className="flex-1 rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-1.5 text-xs focus:outline-none" />
                  <button onClick={() => rejectMutation.mutate({ id: req.id, reason: rejectReason || null })}
                    className="px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600">Reject</button>
                  <button onClick={() => { setRejectingId(null); setRejectReason("") }}
                    className="px-3 py-1.5 bg-sage-100 dark:bg-dark-surface text-sage-600 text-xs rounded-lg">Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* All Users */}
      <section>
        <h2 className="text-lg font-bold text-earth-900 dark:text-dark-text flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-primary" /> All Users
        </h2>

        {usersLoading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}

        <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sage-200 dark:border-dark-border bg-sage-50/50 dark:bg-dark-surface/50">
                  <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-sage-400">User</th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-sage-400">Role</th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-sage-400">Last Login</th>
                  <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-sage-400">Status</th>
                  <th className="text-right px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-sage-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} className="border-b border-sage-100 dark:border-dark-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-earth-900 dark:text-dark-text">{u.display_name}</p>
                      <p className="text-xs text-sage-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => roleMutation.mutate({ userId: u.id, role: e.target.value })}
                        className={cn("text-[10px] font-bold uppercase px-2 py-1 rounded-lg border-0 cursor-pointer", roleBadge(u.role))}
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-sage-400">
                      {u.last_login_at ? timeAgo(u.last_login_at) : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                        u.is_active ? "bg-primary/10 text-primary-dark" : "bg-red-50 text-red-600")}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            resetPasswordMutation.mutate(u.id, {
                              onSuccess: () => { setResetSuccessUserId(u.id); setTimeout(() => setResetSuccessUserId(null), 3000) },
                            })
                          }}
                          disabled={resetPasswordMutation.isPending}
                          className="text-xs text-sage-400 hover:text-primary-dark transition-colors"
                          title="Send password reset email"
                        >
                          {resetSuccessUserId === u.id ? "Sent!" : "Reset PW"}
                        </button>
                        <button
                          onClick={() => toggleActiveMutation.mutate(u.id)}
                          className="text-xs text-sage-400 hover:text-amber-600 transition-colors"
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                        {confirmDeleteUserId === u.id ? (
                          <span className="flex items-center gap-1">
                            <button onClick={() => deleteUserMutation.mutate(u.id, { onSuccess: () => setConfirmDeleteUserId(null) })}
                              className="text-xs text-red-600 font-medium hover:text-red-700">Confirm</button>
                            <button onClick={() => setConfirmDeleteUserId(null)}
                              className="text-xs text-sage-400">Cancel</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteUserId(u.id)}
                            className="text-xs text-sage-300 hover:text-red-500 transition-colors"
                            title="Delete user permanently"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

// --- Audit Tab ---

function AuditTab() {
  const [actionFilter, setActionFilter] = useState("")
  const [entityFilter, setEntityFilter] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: logs, isLoading } = useQuery<AuditLogEntry[]>({
    queryKey: ["audit-logs", actionFilter, entityFilter, dateFrom, dateTo],
    queryFn: async () => {
      const params: Record<string, string> = { limit: "100" }
      if (actionFilter) params.action = actionFilter
      if (entityFilter) params.entity_type = entityFilter
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      const res = await api.get("/admin/audit-logs", { params })
      return res.data
    },
  })

  const { data: stats } = useQuery<AuditStats>({
    queryKey: ["audit-stats"],
    queryFn: async () => { const res = await api.get("/admin/audit-stats"); return res.data },
  })

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4 text-center">
            <p className="text-2xl font-bold text-earth-900 dark:text-dark-text">{stats.total_entries}</p>
            <p className="text-xs text-sage-400 mt-0.5">Total Actions</p>
          </div>
          {Object.entries(stats.actions).slice(0, 3).map(([action, count]) => (
            <div key={action} className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4 text-center">
              <p className="text-2xl font-bold text-earth-900 dark:text-dark-text">{count}</p>
              <p className="text-xs text-sage-400 mt-0.5 capitalize">{action}s</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 bg-white/80 dark:bg-dark-card/80 rounded-xl border border-sage-200 dark:border-dark-border p-3">
        <Filter className="h-4 w-4 text-sage-400 flex-shrink-0" />
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
          className="text-xs border border-sage-200 dark:border-dark-border rounded-lg px-2 py-1.5 bg-white dark:bg-dark-surface focus:outline-none">
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="login">Login</option>
          <option value="approve">Approve</option>
          <option value="reject">Reject</option>
        </select>
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}
          className="text-xs border border-sage-200 dark:border-dark-border rounded-lg px-2 py-1.5 bg-white dark:bg-dark-surface focus:outline-none">
          <option value="">All Types</option>
          <option value="person">Person</option>
          <option value="relationship">Relationship</option>
          <option value="story">Story</option>
          <option value="media">Media</option>
          <option value="user">User</option>
          <option value="memory">Memory</option>
          <option value="tradition">Tradition</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From"
          className="text-xs border border-sage-200 dark:border-dark-border rounded-lg px-2 py-1.5 bg-white dark:bg-dark-surface focus:outline-none" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="To"
          className="text-xs border border-sage-200 dark:border-dark-border rounded-lg px-2 py-1.5 bg-white dark:bg-dark-surface focus:outline-none" />
        {(actionFilter || entityFilter || dateFrom || dateTo) && (
          <button onClick={() => { setActionFilter(""); setEntityFilter(""); setDateFrom(""); setDateTo("") }}
            className="text-xs text-sage-400 hover:text-red-500 transition-colors">Clear</button>
        )}
      </div>

      {/* Log entries */}
      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}

      {logs?.length === 0 && !isLoading && (
        <p className="text-sage-400 text-sm text-center py-8 bg-white/80 dark:bg-dark-card/80 rounded-xl border border-sage-200 dark:border-dark-border">No audit log entries found.</p>
      )}

      <div className="space-y-1">
        {logs?.map((log) => (
          <div key={log.id}>
            <button
              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              className="w-full flex items-center gap-3 bg-white dark:bg-dark-card rounded-lg border border-sage-200 dark:border-dark-border px-4 py-2.5 hover:border-sage-300 transition-colors text-left"
            >
              <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0", actionBadge(log.action))}>
                {log.action}
              </span>
              <span className="text-xs text-sage-400 flex-shrink-0 w-16">{log.entity_type}</span>
              <span className="text-xs text-earth-900 dark:text-dark-text flex-1 truncate">
                {log.entity_label ?? log.entity_id ?? "—"}
              </span>
              <span className="text-[10px] text-sage-300 flex-shrink-0">{log.user_name ?? "System"}</span>
              <span className="text-[10px] text-sage-300 flex-shrink-0 w-16 text-right">{timeAgo(log.created_at)}</span>
              <ChevronDown className={cn("h-3 w-3 text-sage-300 transition-transform flex-shrink-0", expandedId === log.id && "rotate-180")} />
            </button>
            {expandedId === log.id && log.details && (
              <div className="mx-4 mb-1 bg-sage-50 dark:bg-dark-surface rounded-b-lg px-4 py-3 border border-t-0 border-sage-200 dark:border-dark-border">
                <pre className="text-[10px] text-sage-600 dark:text-dark-text-muted overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Codes Tab ---

interface SignupCodeData {
  id: string; code: string; label: string | null; role: string
  max_uses: number | null; use_count: number; is_active: boolean
  expires_at: string | null; created_at: string
}

function CodesTab() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [newCode, setNewCode] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [newRole, setNewRole] = useState("editor")
  const [newMaxUses, setNewMaxUses] = useState("")
  const [copied, setCopied] = useState<string | null>(null)

  const { data: codes, isLoading } = useQuery<SignupCodeData[]>({
    queryKey: ["admin-signup-codes"],
    queryFn: async () => { const res = await api.get("/admin/signup-codes"); return res.data },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post("/admin/signup-codes", {
        code: newCode, label: newLabel || null, role: newRole,
        max_uses: newMaxUses ? parseInt(newMaxUses) : null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-signup-codes"] })
      setShowForm(false); setNewCode(""); setNewLabel(""); setNewRole("editor"); setNewMaxUses("")
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async (codeId: string) => { await api.put(`/admin/signup-codes/${codeId}/toggle`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-signup-codes"] }) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (codeId: string) => { await api.delete(`/admin/signup-codes/${codeId}`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-signup-codes"] }) },
  })

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-earth-900 dark:text-dark-text flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Signup Codes
          </h2>
          <p className="text-xs text-sage-400 mt-1">Share codes with family members so they can sign up without approval.</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-earth-900 font-medium text-sm rounded-xl hover:bg-primary-dark hover:text-white transition-colors">
          <Plus className="h-4 w-4" /> New Code
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-dark-card rounded-xl border border-primary/30 p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-sage-400 mb-1 block">Code</label>
              <input type="text" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="e.g., THIRLWALL2026"
                className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
            </div>
            <div>
              <label className="text-xs font-medium text-sage-400 mb-1 block">Label (for your reference)</label>
              <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g., Family reunion 2026"
                className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-sage-400 mb-1 block">Role assigned</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none">
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-sage-400 mb-1 block">Max uses (blank = unlimited)</label>
              <input type="number" value={newMaxUses} onChange={(e) => setNewMaxUses(e.target.value)} placeholder="Unlimited"
                className="w-full rounded-lg border border-sage-200 dark:border-dark-border bg-sage-50 dark:bg-dark-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-dark/20" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-sage-400">Cancel</button>
            <button onClick={() => createMutation.mutate()} disabled={!newCode.trim() || createMutation.isPending}
              className="flex items-center gap-1 px-4 py-1.5 bg-primary-dark text-white text-sm font-medium rounded-lg hover:bg-primary hover:text-earth-900 transition-colors disabled:opacity-50">
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Create
            </button>
          </div>
        </div>
      )}

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}

      {codes?.length === 0 && !isLoading && (
        <div className="text-center py-8 bg-white/80 dark:bg-dark-card/80 rounded-xl border border-sage-200 dark:border-dark-border">
          <KeyRound className="h-8 w-8 text-sage-300 mx-auto mb-2" />
          <p className="text-sage-400 text-sm">No signup codes yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {codes?.map((c) => (
          <div key={c.id} className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono font-bold text-earth-900 dark:text-dark-text bg-sage-50 dark:bg-dark-surface px-2 py-0.5 rounded">{c.code}</code>
                <button onClick={() => copyCode(c.code)} className="text-sage-400 hover:text-primary-dark transition-colors" title="Copy code">
                  {copied === c.code ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", c.is_active ? "bg-primary/10 text-primary-dark" : "bg-red-50 text-red-600")}>
                  {c.is_active ? "Active" : "Inactive"}
                </span>
                <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded", roleBadge(c.role))}>{c.role}</span>
              </div>
              {c.label && <p className="text-xs text-sage-400 mt-1">{c.label}</p>}
              <p className="text-[10px] text-sage-300 mt-0.5">
                {c.use_count} uses{c.max_uses ? ` / ${c.max_uses} max` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => toggleMutation.mutate(c.id)}
                className="text-xs text-sage-400 hover:text-earth-900 transition-colors">
                {c.is_active ? "Disable" : "Enable"}
              </button>
              <button onClick={() => deleteMutation.mutate(c.id)}
                className="p-1 text-sage-300 hover:text-red-500 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Errors Tab ---

interface ErrorLogEntry {
  id: string; method: string; path: string; status_code: number
  error_type: string; error_message: string; traceback: string | null
  user_agent: string | null; ip_address: string | null
  request_body: string | null; resolved: boolean; created_at: string
}

function ErrorsTab() {
  const queryClient = useQueryClient()
  const [showResolved, setShowResolved] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: errors, isLoading } = useQuery<ErrorLogEntry[]>({
    queryKey: ["admin-errors", showResolved],
    queryFn: async () => {
      const params: Record<string, string> = { limit: "100" }
      if (!showResolved) params.resolved = "false"
      const res = await api.get("/admin/error-logs", { params })
      return res.data
    },
  })

  const { data: errorStats } = useQuery<{ total: number; unresolved: number; last_24h: number }>({
    queryKey: ["admin-error-stats"],
    queryFn: async () => { const res = await api.get("/admin/error-stats"); return res.data },
  })

  const resolveMutation = useMutation({
    mutationFn: async (errorId: string) => { await api.put(`/admin/error-logs/${errorId}/resolve`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-errors"] }); queryClient.invalidateQueries({ queryKey: ["admin-error-stats"] }) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (errorId: string) => { await api.delete(`/admin/error-logs/${errorId}`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-errors"] }); queryClient.invalidateQueries({ queryKey: ["admin-error-stats"] }) },
  })

  return (
    <div className="space-y-6">
      {/* Stats */}
      {errorStats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4 text-center">
            <p className="text-2xl font-bold text-earth-900 dark:text-dark-text">{errorStats.unresolved}</p>
            <p className="text-xs text-sage-400 mt-0.5">Unresolved</p>
          </div>
          <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4 text-center">
            <p className="text-2xl font-bold text-earth-900 dark:text-dark-text">{errorStats.last_24h}</p>
            <p className="text-xs text-sage-400 mt-0.5">Last 24h</p>
          </div>
          <div className="bg-white dark:bg-dark-card rounded-xl border border-sage-200 dark:border-dark-border p-4 text-center">
            <p className="text-2xl font-bold text-earth-900 dark:text-dark-text">{errorStats.total}</p>
            <p className="text-xs text-sage-400 mt-0.5">Total</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-earth-900 dark:text-dark-text">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)}
            className="rounded border-sage-300 text-primary-dark focus:ring-primary-dark/20" />
          Show resolved
        </label>
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}

      {errors?.length === 0 && !isLoading && (
        <div className="text-center py-8 bg-white/80 dark:bg-dark-card/80 rounded-xl border border-sage-200 dark:border-dark-border">
          <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
          <p className="text-sage-400 text-sm">No {showResolved ? "" : "unresolved "}errors.</p>
        </div>
      )}

      <div className="space-y-2">
        {errors?.map((err) => (
          <div key={err.id} className={cn("bg-white dark:bg-dark-card rounded-xl border overflow-hidden", err.resolved ? "border-sage-200 dark:border-dark-border opacity-60" : "border-red-200 dark:border-red-800/30")}>
            <button
              onClick={() => setExpandedId(expandedId === err.id ? null : err.id)}
              className="w-full flex items-start gap-3 p-4 text-left hover:bg-sage-50 dark:hover:bg-dark-surface transition-colors"
            >
              <AlertTriangle className={cn("h-4 w-4 flex-shrink-0 mt-0.5", err.resolved ? "text-sage-300" : "text-red-500")} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">{err.status_code}</span>
                  <span className="text-xs font-mono text-sage-400">{err.method}</span>
                  <span className="text-xs font-mono text-earth-900 dark:text-dark-text truncate">{err.path}</span>
                </div>
                <p className="text-sm text-earth-900 dark:text-dark-text mt-1 font-medium">{err.error_type}: {err.error_message.slice(0, 120)}{err.error_message.length > 120 ? "..." : ""}</p>
                <p className="text-[10px] text-sage-300 mt-1">{timeAgo(err.created_at)} {err.ip_address ? `\u2022 ${err.ip_address}` : ""}</p>
              </div>
              <ChevronDown className={cn("h-3.5 w-3.5 text-sage-300 transition-transform flex-shrink-0 mt-1", expandedId === err.id && "rotate-180")} />
            </button>

            {expandedId === err.id && (
              <div className="px-4 pb-4 border-t border-sage-100 dark:border-dark-border space-y-3">
                {err.traceback && (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-sage-400 mb-1">Traceback</p>
                    <pre className="text-[10px] font-mono text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/10 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">{err.traceback}</pre>
                  </div>
                )}
                {err.request_body && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-sage-400 mb-1">Request Body</p>
                    <pre className="text-[10px] font-mono text-earth-800 dark:text-dark-text bg-sage-50 dark:bg-dark-surface rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{err.request_body}</pre>
                  </div>
                )}
                {err.user_agent && (
                  <p className="text-[10px] text-sage-300"><span className="font-bold text-sage-400">User Agent:</span> {err.user_agent}</p>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <button onClick={() => resolveMutation.mutate(err.id)}
                    className={cn("flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                      err.resolved
                        ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "bg-primary/10 text-primary-dark hover:bg-primary/20")}>
                    {err.resolved ? "Unresolve" : <><CheckCircle className="h-3 w-3" /> Mark Resolved</>}
                  </button>
                  <button onClick={() => deleteMutation.mutate(err.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Main Admin Page ---

function AdminPage() {
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState<Tab>("users")

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
        <AppHeader />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p className="text-sage-400">Admin access required.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      <AppHeader />

      <div className="max-w-5xl mx-auto px-4 pt-20 pb-8 sm:pt-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary-dark" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-earth-900 dark:text-dark-text">Administration</h1>
            <p className="text-sm text-sage-400 dark:text-dark-text-muted">Manage users, review signups, and view audit logs.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-sage-200 dark:border-dark-border mb-6">
          <button
            onClick={() => setActiveTab("users")}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === "users"
                ? "border-primary text-primary-dark dark:text-primary"
                : "border-transparent text-sage-400 hover:text-earth-900")}
          >
            <Users className="h-3.5 w-3.5" /> Users
          </button>
          <button
            onClick={() => setActiveTab("codes")}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === "codes"
                ? "border-primary text-primary-dark dark:text-primary"
                : "border-transparent text-sage-400 hover:text-earth-900")}
          >
            <KeyRound className="h-3.5 w-3.5" /> Signup Codes
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === "audit"
                ? "border-primary text-primary-dark dark:text-primary"
                : "border-transparent text-sage-400 hover:text-earth-900")}
          >
            <ScrollText className="h-3.5 w-3.5" /> Audit Log
          </button>
          <button
            onClick={() => setActiveTab("errors")}
            className={cn("flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              activeTab === "errors"
                ? "border-red-500 text-red-600 dark:text-red-400"
                : "border-transparent text-sage-400 hover:text-earth-900")}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Errors
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "codes" && <CodesTab />}
        {activeTab === "errors" && <ErrorsTab />}
        {activeTab === "audit" && <AuditTab />}
      </div>
    </div>
  )
}

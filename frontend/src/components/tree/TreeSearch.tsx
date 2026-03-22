import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search, X, ExternalLink } from "lucide-react"
import { api } from "../../lib/api"
import { useDebounce } from "../../lib/useDebounce"
import { useTreeStore } from "../../stores/treeStore"
import { useUiStore } from "../../stores/uiStore"
import type { ApiTreeNode } from "./FamilyTreeCanvas"

interface SearchPersonResult {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  maiden_name: string | null
  birth_date: string | null
  death_date: string | null
  gender: string
  profile_photo_url: string | null
}

interface TreeSearchProps {
  treeNodes: ApiTreeNode[]
}

function getInitials(first: string, last: string): string {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

function genderColor(gender: string): string {
  switch (gender) {
    case "male":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
    case "female":
      return "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400"
    default:
      return "bg-sage-100 text-sage-600 dark:bg-dark-surface dark:text-dark-text-muted"
  }
}

function formatYears(birth: string | null, death: string | null): string {
  const b = birth ? birth.split("-")[0] : null
  const d = death ? death.split("-")[0] : null
  if (b && d) return `${b}–${d}`
  if (b) return `b. ${b}`
  return ""
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function TreeSearch({ treeNodes }: TreeSearchProps) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const debouncedQuery = useDebounce(query, 300)

  const treeViewMode = useTreeStore((s) => s.treeViewMode)
  const centerOnPerson = useTreeStore((s) => s.centerOnPerson)
  const setFocusedPerson = useTreeStore((s) => s.setFocusedPerson)
  const setTreeViewMode = useTreeStore((s) => s.setTreeViewMode)
  const setBranchPersonId = useTreeStore((s) => s.setBranchPersonId)
  const setPendingCenterPersonId = useTreeStore((s) => s.setPendingCenterPersonId)
  const detailPanelOpen = useUiStore((s) => s.detailPanelOpen)
  const toggleDetailPanel = useUiStore((s) => s.toggleDetailPanel)

  const treeNodeIds = useMemo(() => new Set(treeNodes.map((n) => n.id)), [treeNodes])

  // Local matches: filter current tree nodes
  const localMatches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return treeNodes
      .filter((n) => {
        const d = n.data
        const searchable = [d.first_name, d.middle_name, d.last_name].filter(Boolean).join(" ").toLowerCase()
        return searchable.includes(q)
      })
      .slice(0, 10)
      .map((n) => ({
        id: n.id,
        firstName: n.data.first_name,
        lastName: n.data.last_name,
        gender: n.data.gender,
        birthDate: n.data.birth_date,
        deathDate: n.data.death_date,
        inTree: true as const,
      }))
  }, [treeNodes, query])

  // Remote search (only in branch mode, when local results are sparse)
  const shouldSearchRemote = treeViewMode === "branch" && debouncedQuery.trim().length >= 2 && localMatches.length < 5
  const { data: remoteResults } = useQuery({
    queryKey: ["tree-search", debouncedQuery],
    queryFn: async () => {
      const res = await api.get<SearchPersonResult[]>("/search", {
        params: { q: debouncedQuery, limit: 10 },
      })
      return res.data
    },
    enabled: shouldSearchRemote,
    staleTime: 30_000,
  })

  // Remote matches, excluding those already in local results
  const remoteMatches = useMemo(() => {
    if (!remoteResults) return []
    const localIds = new Set(localMatches.map((m) => m.id))
    return remoteResults
      .filter((r) => !localIds.has(r.id))
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        gender: r.gender,
        birthDate: r.birth_date,
        deathDate: r.death_date,
        inTree: treeNodeIds.has(r.id),
      }))
  }, [remoteResults, localMatches, treeNodeIds])

  const allMatches = useMemo(() => [...localMatches, ...remoteMatches], [localMatches, remoteMatches])

  // Reset highlight when results change
  useEffect(() => {
    setHighlightIndex(0)
  }, [allMatches.length])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return
    const item = listRef.current.children[highlightIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: "nearest" })
  }, [highlightIndex, isOpen])

  // Cmd+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        if (window.innerWidth < 640) {
          setMobileExpanded(true)
        }
        inputRef.current?.focus()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        if (mobileExpanded) setMobileExpanded(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [mobileExpanded])

  const selectMatch = useCallback(
    (match: (typeof allMatches)[0]) => {
      if (match.inTree && centerOnPerson) {
        // Person is in the current tree — center on them
        centerOnPerson(match.id)
        setFocusedPerson(match.id)
        if (!detailPanelOpen) toggleDetailPanel()
      } else {
        // Person not in current tree — load their branch and defer centering
        setBranchPersonId(match.id)
        setTreeViewMode("branch")
        setPendingCenterPersonId(match.id)
      }
      setQuery("")
      setIsOpen(false)
      setMobileExpanded(false)
      inputRef.current?.blur()
    },
    [centerOnPerson, setFocusedPerson, detailPanelOpen, toggleDetailPanel, setBranchPersonId, setTreeViewMode, setPendingCenterPersonId],
  )

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || allMatches.length === 0) {
      if (e.key === "Escape") {
        setQuery("")
        setIsOpen(false)
        setMobileExpanded(false)
        inputRef.current?.blur()
      }
      return
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightIndex((i) => Math.min(i + 1, allMatches.length - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightIndex((i) => Math.max(i - 1, 0))
        break
      case "Enter":
        e.preventDefault()
        if (allMatches[highlightIndex]) selectMatch(allMatches[highlightIndex])
        break
      case "Escape":
        e.preventDefault()
        setQuery("")
        setIsOpen(false)
        setMobileExpanded(false)
        inputRef.current?.blur()
        break
    }
  }

  const showDropdown = isOpen && query.trim().length > 0

  // Mobile: show icon button that expands
  // Desktop: always show search bar
  return (
    <div ref={containerRef} className="relative">
      {/* Mobile search icon */}
      <button
        onClick={() => {
          setMobileExpanded(true)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className={`sm:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm border border-sage-200 dark:border-dark-border shadow-sm dark:shadow-black/20 text-sage-400 dark:text-dark-text-muted hover:text-earth-900 dark:hover:text-dark-text transition-colors ${mobileExpanded ? "hidden" : ""}`}
        aria-label="Search tree"
      >
        <Search className="h-4 w-4" />
      </button>

      {/* Search input */}
      <div className={`${mobileExpanded ? "fixed inset-x-3 top-16 z-50" : "hidden sm:block"}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sage-400 dark:text-dark-text-muted pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => {
              if (query.trim()) setIsOpen(true)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search the tree..."
            className="w-full sm:w-64 pl-9 pr-16 py-2 rounded-xl bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm border border-sage-200 dark:border-dark-border shadow-sm dark:shadow-black/20 text-sm text-earth-900 dark:text-dark-text placeholder:text-sage-300 dark:placeholder:text-dark-text-muted/50 focus:border-primary-dark focus:ring-2 focus:ring-primary-dark/20 focus:outline-none transition-colors"
          />
          {query ? (
            <button
              onClick={() => {
                setQuery("")
                setIsOpen(false)
                inputRef.current?.focus()
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-sage-400 hover:text-earth-900 dark:text-dark-text-muted dark:hover:text-dark-text transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-sage-300 dark:text-dark-text-muted/50 font-mono bg-sage-50 dark:bg-dark-surface px-1.5 py-0.5 rounded border border-sage-200 dark:border-dark-border">
              {navigator.platform.includes("Mac") ? "\u2318K" : "Ctrl+K"}
            </kbd>
          )}
        </div>

        {/* Dropdown results */}
        {showDropdown && (
          <ul
            ref={listRef}
            className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-sage-200 dark:border-dark-border bg-white dark:bg-dark-card shadow-lg dark:shadow-black/30"
          >
            {allMatches.length === 0 && (
              <li className="px-4 py-3 text-sm text-sage-300 dark:text-dark-text-muted text-center">
                No matches found
              </li>
            )}
            {allMatches.map((match, i) => {
              const fullName = `${match.firstName} ${match.lastName}`
              const years = formatYears(match.birthDate, match.deathDate)
              const isRemote = !match.inTree

              return (
                <li key={match.id}>
                  <button
                    type="button"
                    onClick={() => selectMatch(match)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors ${
                      i === highlightIndex
                        ? "bg-primary/10"
                        : "hover:bg-sage-50 dark:hover:bg-dark-surface"
                    }`}
                  >
                    {/* Avatar initials */}
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${genderColor(match.gender)}`}
                    >
                      {getInitials(match.firstName, match.lastName)}
                    </div>

                    {/* Name + years */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-earth-900 dark:text-dark-text truncate">
                        {highlightMatch(fullName, query)}
                      </div>
                      {years && (
                        <div className="text-xs text-sage-400 dark:text-dark-text-muted">{years}</div>
                      )}
                    </div>

                    {/* "Not in view" badge for remote matches */}
                    {isRemote && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-sage-300 dark:text-dark-text-muted bg-sage-50 dark:bg-dark-surface px-2 py-0.5 rounded-full flex-shrink-0">
                        <ExternalLink className="h-2.5 w-2.5" />
                        Not in view
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

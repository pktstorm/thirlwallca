import { useState, useMemo } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Cake, Heart, Clock } from "lucide-react"
import { api } from "../../lib/api"
import { AppHeader } from "../../components/layout/AppHeader"
import { cn } from "../../lib/utils"

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
})

interface CalendarEvent {
  date: string  // MM-DD
  day: number
  type: string  // birthday, death_anniversary, wedding_anniversary
  person_name: string
  person_id: string | null
  year_of_event: number | null
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

function CalendarPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-12
  const [year, setYear] = useState(now.getFullYear())

  const { data: events } = useQuery<CalendarEvent[]>({
    queryKey: ["calendar-events", month, year],
    queryFn: async () => {
      const res = await api.get("/calendar", { params: { month, year } })
      return res.data
    },
  })

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>()
    for (const e of events ?? []) {
      const list = map.get(e.day) ?? []
      list.push(e)
      map.set(e.day, list)
    }
    return map
  }, [events])

  // Calendar grid
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay() // 0=Sun
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const today = now.getDate()
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1) }
    else setMonth(month + 1)
  }

  return (
    <div className="min-h-screen bg-sage-50 dark:bg-bg-dark">
      <AppHeader />
      <div className="max-w-4xl mx-auto px-4 pt-20 pb-20 sm:pt-24 sm:pb-12">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <CalendarIcon className="h-7 w-7 text-primary-dark" />
          </div>
          <h1 className="text-3xl font-bold text-earth-900 dark:text-dark-text">Family Calendar</h1>
          <p className="text-sage-400 dark:text-dark-text-muted mt-2">Birthdays, anniversaries, and memorial dates.</p>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-sage-100 dark:hover:bg-dark-surface text-sage-400 transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-xl font-bold text-earth-900 dark:text-dark-text">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-sage-100 dark:hover:bg-dark-surface text-sage-400 transition-colors">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Calendar grid */}
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-sage-200 dark:border-dark-border overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-sage-200 dark:border-dark-border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-bold uppercase tracking-wider text-sage-400">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] sm:min-h-[100px] border-b border-r border-sage-100 dark:border-dark-border/30 bg-sage-50/30 dark:bg-dark-surface/20" />
            ))}

            {days.map((day) => {
              const dayEvents = eventsByDay.get(day) ?? []
              const isToday = isCurrentMonth && day === today

              return (
                <div key={day} className={cn(
                  "min-h-[80px] sm:min-h-[100px] border-b border-r border-sage-100 dark:border-dark-border/30 p-1 sm:p-2",
                  isToday && "bg-primary/5",
                )}>
                  <div className={cn(
                    "text-xs font-medium mb-1",
                    isToday ? "text-primary-dark font-bold" : "text-sage-400",
                  )}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((e, i) => {
                      const icon = e.type === "birthday" ? "🎂" : e.type === "wedding_anniversary" ? "💒" : "🕯️"
                      const content = (
                        <div className={cn(
                          "text-[9px] sm:text-[10px] leading-tight truncate rounded px-1 py-0.5",
                          e.type === "birthday" ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                            : e.type === "wedding_anniversary" ? "bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-400"
                              : "bg-sage-50 dark:bg-dark-surface text-sage-600 dark:text-dark-text-muted",
                        )}>
                          <span className="hidden sm:inline">{icon} </span>{e.person_name}
                          {e.year_of_event && <span className="hidden sm:inline text-[8px] opacity-60"> ({e.year_of_event})</span>}
                        </div>
                      )
                      return e.person_id ? (
                        <Link key={i} to="/person/$personId" params={{ personId: e.person_id }}>{content}</Link>
                      ) : (
                        <div key={i}>{content}</div>
                      )
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-[8px] text-sage-300 px-1">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Event list for the month */}
        {events && events.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-bold text-earth-900 dark:text-dark-text mb-3">
              All Events in {MONTH_NAMES[month - 1]}
            </h3>
            {events.sort((a, b) => a.day - b.day).map((e, i) => {
              const Icon = e.type === "birthday" ? Cake : e.type === "wedding_anniversary" ? Heart : Clock
              const color = e.type === "birthday" ? "text-blue-500" : e.type === "wedding_anniversary" ? "text-pink-500" : "text-sage-400"
              return (
                <div key={i} className="flex items-center gap-3 bg-white dark:bg-dark-card rounded-lg border border-sage-200 dark:border-dark-border px-3 py-2">
                  <span className="text-xs font-mono font-bold text-sage-400 w-6 text-right">{e.day}</span>
                  <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", color)} />
                  <p className="text-xs text-earth-900 dark:text-dark-text flex-1">
                    {e.person_name}
                    {e.year_of_event && <span className="text-sage-400"> \u2022 {e.type === "birthday" ? "Born" : e.type === "wedding_anniversary" ? "Married" : "Died"} {e.year_of_event}</span>}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

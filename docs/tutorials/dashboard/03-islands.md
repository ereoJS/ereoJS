# Dashboard Tutorial: Interactive Islands

Build interactive dashboard widgets using islands architecture.

## Understanding Islands in Dashboards

Dashboards typically have:
- **Static content**: Headers, navigation, labels
- **Interactive widgets**: Charts, live feeds, filters

Islands let us hydrate only the interactive parts.

## Stats Widget Island

Create `app/components/StatsWidget.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { signal } from '@ereo/state'

interface Stat {
  label: string
  value: number
  change: number
  trend: 'up' | 'down'
}

// Shared signal for real-time updates
export const statsSignal = signal<Stat[]>([])

export default function StatsWidget({ initialStats }: { initialStats: Stat[] }) {
  const [stats, setStats] = useState(initialStats)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    if (!isLive) return

    // Poll for updates every 5 seconds
    const interval = setInterval(async () => {
      const res = await fetch('/api/stats')
      const data = await res.json()
      setStats(data)
      statsSignal.set(data)
    }, 5000)

    return () => clearInterval(interval)
  }, [isLive])

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Key Metrics</h3>
        <button
          onClick={() => setIsLive(!isLive)}
          className={`text-sm px-2 py-1 rounded ${
            isLive ? 'bg-green-100 text-green-700' : 'bg-gray-100'
          }`}
        >
          {isLive ? '● Live' : 'Enable Live'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="p-4 bg-gray-50 rounded">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
            <p className={`text-sm ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {stat.trend === 'up' ? '↑' : '↓'} {Math.abs(stat.change)}%
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Activity Feed Island

Create `app/components/ActivityFeed.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react'

interface Activity {
  id: number
  user: string
  action: string
  timestamp: string
}

export default function ActivityFeed({ initialActivities }: { initialActivities: Activity[] }) {
  const [activities, setActivities] = useState(initialActivities)
  const [autoScroll, setAutoScroll] = useState(true)
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // WebSocket for real-time updates
    const ws = new WebSocket(`ws://${window.location.host}/ws/activity`)

    ws.onmessage = (event) => {
      const newActivity = JSON.parse(event.data)
      setActivities(prev => [newActivity, ...prev.slice(0, 49)])

      if (autoScroll && feedRef.current) {
        feedRef.current.scrollTop = 0
      }
    }

    return () => ws.close()
  }, [autoScroll])

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="font-semibold">Activity Feed</h3>
        <label className="flex items-center text-sm">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="mr-2"
          />
          Auto-scroll
        </label>
      </div>

      <div ref={feedRef} className="h-64 overflow-y-auto">
        {activities.map((activity) => (
          <div key={activity.id} className="px-4 py-3 border-b last:border-0 hover:bg-gray-50">
            <div className="flex justify-between">
              <span className="font-medium">{activity.user}</span>
              <span className="text-sm text-gray-500">{formatTime(activity.timestamp)}</span>
            </div>
            <p className="text-sm text-gray-600">{activity.action}</p>
          </div>
        ))}

        {activities.length === 0 && (
          <p className="p-4 text-center text-gray-500">No recent activity</p>
        )}
      </div>
    </div>
  )
}
```

## Chart Widget Island

Create `app/components/ChartWidget.tsx`:

```tsx
import { useState, useMemo } from 'react'

interface DataPoint {
  date: string
  value: number
}

interface ChartWidgetProps {
  data: DataPoint[]
  title: string
}

export default function ChartWidget({ data, title }: ChartWidgetProps) {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d')

  const filteredData = useMemo(() => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    return data.filter(d => new Date(d.date) >= cutoff)
  }, [data, range])

  const maxValue = Math.max(...filteredData.map(d => d.value))
  const minValue = Math.min(...filteredData.map(d => d.value))

  const getY = (value: number) => {
    const range = maxValue - minValue || 1
    return 100 - ((value - minValue) / range) * 80 - 10
  }

  const points = filteredData.map((d, i) => {
    const x = (i / (filteredData.length - 1)) * 100
    const y = getY(d.value)
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex gap-1">
          {(['7d', '30d', '90d'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-1 text-sm rounded ${
                range === r ? 'bg-blue-600 text-white' : 'bg-gray-100'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox="0 0 100 100" className="w-full h-48" preserveAspectRatio="none">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="#e5e7eb"
            strokeWidth="0.2"
          />
        ))}

        {/* Area fill */}
        <polygon
          points={`0,100 ${points} 100,100`}
          fill="url(#gradient)"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="0.5"
        />

        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="flex justify-between text-sm text-gray-500 mt-2">
        <span>{filteredData[0]?.date}</span>
        <span>{filteredData[filteredData.length - 1]?.date}</span>
      </div>
    </div>
  )
}
```

## Dashboard Page with Islands

Update `app/routes/dashboard/index.tsx`:

```tsx
import { createLoader } from '@ereo/data'
import { db } from '~/lib/db'

export const loader = createLoader(async ({ context }) => {
  const user = context.get('user')

  // Fetch dashboard data
  const stats = [
    { label: 'Users', value: 1234, change: 12, trend: 'up' as const },
    { label: 'Revenue', value: 54321, change: 8, trend: 'up' as const },
    { label: 'Orders', value: 892, change: -3, trend: 'down' as const },
    { label: 'Conversion', value: 3.2, change: 0.5, trend: 'up' as const }
  ]

  const activities = db.query<any, [number]>(`
    SELECT a.*, u.name as user_name
    FROM activities a
    JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT 20
  `).all(user.id)

  // Generate chart data
  const chartData = Array.from({ length: 90 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - (89 - i))
    return {
      date: date.toISOString().split('T')[0],
      value: Math.floor(Math.random() * 1000) + 500
    }
  })

  return { stats, activities, chartData }
})

export default function DashboardHome({ loaderData }: { loaderData: any }) {
  const { stats, activities, chartData } = loaderData

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Overview</h2>

      {/* Interactive Stats Widget */}
      <div
        data-island="StatsWidget"
        data-hydrate="load"
        data-props={JSON.stringify({ initialStats: stats })}
      >
        {/* SSR fallback */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="p-4 bg-gray-50 rounded">
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Chart Widget */}
        <div
          data-island="ChartWidget"
          data-hydrate="visible"
          data-props={JSON.stringify({ data: chartData, title: 'Revenue' })}
        >
          {/* SSR placeholder */}
          <div className="bg-white rounded-lg shadow p-6 h-64">
            <h3 className="font-semibold mb-4">Revenue</h3>
            <div className="animate-pulse bg-gray-100 h-48 rounded" />
          </div>
        </div>

        {/* Activity Feed */}
        <div
          data-island="ActivityFeed"
          data-hydrate="idle"
          data-props={JSON.stringify({
            initialActivities: activities.map(a => ({
              id: a.id,
              user: a.user_name,
              action: a.action,
              timestamp: a.created_at
            }))
          })}
        >
          {/* SSR fallback */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Activity Feed</h3>
            </div>
            <div className="h-64 overflow-y-auto">
              {activities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="px-4 py-3 border-b">
                  <span className="font-medium">{activity.user_name}</span>
                  <p className="text-sm text-gray-600">{activity.action}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

## Hydration Strategies

We're using different hydration strategies:

| Widget | Strategy | Why |
|--------|----------|-----|
| StatsWidget | `load` | Critical metrics, hydrate immediately |
| ChartWidget | `visible` | Below fold, hydrate when scrolled into view |
| ActivityFeed | `idle` | Non-critical, hydrate during idle time |

## Next Steps

In the next chapter, we'll add an analytics page with more advanced islands.

[Continue to Chapter 4: Analytics →](./04-analytics.md)

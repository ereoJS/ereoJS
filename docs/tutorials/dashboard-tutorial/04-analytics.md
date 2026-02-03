# Dashboard Tutorial: Analytics Page

Build an analytics page with shared state between islands.

## Shared State Between Islands

Multiple islands can share state using signals:

```tsx
// lib/analytics-store.ts
import { signal, computed } from '@ereo/state'

export interface DateRange {
  start: Date
  end: Date
}

export const dateRange = signal<DateRange>({
  start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  end: new Date()
})

export const selectedMetric = signal<'views' | 'users' | 'revenue'>('views')

export const dateRangeLabel = computed(() => {
  const range = dateRange.get()
  const days = Math.ceil((range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000))
  return `Last ${days} days`
}, [dateRange])
```

## Date Range Picker Island

Create `src/islands/DateRangePicker.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { dateRange, type DateRange } from '../lib/analytics-store'

const presets = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This year', days: 365 }
]

export default function DateRangePicker({ initialRange }: { initialRange: DateRange }) {
  const [range, setRange] = useState(initialRange)
  const [showCustom, setShowCustom] = useState(false)

  useEffect(() => {
    // Subscribe to global state changes
    return dateRange.subscribe(setRange)
  }, [])

  const applyPreset = (days: number) => {
    const newRange = {
      start: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      end: new Date()
    }
    setRange(newRange)
    dateRange.set(newRange)
    setShowCustom(false)
  }

  const applyCustom = (start: string, end: string) => {
    const newRange = {
      start: new Date(start),
      end: new Date(end)
    }
    setRange(newRange)
    dateRange.set(newRange)
    setShowCustom(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowCustom(!showCustom)}
        className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>
          {range.start.toLocaleDateString()} - {range.end.toLocaleDateString()}
        </span>
      </button>

      {showCustom && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-white rounded-lg shadow-lg border z-10">
          <div className="flex flex-wrap gap-2 mb-4">
            {presets.map((preset) => (
              <button
                key={preset.days}
                onClick={() => applyPreset(preset.days)}
                className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-gray-500 mb-2">Custom Range</p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.currentTarget
                const start = (form.elements.namedItem('start') as HTMLInputElement).value
                const end = (form.elements.namedItem('end') as HTMLInputElement).value
                applyCustom(start, end)
              }}
              className="flex gap-2"
            >
              <input
                type="date"
                name="start"
                defaultValue={range.start.toISOString().split('T')[0]}
                className="px-2 py-1 border rounded text-sm"
              />
              <span className="self-center">to</span>
              <input
                type="date"
                name="end"
                defaultValue={range.end.toISOString().split('T')[0]}
                className="px-2 py-1 border rounded text-sm"
              />
              <button
                type="submit"
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Apply
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
```

## Metric Selector Island

Create `src/islands/MetricSelector.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { selectedMetric } from '../lib/analytics-store'

const metrics = [
  { id: 'views', label: 'Page Views', icon: '👁' },
  { id: 'users', label: 'Active Users', icon: '👤' },
  { id: 'revenue', label: 'Revenue', icon: '💰' }
] as const

export default function MetricSelector({ initial }: { initial: 'views' | 'users' | 'revenue' }) {
  const [selected, setSelected] = useState(initial)

  useEffect(() => {
    return selectedMetric.subscribe(setSelected)
  }, [])

  const handleSelect = (id: typeof selected) => {
    setSelected(id)
    selectedMetric.set(id)
  }

  return (
    <div className="flex gap-2">
      {metrics.map((metric) => (
        <button
          key={metric.id}
          onClick={() => handleSelect(metric.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
            selected === metric.id
              ? 'bg-blue-600 text-white'
              : 'bg-white border hover:bg-gray-50'
          }`}
        >
          <span>{metric.icon}</span>
          <span>{metric.label}</span>
        </button>
      ))}
    </div>
  )
}
```

## Analytics Chart Island

Create `src/islands/AnalyticsChart.tsx`:

```tsx
import { useState, useEffect, useMemo } from 'react'
import { dateRange, selectedMetric } from '../lib/analytics-store'

interface DataSet {
  views: Array<{ date: string; value: number }>
  users: Array<{ date: string; value: number }>
  revenue: Array<{ date: string; value: number }>
}

export default function AnalyticsChart({ data }: { data: DataSet }) {
  const [range, setRange] = useState(dateRange.get())
  const [metric, setMetric] = useState(selectedMetric.get())
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null)

  useEffect(() => {
    const unsubRange = dateRange.subscribe(setRange)
    const unsubMetric = selectedMetric.subscribe(setMetric)
    return () => {
      unsubRange()
      unsubMetric()
    }
  }, [])

  const filteredData = useMemo(() => {
    return data[metric].filter(d => {
      const date = new Date(d.date)
      return date >= range.start && date <= range.end
    })
  }, [data, metric, range])

  const maxValue = Math.max(...filteredData.map(d => d.value))

  const getY = (value: number) => 100 - (value / maxValue) * 80 - 10

  const points = filteredData.map((d, i) => ({
    x: (i / (filteredData.length - 1 || 1)) * 100,
    y: getY(d.value),
    data: d
  }))

  const formatValue = (value: number) => {
    if (metric === 'revenue') return `$${value.toLocaleString()}`
    return value.toLocaleString()
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-lg">
          {metric === 'views' && 'Page Views'}
          {metric === 'users' && 'Active Users'}
          {metric === 'revenue' && 'Revenue'}
        </h3>

        {hoveredPoint !== null && points[hoveredPoint] && (
          <div className="text-right">
            <p className="text-2xl font-bold">{formatValue(points[hoveredPoint].data.value)}</p>
            <p className="text-sm text-gray-500">{points[hoveredPoint].data.date}</p>
          </div>
        )}
      </div>

      <svg
        viewBox="0 0 100 100"
        className="w-full h-64"
        preserveAspectRatio="none"
        onMouseLeave={() => setHoveredPoint(null)}
      >
        {/* Grid */}
        {[0, 25, 50, 75, 100].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#e5e7eb" strokeWidth="0.2" />
        ))}

        {/* Area */}
        <polygon
          points={`0,100 ${points.map(p => `${p.x},${p.y}`).join(' ')} 100,100`}
          fill="url(#analyticsGradient)"
        />

        {/* Line */}
        <polyline
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="0.5"
        />

        {/* Interactive points */}
        {points.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={hoveredPoint === i ? 1.5 : 0.5}
            fill="#3b82f6"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredPoint(i)}
          />
        ))}

        <defs>
          <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <div className="flex justify-between text-sm text-gray-500 mt-2">
        <span>{range.start.toLocaleDateString()}</span>
        <span>{range.end.toLocaleDateString()}</span>
      </div>
    </div>
  )
}
```

## Analytics Page

Create `src/routes/dashboard/analytics.tsx`:

```tsx
import { createLoader } from '@ereo/data'

export const loader = createLoader(async () => {
  // Generate mock analytics data
  const generateData = (base: number, variance: number) => {
    return Array.from({ length: 365 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (364 - i))
      return {
        date: date.toISOString().split('T')[0],
        value: Math.floor(base + Math.random() * variance - variance / 2)
      }
    })
  }

  return {
    data: {
      views: generateData(5000, 2000),
      users: generateData(1200, 500),
      revenue: generateData(15000, 5000)
    },
    initialRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString()
    }
  }
})

export default function AnalyticsPage({ loaderData }) {
  const { data, initialRange } = loaderData

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Analytics</h2>

        {/* Date Range Picker */}
        <div
          data-island="DateRangePicker"
          data-hydrate="load"
          data-props={JSON.stringify({
            initialRange: {
              start: initialRange.start,
              end: initialRange.end
            }
          })}
        >
          <button className="px-4 py-2 bg-white border rounded-lg">
            {new Date(initialRange.start).toLocaleDateString()} - {new Date(initialRange.end).toLocaleDateString()}
          </button>
        </div>
      </div>

      {/* Metric Selector */}
      <div
        data-island="MetricSelector"
        data-hydrate="load"
        data-props={JSON.stringify({ initial: 'views' })}
      >
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            👁 Page Views
          </button>
          <button className="px-4 py-2 bg-white border rounded-lg">
            👤 Active Users
          </button>
          <button className="px-4 py-2 bg-white border rounded-lg">
            💰 Revenue
          </button>
        </div>
      </div>

      {/* Main Chart */}
      <div
        data-island="AnalyticsChart"
        data-hydrate="load"
        data-props={JSON.stringify({ data })}
      >
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">Page Views</h3>
          <div className="h-64 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Total Views</p>
          <p className="text-3xl font-bold">1.2M</p>
          <p className="text-sm text-green-600">↑ 12% from last period</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Avg. Daily Users</p>
          <p className="text-3xl font-bold">4,521</p>
          <p className="text-sm text-green-600">↑ 8% from last period</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Conversion Rate</p>
          <p className="text-3xl font-bold">3.2%</p>
          <p className="text-sm text-red-600">↓ 0.5% from last period</p>
        </div>
      </div>
    </div>
  )
}
```

## How State Sharing Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Analytics Page                          │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────┐     ┌─────────────────┐                  │
│  │ DateRange     │────▶│                 │                  │
│  │ Picker        │     │   Shared        │                  │
│  │ (Island)      │     │   Signals       │                  │
│  └───────────────┘     │                 │                  │
│                        │  - dateRange    │                  │
│  ┌───────────────┐     │  - selectedMetric│                 │
│  │ Metric        │────▶│                 │                  │
│  │ Selector      │     │                 │                  │
│  │ (Island)      │     └────────┬────────┘                  │
│  └───────────────┘              │                           │
│                                 │                           │
│  ┌───────────────────────────────▼───────────────────────┐  │
│  │           Analytics Chart (Island)                    │  │
│  │                                                       │  │
│  │   Subscribes to both signals, re-renders on change    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Next Steps

In the final chapter, we'll deploy the dashboard to production.

[Continue to Chapter 5: Deployment →](./05-deployment.md)

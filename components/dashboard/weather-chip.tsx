'use client'

import { useEffect, useState } from 'react'
import { CloudSun } from 'lucide-react'
import type { WeatherForecast } from '@/lib/weather/types'

/** Small "Baku · 14°C" chip; uses the city chosen in the planner. */
export function WeatherChip() {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      let city = 'Baku'
      try {
        city = window.localStorage.getItem('vestra:planner-location') || city
      } catch {
        // Storage can be unavailable; fall back to the default city.
      }
      try {
        const response = await fetch(
          `/api/weather?${new URLSearchParams({ locationName: city })}`,
        )
        const data = (await response.json()) as { forecast?: WeatherForecast }
        if (!cancelled && response.ok && data.forecast) {
          setLabel(
            `${data.forecast.location.name} · ${Math.round(data.forecast.current.temperatureC)}°C`,
          )
        }
      } catch {
        // Weather is decoration here; hide it when unavailable.
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  if (!label) return null
  return (
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <CloudSun className="size-4" aria-hidden="true" />
      {label}
    </p>
  )
}

import type {
  WeatherForecast,
  WeatherProvider,
  WeatherProviderInput,
} from './types'

export class MockWeatherProvider implements WeatherProvider {
  async getForecast(input: WeatherProviderInput): Promise<WeatherForecast> {
    const now = new Date()
    const location = {
      name: input.locationName?.trim() || 'Baku',
      latitude: input.latitude ?? 40.4093,
      longitude: input.longitude ?? 49.8671,
      timezone: 'Asia/Baku',
    }

    const hourly = Array.from({ length: 12 }).map((_, index) => {
      const time = new Date(now.getTime() + index * 60 * 60 * 1000)
      return {
        time: time.toISOString(),
        temperatureC: 27 + Math.round(Math.sin(index / 3) * 2),
        feelsLikeC: 28 + Math.round(Math.sin(index / 3) * 2),
        precipitationProbability: index > 5 ? 35 : 10,
        rainMm: index > 5 ? 0.8 : 0,
        snowMm: 0,
        windKph: 18,
        humidity: 62,
        uvIndex: index < 4 ? 7 : 3,
        condition: index > 5 ? 'rain' : 'clear',
      } as const
    })

    return {
      location,
      current: hourly[0],
      hourly,
      daily: Array.from({ length: 7 }).map((_, index) => {
        const time = new Date(now.getTime() + index * 24 * 60 * 60 * 1000)
        const sunrise = new Date(time)
        const sunset = new Date(time)
        sunrise.setHours(6, 15, 0, 0)
        sunset.setHours(20, 5, 0, 0)
        return {
          ...hourly[Math.min(index, hourly.length - 1)],
          time: time.toISOString(),
          minTemperatureC: 22,
          maxTemperatureC: 30,
          sunrise: sunrise.toISOString(),
          sunset: sunset.toISOString(),
        }
      }),
      fetchedAt: now.toISOString(),
      provider: 'mock',
      stale: false,
    }
  }
}

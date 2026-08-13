import { ApiWeatherProvider } from './api-provider'
import { MockWeatherProvider } from './mock-provider'
import { OpenMeteoWeatherProvider } from './open-meteo-provider'
import { WeatherProviderError, type WeatherProvider } from './types'

export function getWeatherProvider(): WeatherProvider {
  const provider = process.env.WEATHER_PROVIDER

  if (provider === 'mock') {
    if (process.env.NODE_ENV === 'production') {
      throw new WeatherProviderError('weather_credentials_missing')
    }
    return new MockWeatherProvider()
  }

  if (provider === 'api') {
    return new ApiWeatherProvider()
  }

  if (provider === 'open_meteo') {
    return new OpenMeteoWeatherProvider()
  }

  if (process.env.NODE_ENV === 'production') {
    throw new WeatherProviderError('weather_not_configured')
  }

  return new MockWeatherProvider()
}

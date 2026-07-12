import { ApiWeatherProvider } from './api-provider'
import { MockWeatherProvider } from './mock-provider'
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

  throw new WeatherProviderError('weather_credentials_missing')
}

import { describe, expect, it } from 'vitest'
import {
  parseWardrobePayload,
  validateImageFile,
} from '@/lib/wardrobe/validation'

describe('wardrobe validation', () => {
  it('normalizes manual item fields', () => {
    const formData = new FormData()
    formData.set('name', ' Black Oxford Shirt ')
    formData.set('category', 'tops')
    formData.set('clothingType', 'shirt')
    formData.set('colors', 'Black, White, ')
    formData.set('seasons', 'spring,winter,invalid')
    formData.set('styles', 'business,classic,unknown')
    formData.set('material', 'cotton')
    formData.set('brand', 'Vestra')
    formData.set('notes', 'Good for work')

    const result = parseWardrobePayload(formData)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.colors).toEqual(['black', 'white'])
      expect(result.data.seasons).toEqual(['spring', 'winter'])
      expect(result.data.styles).toEqual(['business', 'classic'])
    }
  })

  it('rejects invalid category values', () => {
    const formData = new FormData()
    formData.set('name', 'Test')
    formData.set('category', 'not-real')
    formData.set('clothingType', 'shirt')

    expect(parseWardrobePayload(formData)).toEqual({
      ok: false,
      message: 'invalid_category',
      status: 400,
    })
  })

  it('rejects unsupported images', () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })

    expect(validateImageFile(file)).toEqual({
      ok: false,
      message: 'invalid_image_type',
      status: 400,
    })
  })
})

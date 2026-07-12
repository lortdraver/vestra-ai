import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ObjectStorage, StoredObject, StoreObjectInput } from './types'

const extensionByType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export class LocalObjectStorage implements ObjectStorage {
  async putWardrobeImage(input: StoreObjectInput): Promise<StoredObject> {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? ''
    const isLocalRuntime =
      appUrl.startsWith('http://localhost') ||
      appUrl.startsWith('http://127.0.0.1')

    if (process.env.NODE_ENV === 'production' && !isLocalRuntime) {
      throw new Error('Local storage is not allowed in production')
    }

    const extension = extensionByType[input.file.type]
    if (!extension) {
      throw new Error('Unsupported image content type')
    }

    const safeUserId = input.userId.replace(/[^a-zA-Z0-9_-]/g, '')
    const variant = input.variant ?? 'processed'
    const storageKey = `wardrobe/${safeUserId}/${variant}/${randomUUID()}.${extension}`
    const targetPath = path.join(process.cwd(), 'public', 'uploads', storageKey)
    await mkdir(path.dirname(targetPath), { recursive: true })

    const buffer = Buffer.from(await input.file.arrayBuffer())
    await writeFile(targetPath, buffer)

    return {
      url: `/uploads/${storageKey}`,
      storageKey,
      contentType: input.file.type,
      size: input.file.size,
    }
  }
}

import { randomUUID } from 'node:crypto'
import { access, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type {
  ObjectStorage,
  StoredObject,
  StorageObject,
  StoreObjectInput,
} from './types'

const extensionByType: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export class LocalObjectStorage implements ObjectStorage {
  private assertAllowed() {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? ''
    const isLocalRuntime =
      appUrl.startsWith('http://localhost') ||
      appUrl.startsWith('http://127.0.0.1')

    if (process.env.NODE_ENV === 'production' && !isLocalRuntime) {
      throw new Error('Local storage is not allowed in production')
    }
  }

  async putWardrobeImage(input: StoreObjectInput): Promise<StoredObject> {
    this.assertAllowed()

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

  async getObject(storageKey: string): Promise<StorageObject> {
    this.assertAllowed()
    const filePath = this.resolveStorageKey(storageKey)
    const [body, fileStat] = await Promise.all([
      readFile(filePath),
      stat(filePath),
    ])

    return {
      body,
      contentType: contentTypeFromStorageKey(storageKey),
      size: fileStat.size,
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    this.assertAllowed()
    await rm(this.resolveStorageKey(storageKey), { force: true })
  }

  async exists(storageKey: string): Promise<boolean> {
    this.assertAllowed()
    try {
      await access(this.resolveStorageKey(storageKey))
      return true
    } catch {
      return false
    }
  }

  async healthCheck() {
    try {
      this.assertAllowed()
      return { ok: true, driver: 'local', configured: true }
    } catch (error) {
      return {
        ok: false,
        driver: 'local',
        configured: false,
        message: error instanceof Error ? error.message : 'storage_unavailable',
      }
    }
  }

  private resolveStorageKey(storageKey: string) {
    const normalized = storageKey.replace(/\\/g, '/')
    if (
      normalized.includes('..') ||
      normalized.startsWith('/') ||
      !normalized.startsWith('wardrobe/')
    ) {
      throw new Error('Invalid storage key')
    }

    const root = path.join(process.cwd(), 'public', 'uploads')
    const targetPath = path.resolve(root, normalized)
    const relative = path.relative(root, targetPath)
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Invalid storage key')
    }

    return targetPath
  }
}

function contentTypeFromStorageKey(storageKey: string) {
  if (storageKey.endsWith('.png')) return 'image/png'
  if (storageKey.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

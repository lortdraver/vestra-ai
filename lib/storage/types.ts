export type StoredObject = {
  url: string
  storageKey: string
  contentType: string
  size: number
}

export type StorageObject = {
  body: Uint8Array
  contentType: string
  size: number
}

export type StoreObjectInput = {
  userId: string
  file: File
  variant?: 'original' | 'processed'
}

export type StorageHealth = {
  ok: boolean
  driver: string
  configured: boolean
  message?: string
}

export interface ObjectStorage {
  putWardrobeImage(input: StoreObjectInput): Promise<StoredObject>
  getObject(storageKey: string): Promise<StorageObject>
  deleteObject(storageKey: string): Promise<void>
  exists(storageKey: string): Promise<boolean>
  healthCheck(): Promise<StorageHealth>
}

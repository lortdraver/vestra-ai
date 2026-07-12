export type StoredObject = {
  url: string
  storageKey: string
  contentType: string
  size: number
}

export type StoreObjectInput = {
  userId: string
  file: File
  variant?: 'original' | 'processed'
}

export interface ObjectStorage {
  putWardrobeImage(input: StoreObjectInput): Promise<StoredObject>
}

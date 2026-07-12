import type {
  BackgroundRemovalInput,
  BackgroundRemovalProvider,
  BackgroundRemovalResult,
} from './provider'

export class MockBackgroundRemovalProvider implements BackgroundRemovalProvider {
  async removeBackground(
    input: BackgroundRemovalInput,
  ): Promise<BackgroundRemovalResult> {
    const transparentPng = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      ),
      (char) => char.charCodeAt(0),
    )
    const processedFile = new File([transparentPng], 'mock-processed.png', {
      type: 'image/png',
      lastModified: Date.now(),
    })

    return {
      file: processedFile,
      provider: 'mock',
      modelId: 'mock-background-removal-v1',
      mode: input.mode ?? 'single_item',
    }
  }
}

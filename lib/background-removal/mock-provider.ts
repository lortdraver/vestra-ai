import type {
  BackgroundRemovalInput,
  BackgroundRemovalProvider,
  BackgroundRemovalResult,
} from './provider'

export class MockBackgroundRemovalProvider implements BackgroundRemovalProvider {
  async removeBackground(
    input: BackgroundRemovalInput,
  ): Promise<BackgroundRemovalResult> {
    const buffer = await input.file.arrayBuffer()
    const processedFile = new File([buffer], input.file.name, {
      type: input.file.type,
      lastModified: input.file.lastModified,
    })

    return {
      file: processedFile,
      provider: 'mock',
      modelId: 'mock-background-removal-v1',
      mode: input.mode ?? 'single_item',
    }
  }
}

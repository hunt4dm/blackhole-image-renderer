export interface SceneTextureSource {
  readonly label: string
  start(): Promise<void> | void
  stop(): void
  isReady(): boolean
  getFrame(now: number, width: number, height: number): TexImageSource | null
}

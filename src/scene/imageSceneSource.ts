import type { SceneTextureSource } from './sceneTextureSource'

export type ImageFitMode = 'contain' | 'cover'

export class ImageSceneSource implements SceneTextureSource {
  readonly label = 'image'

  private readonly canvas = document.createElement('canvas')
  private readonly context: CanvasRenderingContext2D
  private image: CanvasImageSource | null = null
  private imageName = 'Built-in gradient'
  private imageWidth = 0
  private imageHeight = 0
  private ready = false
  private fitMode: ImageFitMode = 'contain'

  constructor() {
    const context = this.canvas.getContext('2d', { alpha: false })
    if (!context) {
      throw new Error('Failed to create image source context')
    }
    this.context = context
  }

  start() {
    this.ready = true
  }

  stop() {
    this.ready = false
  }

  isReady() {
    return this.ready
  }

  setFitMode(mode: ImageFitMode) {
    this.fitMode = mode
  }

  getInfo() {
    return {
      name: this.imageName,
      width: this.imageWidth,
      height: this.imageHeight,
      fitMode: this.fitMode,
    }
  }

  async loadFile(file: File) {
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.decoding = 'async'
      image.src = url
      await image.decode()
      this.image = image
      this.imageName = file.name
      this.imageWidth = image.naturalWidth
      this.imageHeight = image.naturalHeight
      console.info('[blackhole] image loaded ' + JSON.stringify({
        name: file.name,
        type: file.type || 'unknown',
        width: image.naturalWidth,
        height: image.naturalHeight,
      }))
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  getFrame(now: number, width: number, height: number) {
    if (!this.ready) {
      return null
    }

    this.resize(width, height)
    if (this.image) {
      this.drawImage(width, height)
    } else {
      this.drawFallback(now, width, height)
    }

    return this.canvas
  }

  private resize(width: number, height: number) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
  }

  private drawImage(width: number, height: number) {
    if (!this.image || this.imageWidth === 0 || this.imageHeight === 0) {
      return
    }

    const canvasAspect = width / Math.max(height, 1)
    const imageAspect = this.imageWidth / Math.max(this.imageHeight, 1)
    const scale = this.fitMode === 'cover'
      ? (imageAspect > canvasAspect ? height / this.imageHeight : width / this.imageWidth)
      : (imageAspect > canvasAspect ? width / this.imageWidth : height / this.imageHeight)
    const drawWidth = this.imageWidth * scale
    const drawHeight = this.imageHeight * scale
    const drawX = (width - drawWidth) * 0.5
    const drawY = (height - drawHeight) * 0.5

    this.context.fillStyle = '#05070c'
    this.context.fillRect(0, 0, width, height)
    this.context.imageSmoothingEnabled = true
    this.context.imageSmoothingQuality = 'high'
    this.context.drawImage(this.image, drawX, drawY, drawWidth, drawHeight)
  }

  private drawFallback(now: number, width: number, height: number) {
    const ctx = this.context
    const t = now * 0.001
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#10233f')
    gradient.addColorStop(0.38, '#18171f')
    gradient.addColorStop(0.7, '#3b1d22')
    gradient.addColorStop(1, '#07090e')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    const grid = Math.max(36, Math.round(Math.min(width, height) * 0.06))
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'
    ctx.lineWidth = Math.max(1, width / 2400)
    ctx.beginPath()
    for (let x = (Math.sin(t * 0.2) * grid) % grid; x < width; x += grid) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    }
    for (let y = (Math.cos(t * 0.17) * grid) % grid; y < height; y += grid) {
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
    }
    ctx.stroke()

    const fontSize = Math.max(18, Math.round(Math.min(width, height) * 0.028))
    ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
    ctx.fillStyle = 'rgba(241,245,249,0.9)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Choose an image to use as background texture', width * 0.5, height * 0.5)
  }
}

import type { BlackHoleState } from '../types'
import type { SceneTextureSource } from '../scene/sceneTextureSource'
import { createBlackholeProgram, createCheckerboard, createFullscreenTriangleBuffer } from './webgl'

interface RendererOptions {
  canvas: HTMLCanvasElement
  sceneSource: SceneTextureSource
  getState(): BlackHoleState
  debugRawCapture: boolean
}

export class BlackholeRenderer {
  private readonly gl: WebGL2RenderingContext
  private readonly program: WebGLProgram
  private readonly sceneTexture: WebGLTexture
  private readonly startTime = performance.now()
  private frameHandle = 0
  private uploadedFrames = 0
  private stopped = false

  private readonly uniforms: Record<string, WebGLUniformLocation | null>

  constructor(private readonly options: RendererOptions) {
    const gl = options.canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!gl) {
      throw new Error('WebGL2 is not available')
    }

    options.canvas.dataset.sceneReady = 'false'
    this.gl = gl
    const { program, usedFallback } = createBlackholeProgram(gl)
    this.program = program

    console.info('[blackhole] WebGL2 context created', {
      renderer: gl.getParameter(gl.RENDERER),
      vendor: gl.getParameter(gl.VENDOR),
      usedFallback,
    })

    const positionBuffer = createFullscreenTriangleBuffer(gl)
    const positionLocation = gl.getAttribLocation(program, 'a_position')

    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    const texture = gl.createTexture()
    if (!texture) {
      throw new Error('Failed to create scene texture')
    }
    this.sceneTexture = texture

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)

    const checkerboardSize = 64
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      checkerboardSize,
      checkerboardSize,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      createCheckerboard(checkerboardSize),
    )

    this.uniforms = Object.fromEntries([
      'u_backgroundTexture',
      'u_resolution',
      'u_time',
      'u_debugRawCapture',
      'u_blackHoleCenter',
      'u_holeRadius',
      'u_lensDepth',
      'u_blackHoleMass',
      'u_photonRingBrightness',
      'u_diskInner',
      'u_diskOuter',
      'u_diskIncl',
      'u_diskRoll',
      'u_diskGain',
      'u_dopplerMix',
      'u_diskBeam',
      'u_exposure',
      'u_diskSpeed',
      'u_influenceScale',
      'u_edgeFadeWidth',
    ].map((name) => [name, gl.getUniformLocation(program, name)]))

    gl.uniform1i(this.uniforms.u_backgroundTexture, 0)
    window.addEventListener('resize', this.resize)
    this.resize()
  }

  start() {
    this.stopped = false
    const render = () => {
      this.renderFrame()
      this.frameHandle = requestAnimationFrame(render)
    }

    render()
  }

  stop() {
    this.stopped = true
    cancelAnimationFrame(this.frameHandle)
    window.removeEventListener('resize', this.resize)
  }

  markDirty(_durationMs = 1500) {
    // Parameter changes take effect every render frame through uniforms.
  }

  private readonly resize = () => {
    const { canvas } = this.options
    const width = Math.max(1, Math.floor(window.innerWidth * window.devicePixelRatio))
    const height = Math.max(1, Math.floor(window.innerHeight * window.devicePixelRatio))

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      this.markDirty()
    }
  }

  private renderFrame() {
    this.resize()
    this.uploadSceneTexture()

    const { canvas } = this.options
    const gl = this.gl
    const state = this.options.getState()
    const params = state.params
    const elapsed = (performance.now() - this.startTime) / 1000

    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)
    gl.uniform2f(this.uniforms.u_resolution, canvas.width, canvas.height)
    gl.uniform1f(this.uniforms.u_time, elapsed)
    gl.uniform1i(this.uniforms.u_debugRawCapture, this.options.debugRawCapture ? 1 : 0)
    gl.uniform2f(this.uniforms.u_blackHoleCenter, params.centerX, params.centerY)
    gl.uniform1f(this.uniforms.u_holeRadius, params.holeRadius)
    gl.uniform1f(this.uniforms.u_lensDepth, params.lensDepth)
    gl.uniform1f(this.uniforms.u_blackHoleMass, params.blackHoleMass)
    gl.uniform1f(this.uniforms.u_photonRingBrightness, params.photonRingBrightness)
    gl.uniform1f(this.uniforms.u_diskInner, params.diskInner)
    gl.uniform1f(this.uniforms.u_diskOuter, params.diskOuter)
    gl.uniform1f(this.uniforms.u_diskIncl, params.diskIncl)
    gl.uniform1f(this.uniforms.u_diskRoll, params.diskRoll)
    gl.uniform1f(this.uniforms.u_diskGain, params.diskGain)
    gl.uniform1f(this.uniforms.u_dopplerMix, params.dopplerMix)
    gl.uniform1f(this.uniforms.u_diskBeam, params.diskBeam)
    gl.uniform1f(this.uniforms.u_exposure, params.exposure)
    gl.uniform1f(this.uniforms.u_diskSpeed, params.diskSpeed)
    gl.uniform1f(this.uniforms.u_influenceScale, params.influenceScale)
    gl.uniform1f(this.uniforms.u_edgeFadeWidth, params.edgeFadeWidth)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  private uploadSceneTexture() {
    const { canvas, sceneSource } = this.options
    if (!sceneSource.isReady()) {
      return
    }

    const source = sceneSource.getFrame(performance.now(), canvas.width, canvas.height)
    if (!source) {
      return
    }

    this.uploadSourceTexture(source)
  }

  private uploadSourceTexture(source: TexImageSource) {
    if (this.stopped) {
      return
    }

    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    this.uploadedFrames += 1
    this.options.canvas.dataset.sceneReady = 'true'

    if (this.uploadedFrames === 1 || this.uploadedFrames % 240 === 0) {
      console.info('[blackhole] uploaded input texture ' + JSON.stringify({
        source: this.options.sceneSource.label,
        frames: this.uploadedFrames,
      }))
    }
  }
}

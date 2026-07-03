import './style.css'
import { DEBUG_RAW_CAPTURE } from './config'
import { createDefaultParams, resetParams } from './controls/blackHoleParams'
import { BlackholeRenderer } from './rendering/blackholeRenderer'
import { ImageSceneSource, type ImageFitMode } from './scene/imageSceneSource'
import type { BlackHoleParams, BlackHoleState } from './types'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <canvas id="blackhole-canvas" aria-label="Black hole image simulator"></canvas>
  <aside id="control-panel">
    <header>
      <strong>Black Hole</strong>
      <span id="source-label">background texture</span>
      <button id="collapse-controls" type="button" aria-label="Collapse controls">-</button>
    </header>
    <label class="file-picker">
      <input id="image-input" type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/bmp,image/svg+xml" />
      <span>Choose image</span>
    </label>
    <select id="fit-mode" aria-label="Image fit mode">
      <option value="contain">Contain</option>
      <option value="cover">Cover</option>
    </select>
    <button id="reset-params" type="button">Reset parameters</button>
    <div id="sliders"></div>
    <p id="image-info">No image selected</p>
  </aside>
  <button id="restore-controls" type="button" aria-label="Show controls">BH</button>
`

const canvas = document.querySelector<HTMLCanvasElement>('#blackhole-canvas')
if (!canvas) {
  throw new Error('Black hole canvas was not mounted')
}
const blackholeCanvas = canvas

const imageSource = new ImageSceneSource()
const state: BlackHoleState = {
  params: createDefaultParams(),
}

console.info('[blackhole] image simulator renderer loaded', {
  debugRawCapture: DEBUG_RAW_CAPTURE,
  sceneSource: imageSource.label,
})

const renderer = new BlackholeRenderer({
  canvas,
  sceneSource: imageSource,
  debugRawCapture: DEBUG_RAW_CAPTURE,
  getState: () => state,
})

renderer.start()
void Promise.resolve(imageSource.start()).catch((error) => {
  console.error('[blackhole] scene source error', error)
})

const unsubscribeCommand = window.blackholeWindow.onCommand((command) => {
  if (command === 'reset') {
    resetParams(state.params)
    syncSliders()
    renderer.markDirty(2200)
  }
})

let draggingBlackHole = false

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) {
    return
  }

  draggingBlackHole = true
  canvas.setPointerCapture(event.pointerId)
  updateBlackHoleCenter(event)
})

canvas.addEventListener('pointermove', (event) => {
  if (draggingBlackHole) {
    updateBlackHoleCenter(event)
  }
})

canvas.addEventListener('pointerup', (event) => {
  if (draggingBlackHole) {
    draggingBlackHole = false
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }
  }
})

canvas.addEventListener('pointercancel', () => {
  draggingBlackHole = false
})

window.addEventListener('beforeunload', () => {
  renderer.stop()
  unsubscribeCommand()
  imageSource.stop()
})

function updateBlackHoleCenter(event: PointerEvent) {
  const rect = blackholeCanvas.getBoundingClientRect()
  state.params.centerX = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1)
  state.params.centerY = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1)
  renderer.markDirty(500)
}

function mountControls() {
  const sourceLabel = document.querySelector<HTMLSpanElement>('#source-label')
  const imageInfo = document.querySelector<HTMLParagraphElement>('#image-info')
  const imageInput = document.querySelector<HTMLInputElement>('#image-input')
  const fitMode = document.querySelector<HTMLSelectElement>('#fit-mode')
  const resetButton = document.querySelector<HTMLButtonElement>('#reset-params')
  const collapseButton = document.querySelector<HTMLButtonElement>('#collapse-controls')
  const restoreButton = document.querySelector<HTMLButtonElement>('#restore-controls')

  if (sourceLabel) {
    sourceLabel.textContent = 'background texture: image'
  }

  fitMode?.addEventListener('change', () => {
    imageSource?.setFitMode(fitMode.value as ImageFitMode)
    updateImageInfo()
    renderer.markDirty(600)
  })

  imageInput?.addEventListener('change', () => {
    const file = imageInput.files?.[0]
    if (!file) {
      return
    }

    imageSource.loadFile(file)
      .then(() => {
        updateImageInfo()
        renderer.markDirty(1000)
      })
      .catch((error) => {
        console.error('[blackhole] failed to load image', error)
        if (imageInfo) {
          imageInfo.textContent = `Could not decode ${file.name}`
        }
      })
  })

  resetButton?.addEventListener('click', () => {
    resetParams(state.params)
    syncSliders()
    renderer.markDirty(1000)
  })

  collapseButton?.addEventListener('click', () => {
    document.body.classList.add('controls-collapsed')
  })

  restoreButton?.addEventListener('click', () => {
    document.body.classList.remove('controls-collapsed')
  })

  mountSliders()
  syncSliders()
  updateImageInfo()
}

function updateImageInfo() {
  const imageInfo = document.querySelector<HTMLParagraphElement>('#image-info')
  if (!imageInfo) {
    return
  }

  const info = imageSource.getInfo()
  imageInfo.textContent = info.width > 0
    ? `${info.name} · ${info.width}x${info.height} · ${info.fitMode}`
    : 'No image selected'
}

function mountSliders() {
  const root = document.querySelector<HTMLDivElement>('#sliders')
  if (!root) {
    return
  }

  root.innerHTML = ''
  for (const spec of sliderSpecs) {
    const label = document.createElement('label')
    label.className = 'slider-row'
    label.innerHTML = `
      <span>${spec.label}</span>
      <input type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}" data-key="${spec.key}" />
      <output data-output="${spec.key}"></output>
    `
    root.appendChild(label)
  }

  root.addEventListener('input', (event) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement)) {
      return
    }

    const key = input.dataset.key as keyof BlackHoleParams | undefined
    if (!key) {
      return
    }

    state.params[key] = Number(input.value)
    syncOutput(key)
    renderer.markDirty(400)
  })
}

function syncSliders() {
  for (const spec of sliderSpecs) {
    const input = document.querySelector<HTMLInputElement>(`input[data-key="${spec.key}"]`)
    if (input) {
      input.value = String(state.params[spec.key])
    }
    syncOutput(spec.key)
  }
}

function syncOutput(key: keyof BlackHoleParams) {
  const output = document.querySelector<HTMLOutputElement>(`output[data-output="${key}"]`)
  if (output) {
    output.textContent = formatParam(state.params[key])
  }
}

function formatParam(value: number) {
  if (Math.abs(value) >= 10) {
    return value.toFixed(1)
  }
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

const sliderSpecs: Array<{
  key: keyof BlackHoleParams
  label: string
  min: number
  max: number
  step: number
}> = [
  { key: 'holeRadius', label: 'HOLE RADIUS', min: 0.012, max: 0.12, step: 0.001 },
  { key: 'lensDepth', label: 'LENS DEPTH', min: 2, max: 26, step: 0.05 },
  { key: 'blackHoleMass', label: 'BLACK HOLE MASS', min: 0.6, max: 1.8, step: 0.01 },
  { key: 'diskIncl', label: 'DISK INCL', min: 0, max: 1.57, step: 0.01 },
  { key: 'diskRoll', label: 'DISK ROLL', min: 0, max: 6.283, step: 0.01 },
  { key: 'diskInner', label: 'DISK INNER', min: 1.55, max: 5, step: 0.01 },
  { key: 'diskOuter', label: 'DISK OUTER', min: 3, max: 14, step: 0.05 },
  { key: 'diskGain', label: 'DISK GAIN', min: 0, max: 4, step: 0.01 },
  { key: 'photonRingBrightness', label: 'PHOTON RING', min: 0, max: 2.5, step: 0.01 },
  { key: 'dopplerMix', label: 'DOPPLER MIX', min: 0, max: 1, step: 0.01 },
  { key: 'diskBeam', label: 'DISK BEAM', min: 0.5, max: 5, step: 0.05 },
  { key: 'exposure', label: 'EXPOSURE', min: 0.2, max: 3, step: 0.01 },
  { key: 'diskSpeed', label: 'DISK SPEED', min: -3, max: 3, step: 0.01 },
  { key: 'influenceScale', label: 'INFLUENCE SCALE', min: 2, max: 10, step: 0.05 },
]

mountControls()

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

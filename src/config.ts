import type { BlackHoleParams } from './types'

export const DEFAULT_PARAMS: BlackHoleParams = {
  centerX: 0.5,
  centerY: 0.5,
  holeRadius: 0.045,
  lensDepth: 13.0,
  blackHoleMass: 1.0,
  photonRingBrightness: 0.72,
  diskInner: 1.8,
  diskOuter: 7.2,
  diskIncl: 1.5,
  diskRoll: 0.35,
  diskGain: 1.15,
  dopplerMix: 0.6,
  diskBeam: 2.5,
  exposure: 1.35,
  diskSpeed: 1.0,
  influenceScale: 7.0,
  edgeFadeWidth: 0.18,
}

export const PARAM_LIMITS = {
  holeRadius: { min: 0.018, max: 0.095, step: 0.003 },
  lensDepth: { min: 2.0, max: 26.0, step: 0.25 },
  diskGain: { min: 0.0, max: 3.0, step: 0.08 },
} as const

export const DEBUG_RAW_CAPTURE = getBooleanParam('debugRawCapture') || getBooleanParam('debugRawCrop')

function getBooleanParam(name: string) {
  const value = new URLSearchParams(window.location.search).get(name)?.toLowerCase()
  return value === '1' || value === 'true' || value === 'yes'
}

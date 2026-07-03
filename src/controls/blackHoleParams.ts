import { DEFAULT_PARAMS, PARAM_LIMITS } from '../config'
import type { BlackHoleParams } from '../types'

export function createDefaultParams(): BlackHoleParams {
  return { ...DEFAULT_PARAMS }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function resetParams(target: BlackHoleParams) {
  Object.assign(target, DEFAULT_PARAMS)
}

export function adjustRadius(params: BlackHoleParams, delta: number) {
  params.holeRadius = clamp(params.holeRadius + delta, PARAM_LIMITS.holeRadius.min, PARAM_LIMITS.holeRadius.max)
}

export function adjustLensStrength(params: BlackHoleParams, delta: number) {
  params.lensDepth = clamp(
    params.lensDepth + delta,
    PARAM_LIMITS.lensDepth.min,
    PARAM_LIMITS.lensDepth.max,
  )
}

export function adjustDiskBrightness(params: BlackHoleParams, delta: number) {
  params.diskGain = clamp(
    params.diskGain + delta,
    PARAM_LIMITS.diskGain.min,
    PARAM_LIMITS.diskGain.max,
  )
}

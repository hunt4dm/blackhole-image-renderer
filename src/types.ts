export interface BlackHoleParams {
  centerX: number
  centerY: number
  holeRadius: number
  lensDepth: number
  blackHoleMass: number
  photonRingBrightness: number
  diskInner: number
  diskOuter: number
  diskIncl: number
  diskRoll: number
  diskGain: number
  dopplerMix: number
  diskBeam: number
  exposure: number
  diskSpeed: number
  influenceScale: number
  edgeFadeWidth: number
}

export interface BlackHoleState {
  params: BlackHoleParams
}

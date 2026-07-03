import { blackholeFragmentShaderSource, errorFragmentShaderSource, vertexShaderSource } from './shaders'

export interface BlackholeProgram {
  program: WebGLProgram
  usedFallback: boolean
}

export function createBlackholeProgram(gl: WebGL2RenderingContext): BlackholeProgram {
  try {
    return {
      program: createProgram(gl, blackholeFragmentShaderSource, 'blackhole'),
      usedFallback: false,
    }
  } catch (error) {
    console.error('[blackhole] rendering red shader fallback', error)
    return {
      program: createProgram(gl, errorFragmentShaderSource, 'red-fallback'),
      usedFallback: true,
    }
  }
}

export function createFullscreenTriangleBuffer(gl: WebGL2RenderingContext) {
  const buffer = gl.createBuffer()
  if (!buffer) {
    throw new Error('Failed to create fullscreen buffer')
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1,
  ]), gl.STATIC_DRAW)

  return buffer
}

export function createCheckerboard(size: number) {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4
      const bright = ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) === 0
      const value = bright ? 210 : 42
      data[offset] = value
      data[offset + 1] = value
      data[offset + 2] = bright ? 220 : 54
      data[offset + 3] = 255
    }
  }

  return data
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string, label: string) {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error(`Failed to create ${label} shader`)
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error'
    console.error(`[blackhole] ${label} shader compile error`, message)
    if (type === gl.FRAGMENT_SHADER) {
      console.error('[blackhole] full fragment shader source', source)
    }
    gl.deleteShader(shader)
    throw new Error(message)
  }

  return shader
}

function createProgram(gl: WebGL2RenderingContext, fragmentSource: string, label: string) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource, `${label}:vertex`)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, `${label}:fragment`)
  const program = gl.createProgram()
  if (!program) {
    throw new Error(`Failed to create ${label} program`)
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown program link error'
    console.error(`[blackhole] ${label} program link error`, message)
    gl.deleteProgram(program)
    throw new Error(message)
  }

  return program
}

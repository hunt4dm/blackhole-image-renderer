# Blackhole Image Renderer

Blackhole Image Renderer is an Electron desktop app that renders a realtime black hole lensing effect over local images. The renderer is built with TypeScript, Vite, WebGL2, and a custom fragment shader.

## Features

- Load a local image and render it through a black hole lensing shader.
- Drag the black hole center directly on the canvas.
- Tune radius, lensing strength, accretion disk, photon ring, exposure, Doppler mix, and related shader parameters.
- Package macOS and Windows builds with Electron Builder.

## Requirements

- Node.js 18 or newer.
- pnpm 8 or newer.
- A GPU/browser environment with WebGL2 support.

## Install

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

## Build

```bash
pnpm run build
```

The build command emits renderer files into `dist/` and Electron main/preload files into `dist-electron/`.

## Package

```bash
pnpm run package:win
pnpm run package:mac
```

Packaged artifacts are written to `release/<version>/`.

## Main Dependencies

The project dependencies are declared in `package.json` and locked by `pnpm-lock.yaml`.

- Electron: desktop runtime and native window management.
- Vite: renderer and Electron build pipeline.
- TypeScript: type checking and source compilation.
- Electron Builder: distributable app packaging.
- vite-plugin-electron and vite-plugin-electron-renderer: Vite integration for Electron main, preload, and renderer processes.

Runtime browser APIs used by the renderer include WebGL2, Canvas 2D, and local file input decoding.

## References

The physical model and visual design are based on these open-source works:

- Eric Bruneton, Black Hole Shader:
  https://github.com/ebruneton/black_hole_shader
- ghostty-blackhole by s13k:
  https://github.com/s13k/ghostty-blackhole

## LICENSE

MIT
import fs from 'node:fs/promises'
import {defineConfig} from 'tsup'

const DESKTOP_OUT = 'dist/desktop'

// `npm run build` wipes dist first — these builds run in parallel, so none of them cleans
export default defineConfig([
  // the terminal app — `npx yoinks`
  {
    entry: ['src/cli.tsx'],
    format: 'esm',
    target: 'node18',
    clean: false,
    banner: {js: '#!/usr/bin/env node'},
  },
  // desktop main + preload — fully bundled, so the packaged app needs no node_modules
  {
    entry: {main: 'src/desktop/main.ts', preload: 'src/desktop/preload.ts'},
    outDir: DESKTOP_OUT,
    format: 'cjs',
    platform: 'node',
    target: 'node22',
    clean: false,
    // ffmpeg-static stays external: in dev it resolves from node_modules; the
    // packaged app ships ffmpeg.exe as a resource instead (see package.json)
    external: ['electron', 'ffmpeg-static'],
    noExternal: [/^(?!electron$|ffmpeg-static$)/],
    outExtension: () => ({js: '.cjs'}),
    async onSuccess() {
      await fs.mkdir(DESKTOP_OUT, {recursive: true})
      await fs.copyFile('src/desktop/renderer/index.html', `${DESKTOP_OUT}/index.html`)
      await fs.copyFile('src/desktop/renderer/styles.css', `${DESKTOP_OUT}/styles.css`)
      await fs.copyFile('build/icon.png', `${DESKTOP_OUT}/icon.png`)
    },
  },
  // desktop ui
  {
    entry: {renderer: 'src/desktop/renderer/index.tsx'},
    outDir: DESKTOP_OUT,
    format: 'iife',
    platform: 'browser',
    target: 'chrome130',
    clean: false,
    minify: true,
    noExternal: [/.*/],
    outExtension: () => ({js: '.js'}),
    define: {'process.env.NODE_ENV': '"production"'},
  },
])

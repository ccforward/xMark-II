import { build } from 'esbuild'
import { resolve } from 'path'
import { cpSync } from 'fs'

// Build background service worker (bundles Dexie + db + api into one file)
await build({
  entryPoints: [resolve(import.meta.dirname, 'src/background.js')],
  bundle: true,
  outfile: resolve(import.meta.dirname, 'dist/background.js'),
  format: 'esm',
  target: 'chrome120',
  minify: false,
})

// Copy static files that Vite doesn't handle
const publicDir = resolve(import.meta.dirname, 'public')
const distDir = resolve(import.meta.dirname, 'dist')

// Content scripts (not processed by Vite)
cpSync(resolve(publicDir, 'content-inject.js'), resolve(distDir, 'content-inject.js'))
cpSync(resolve(publicDir, 'content.js'), resolve(distDir, 'content.js'))

// Popup
cpSync(resolve(publicDir, 'popup.html'), resolve(distDir, 'popup.html'))
cpSync(resolve(publicDir, 'popup.js'), resolve(distDir, 'popup.js'))

// Icons
cpSync(resolve(publicDir, 'icons'), resolve(distDir, 'icons'), { recursive: true })

// Manifest
cpSync(resolve(publicDir, 'manifest.json'), resolve(distDir, 'manifest.json'))

console.log('Build complete! Load dist/ as unpacked extension in Chrome.')

import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

/** Emits sw.js with the exact list of built files, so the game works offline after one visit. */
function serviceWorker(): Plugin {
  return {
    name: 'misdeal-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).map((f) => `/${f}`)
      const pub = readdirSync('public').map((f) => `/${f}`)
      const files = ['/', ...new Set([...built, ...pub])].filter((f) => !f.endsWith('.map'))
      const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 12)
      const source = readFileSync('build/sw-template.js', 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(files))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  build: {
    // iPadOS 16+ Safari
    target: ['es2022', 'safari16'],
  },
})

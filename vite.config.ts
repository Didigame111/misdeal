import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? listFiles(path) : [path]
  })
}

/**
 * Writes sw.js after the build with the exact list of output files, so the game works offline after one visit.
 * The cache version hashes file contents, so any change (even to an icon in public/) ships a new worker.
 */
function serviceWorker(): Plugin {
  return {
    name: 'misdeal-service-worker',
    apply: 'build',
    writeBundle(options) {
      const dir = options.dir!
      const files = listFiles(dir)
        .map((path) => relative(dir, path).split('\\').join('/'))
        // Safari 16+ only ever fetches the woff2 fonts.
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !f.endsWith('.woff'))
        .sort()
      const hash = createHash('sha256')
      for (const f of files) hash.update(f).update(readFileSync(join(dir, f)))
      const source = readFileSync('build/sw-template.js', 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(['/', ...files.map((f) => `/${f}`)]))
      writeFileSync(join(dir, 'sw.js'), source)
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

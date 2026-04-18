import path from 'node:path'
import fs from 'node:fs'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import zip from 'vite-plugin-zip-pack'
import manifest from './manifest.config.js'
import { version } from './package.json'

/**
 * CRXJS 2.x dev mode generates a content-script loader that dynamically
 * imports `vendor/crx-client-preamble.js` and `vendor/vite-client.js`
 * for HMR, but never creates these files. This plugin ensures the stubs
 * exist so the content script can load on any page.
 */
function crxPreambleStub() {
  const STUBS = ['crx-client-preamble.js', 'vite-client.js']

  function ensureStubs() {
    const dir = path.resolve(__dirname, 'dist', 'vendor')
    fs.mkdirSync(dir, { recursive: true })
    for (const file of STUBS) {
      const filePath = path.join(dir, file)
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, `// CRXJS stub for ${file}\n`)
      }
    }
  }

  return {
    name: 'crx-preamble-stub',
    buildStart: ensureStubs,
    configureServer: ensureStubs,
    writeBundle: ensureStubs,
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}`,
    },
  },
  plugins: [
    react(),
    crxPreambleStub(),
    crx({ manifest }),
    zip({ outDir: 'release', outFileName: `surdej-extension-v${version}.zip` }),
  ],
  server: {
    cors: {
      origin: [
        /chrome-extension:\/\//,
      ],
    },
  },
  build: {
    rollupOptions: {
      input: {
        welcome: path.resolve(__dirname, 'src/welcome/index.html'),
      },
    },
  },
})

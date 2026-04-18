import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: 'Surdej',
  version: pkg.version,
  description: 'Seamlessly integrates Surdej capabilities into your web browsing experience.',
  icons: {
    16: 'public/icon-16.png',
    48: 'public/icon-48.png',
    128: 'public/icon-128.png',
  },
  action: {
    default_icon: {
      16: 'public/icon-16.png',
      48: 'public/icon-48.png',
      128: 'public/icon-128.png',
    },
    // No default_popup — clicking the icon opens the side panel via background script
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  permissions: [
    'sidePanel',
    'storage',
    'activeTab',
    'tabs',
    'scripting',
  ],
  host_permissions: [
    '<all_urls>',
  ],
  content_scripts: [{
    js: ['src/content/main.tsx'],
    matches: ['<all_urls>'],
  }],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  options_page: 'src/options/index.html',
})

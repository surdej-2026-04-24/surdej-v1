#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# Post-build script for the Surdej browser extension.
#
# After `vite build` produces the zip in apps/extension/release/,
# this script:
#   1. Copies the zip to apps/frontend/public/extensions/
#   2. Updates the versions.json manifest with the new version
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
EXT_DIR="$REPO_ROOT/apps/extension"
PUBLIC_DIR="$REPO_ROOT/apps/frontend/public/extensions"

# Read version from package.json
VERSION=$(node -p "require('$EXT_DIR/package.json').version")
ZIP_NAME="surdej-extension-v${VERSION}.zip"
ZIP_SRC="$EXT_DIR/release/$ZIP_NAME"

if [ ! -f "$ZIP_SRC" ]; then
  echo "❌ Extension zip not found: $ZIP_SRC"
  echo "   Run 'cd apps/extension && npx vite build' first."
  exit 1
fi

# Ensure target dir exists
mkdir -p "$PUBLIC_DIR"

# Copy the zip
cp "$ZIP_SRC" "$PUBLIC_DIR/$ZIP_NAME"
echo "✅ Copied $ZIP_NAME → frontend/public/extensions/"

# Update versions.json
TODAY=$(date +%Y-%m-%d)
NOTES="${RELEASE_NOTES:-"Extension build v${VERSION}"}"

node -e "
const fs = require('fs');
const path = '$PUBLIC_DIR/versions.json';
let data = { latest: '', versions: [] };
try { data = JSON.parse(fs.readFileSync(path, 'utf8')); } catch {}

// Update latest
data.latest = '$VERSION';

// Add or update this version entry
const idx = data.versions.findIndex(v => v.version === '$VERSION');
const entry = {
  version: '$VERSION',
  date: '$TODAY',
  filename: '$ZIP_NAME',
  notes: '$NOTES',
};
if (idx >= 0) data.versions[idx] = entry;
else data.versions.unshift(entry);

fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log('✅ Updated versions.json (latest: $VERSION)');
"

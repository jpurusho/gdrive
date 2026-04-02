#!/bin/bash
# Verify that the project builds correctly
set -e

echo "=== Verifying GDrive Sync Build ==="

echo "1. Type-checking main process..."
npx tsc -p tsconfig.main.json --noEmit
echo "   OK"

echo "2. Type-checking renderer..."
npx tsc -p tsconfig.json --noEmit
echo "   OK"

echo "3. Building main process..."
npx tsc -p tsconfig.main.json
echo "   OK"

echo "4. Building renderer..."
npx vite build
echo "   OK"

echo "5. Checking dist output..."
test -f dist/desktop/index.js && echo "   dist/desktop/index.js exists" || echo "   MISSING: dist/desktop/index.js"
test -f dist/desktop/preload.js && echo "   dist/desktop/preload.js exists" || echo "   MISSING: dist/desktop/preload.js"
test -f dist/renderer/index.html && echo "   dist/renderer/index.html exists" || echo "   MISSING: dist/renderer/index.html"

echo ""
echo "=== Build verification complete ==="

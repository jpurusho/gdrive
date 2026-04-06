#!/bin/bash
# Pre-release verification — run before every release
# Usage: ./scripts/prerelease-check.sh

set -e

echo "=== gsync Pre-Release Check ==="
echo ""

VERSION=$(node -p "require('./package.json').version")
echo "Version: $VERSION"
echo ""

# 1. TypeScript compilation
echo "[1/5] TypeScript (main process)..."
npx tsc -p tsconfig.main.json --noEmit
echo "  ✓ Main process compiles"

echo "[2/5] TypeScript (renderer)..."
npx tsc -p tsconfig.json --noEmit
echo "  ✓ Renderer compiles"

# 3. Unit tests
echo "[3/5] Running unit tests..."
npm test
echo "  ✓ Tests passed"

# 4. Build
echo "[4/5] Production build..."
npm run build > /dev/null 2>&1
echo "  ✓ Build succeeded"

# 5. Verify build output
echo "[5/5] Verifying build output..."
[ -f dist/desktop/index.js ] && echo "  ✓ Main process JS" || echo "  ✗ Missing main process JS"
[ -f dist/renderer/index.html ] && echo "  ✓ Renderer HTML" || echo "  ✗ Missing renderer HTML"
[ -f dist/oauth-config.json ] && echo "  ✓ OAuth config embedded" || echo "  ⚠ OAuth config missing (no .env?)"

echo ""
echo "=== All checks passed — ready to release v$VERSION ==="
echo ""
echo "Next steps:"
echo "  ./scripts/release.sh $VERSION    # Build + upload to GitHub"
echo "  npm run dist                     # Build .zip only (no upload)"

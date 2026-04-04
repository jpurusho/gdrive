#!/bin/bash
# Local build and release to GitHub
# Usage: ./scripts/release.sh [version]
# Example: ./scripts/release.sh 2.1.0

set -e

# Unset GH_TOKEN so gh CLI uses keyring auth (jpurusho account)
unset GH_TOKEN

VERSION="${1:-$(node -p "require('./package.json').version")}"
TAG="v${VERSION}"
ZIP="release/gsync-${VERSION}-universal-mac.zip"
YML="release/latest-mac.yml"
BLOCKMAP="release/gsync-${VERSION}-universal-mac.zip.blockmap"

echo "=== gsync Release ${TAG} ==="
echo ""

# 1. Build
echo "[1/4] Building..."
npm run build

# 2. Package
echo "[2/4] Packaging macOS..."
npx electron-builder build --mac --publish never

# 3. Verify artifacts
echo "[3/4] Verifying artifacts..."
if [ ! -f "$ZIP" ]; then
  echo "ERROR: $ZIP not found"
  exit 1
fi
echo "  ZIP: $(du -h "$ZIP" | cut -f1)"
echo "  YML: $(du -h "$YML" | cut -f1)"

# 4. Upload to GitHub Release
echo "[4/4] Uploading to GitHub Release ${TAG}..."

# Create release if it doesn't exist
gh release view "$TAG" --repo jpurusho/gdrive > /dev/null 2>&1 || \
  gh release create "$TAG" \
    --repo jpurusho/gdrive \
    --title "gsync ${TAG}" \
    --notes "## gsync ${TAG}

### macOS Install
1. Download the \`.zip\` file below
2. Extract it (double-click)
3. Move \`gsync.app\` to \`/Applications\`
4. Run once: \`xattr -rc /Applications/gsync.app\`
5. Open gsync

### Auto-Update
If you have a previous version installed, the app will auto-update to this release."

# Upload assets (delete existing first if re-uploading)
for FILE in "$ZIP" "$YML" "$BLOCKMAP"; do
  if [ -f "$FILE" ]; then
    BASENAME=$(basename "$FILE")
    # Delete existing asset if present
    gh release delete-asset "$TAG" "$BASENAME" --repo jpurusho/gdrive -y 2>/dev/null || true
    gh release upload "$TAG" "$FILE" --repo jpurusho/gdrive
    echo "  Uploaded: $BASENAME"
  fi
done

echo ""
echo "=== Release ${TAG} published ==="
echo "https://github.com/jpurusho/gdrive/releases/tag/${TAG}"

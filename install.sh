#!/usr/bin/env bash
set -euo pipefail

OWNER="Mahdieft03"
REPO="antigravity-rtl-math"
INSTALL_DIR="${AG_RTL_INSTALL_DIR:-$HOME/.local/share/antigravity-rtl-math}"
BIN_DIR="${AG_RTL_BIN_DIR:-$HOME/.local/bin}"

echo ""
echo "  === Antigravity RTL + Math Installer ==="
echo "  Inspired by https://github.com/mmnaderi/antigravity-rtl"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  [ERROR] Node.js 20+ is required. Install from https://nodejs.org" >&2
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "  [ERROR] Node.js $NODE_MAJOR detected; version 20+ is required." >&2
  exit 1
fi

for tool in curl tar npm; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "  [ERROR] Required command '$tool' not found." >&2
    exit 1
  fi
done

TMP_DIR=$(mktemp -d)
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

TARBALL_URL="https://github.com/$OWNER/$REPO/archive/refs/heads/main.tar.gz"
RELEASE_JSON=$(curl -fsSL -H "User-Agent: antigravity-rtl-math-installer" "https://api.github.com/repos/$OWNER/$REPO/releases/latest" 2>/dev/null || true)
TAG_URL=$(printf '%s' "$RELEASE_JSON" | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{try{const j=JSON.parse(s);if(j.tarball_url)console.log(j.tarball_url)}catch{}})" || true)
if [ -n "$TAG_URL" ]; then
  TARBALL_URL="$TAG_URL"
fi

echo "  [RTL+Math] Downloading from $TARBALL_URL ..."
curl -fsSL -L -H "User-Agent: antigravity-rtl-math-installer" "$TARBALL_URL" -o "$TMP_DIR/bundle.tar.gz"
mkdir -p "$TMP_DIR/src"
tar -xzf "$TMP_DIR/bundle.tar.gz" -C "$TMP_DIR/src" --strip-components=1

mkdir -p "$INSTALL_DIR"
rm -rf "$INSTALL_DIR/src" "$INSTALL_DIR/assets" "$INSTALL_DIR/demo" "$INSTALL_DIR/docs" "$INSTALL_DIR/test"
cp -R "$TMP_DIR/src/." "$INSTALL_DIR/"

echo "  [RTL+Math] Installing runtime dependencies..."
(cd "$INSTALL_DIR" && npm install --omit=dev --no-audit --no-fund >/dev/null)

mkdir -p "$BIN_DIR"
cat > "$BIN_DIR/antigravity-rtl-math" <<EOF
#!/usr/bin/env bash
exec node "$INSTALL_DIR/src/cli.js" "\$@"
EOF
chmod +x "$BIN_DIR/antigravity-rtl-math"

if [ -n "${AG_RTL_PRESET:-}" ] || [ -n "${AG_RTL_LANG:-}" ]; then
  ARGS=()
  [ -n "${AG_RTL_PRESET:-}" ] && ARGS+=(--preset "$AG_RTL_PRESET")
  [ -n "${AG_RTL_LANG:-}" ] && ARGS+=(--lang "$AG_RTL_LANG")
  node "$INSTALL_DIR/src/cli.js" "${ARGS[@]}"
fi

if [ "${AG_RTL_NO_PATCH:-0}" != "1" ]; then
  EXTRA=()
  [ "${AG_RTL_NO_GUARD:-0}" != "1" ] && EXTRA+=(--install-guard)
  node "$INSTALL_DIR/src/cli.js" --ensure "${EXTRA[@]}" || true
elif [ "${AG_RTL_NO_GUARD:-0}" != "1" ]; then
  node "$INSTALL_DIR/src/cli.js" --install-guard || true
fi

echo ""
echo "  [OK] Installed to $INSTALL_DIR"
echo "  [OK] Binary linked at $BIN_DIR/antigravity-rtl-math"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "  [TIP] Add to PATH: export PATH=\"$BIN_DIR:\$PATH\"" ;;
esac
echo "  Press Alt+R inside Antigravity to open the settings panel."
echo ""

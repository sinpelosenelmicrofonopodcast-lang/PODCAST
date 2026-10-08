#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3.10+ is required. Installation stopped."
  exit 2
fi
python3 -c 'import sys; assert sys.version_info >= (3,10), "Python 3.10+ is required"'
target="$HOME/Library/Application Support/SPM Podcast Editor"
mkdir -p "$target"
cp -R spm_editor "$target/"
cat > "$target/spm-editor" <<'SH'
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
exec python3 -m spm_editor "$@"
SH
chmod +x "$target/spm-editor"
echo "Installed development engine. See README for required JSON inputs and remaining features."
echo "$target/spm-editor"

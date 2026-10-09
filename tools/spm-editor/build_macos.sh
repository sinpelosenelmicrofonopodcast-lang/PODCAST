#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
python3 -m PyInstaller --noconfirm --clean --windowed --onedir \
  --name "SPM Podcast Editor" \
  --collect-all faster_whisper --collect-all ctranslate2 \
  --add-binary "$(command -v ffmpeg):bin" \
  --add-binary "$(command -v ffprobe):bin" launch.py
codesign --force --deep --sign - "dist/SPM Podcast Editor.app"
mkdir -p release
pkgbuild --component "dist/SPM Podcast Editor.app" \
  --install-location /Applications --identifier com.sinpelos.podcasteditor \
  --version 3.0.0 release/SPM_Podcast_Editor_macOS.pkg
ditto -c -k --sequesterRsrc --keepParent "dist/SPM Podcast Editor.app" release/SPM_Podcast_Editor_macOS_App.zip
"dist/SPM Podcast Editor.app/Contents/MacOS/SPM Podcast Editor" validate example.contract-test.json --output build/cli-check
"dist/SPM Podcast Editor.app/Contents/MacOS/SPM Podcast Editor" --gui-smoke

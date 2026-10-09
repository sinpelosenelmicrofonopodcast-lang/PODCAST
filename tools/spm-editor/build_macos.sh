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
spm_pkg_root="build/pkg-root"
mkdir -p "$spm_pkg_root/Applications"
ditto "dist/SPM Podcast Editor.app" "$spm_pkg_root/Applications/SPM Podcast Editor.app"
spm_menu_dest="$spm_pkg_root/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Scripts/Utility"
mkdir -p "$spm_menu_dest"
cp "resolve_menu/SPM Podcast Editor.lua" "$spm_menu_dest/SPM Podcast Editor.lua"
pkgbuild --root "$spm_pkg_root" \
  --install-location / --identifier com.sinpelos.podcasteditor \
  --version 3.0.1 release/SPM_Podcast_Editor_macOS.pkg
ditto -c -k --sequesterRsrc --keepParent "dist/SPM Podcast Editor.app" release/SPM_Podcast_Editor_macOS_App.zip
"dist/SPM Podcast Editor.app/Contents/MacOS/SPM Podcast Editor" validate example.contract-test.json --output build/cli-check
"dist/SPM Podcast Editor.app/Contents/MacOS/SPM Podcast Editor" --gui-smoke

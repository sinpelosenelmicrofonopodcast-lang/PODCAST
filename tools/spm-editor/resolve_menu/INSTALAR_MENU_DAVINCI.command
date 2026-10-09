#!/bin/bash
set -euo pipefail
if [ "$(uname -s)" != "Darwin" ]; then
  echo "Este instalador es para macOS." >&2
  exit 1
fi
if [ ! -d "/Applications/SPM Podcast Editor.app" ]; then
  echo "Primero instala el .pkg de SPM Podcast Editor." >&2
  exit 1
fi
spm_menu_dir="$HOME/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Scripts/Utility"
mkdir -p "$spm_menu_dir"
spm_menu_file="$spm_menu_dir/SPM Podcast Editor.lua"
if [ -f "$spm_menu_file" ]; then
  cp -p "$spm_menu_file" "$spm_menu_file.backup.$(date +%Y%m%d_%H%M%S).$$"
fi
cat > "$spm_menu_file.new" <<'LUA'
-- Launch the bundled macOS app from Resolve's Scripts menu.
local ok = os.execute('/usr/bin/open -a "/Applications/SPM Podcast Editor.app"')
if ok == nil or ok == false or (type(ok) == 'number' and ok ~= 0) then
    print('SPM: instala SPM Podcast Editor.app en Applications antes de abrir este acceso.')
end
LUA
chmod 644 "$spm_menu_file.new"
mv -f "$spm_menu_file.new" "$spm_menu_file"
echo "INSTALADO. Cierra y vuelve a abrir DaVinci Resolve."
echo "Workspace > Scripts > Utility > SPM Podcast Editor"
if [ -t 0 ]; then read -r -p "Presiona Enter para cerrar…" spm_reply || true; fi

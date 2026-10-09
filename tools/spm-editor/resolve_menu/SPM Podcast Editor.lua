-- Launch the bundled macOS app from Resolve's Scripts menu.
local ok = os.execute('/usr/bin/open -a "/Applications/SPM Podcast Editor.app"')
if ok == nil or ok == false or (type(ok) == 'number' and ok ~= 0) then
    print('SPM: instala SPM Podcast Editor.app en Applications antes de abrir este acceso.')
end

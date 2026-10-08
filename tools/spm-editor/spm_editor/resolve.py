import importlib.util
import os
import sys
from pathlib import Path

class ResolveUnavailable(RuntimeError):
    pass

def connect():
    root=Path('/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting')
    module=root/'Modules/DaVinciResolveScript.py'
    if not module.is_file():
        raise ResolveUnavailable('Installed macOS Resolve scripting module not found')
    os.environ.setdefault('RESOLVE_SCRIPT_LIB','/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so')
    sys.path.insert(0,str(module.parent))
    spec=importlib.util.spec_from_file_location('DaVinciResolveScript',module)
    scripting=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(scripting)
    resolve=scripting.scriptapp('Resolve')
    if not resolve:
        raise ResolveUnavailable('Open Resolve and enable local external scripting')
    readme=root/'README.txt'
    return resolve, readme.read_text(errors='replace') if readme.is_file() else ''

def inspect_manifest(m):
    resolve,docs=connect()
    project=resolve.GetProjectManager().GetCurrentProject()
    if not project:
        raise ResolveUnavailable('No active project')
    matches=[project.GetTimelineByIndex(i) for i in range(1,project.GetTimelineCount()+1)]
    matches=[t for t in matches if t.GetName()==m['source']['timeline_name']]
    if len(matches)!=1:
        raise ResolveUnavailable('Source timeline must resolve uniquely')
    timeline=matches[0]
    features=['PerformMulticamSmartSwitch','SetVoiceIsolationState','CreateSubtitlesFromAudio',
              'SmartReframe','DuplicateTimeline','ImportTimelineFromFile']
    actual=timeline.GetSetting('timelineFrameRate')
    return {'resolve_version':resolve.GetVersionString(),'project':project.GetName(),
            'source_timeline':timeline.GetName(),'actual_frame_rate':actual,
            'capabilities_documented':{f:f in docs for f in features},
            'capabilities_tested':{f:False for f in features},
            'source_tracks':{k:timeline.GetTrackCount(k) for k in ['video','audio','subtitle']},
            'integration_status':'INSPECTED_NOT_EDITED'}

import json
import tempfile
import re
import unittest
from pathlib import Path
from spm_editor.engine import Engine
from spm_editor.resolve import ResolveUnavailable

class Clip:
    def __init__(self,a,b):self.a=a;self.b=b;self.properties={}
    def GetStart(self):return self.a
    def GetEnd(self):return self.b
    def PerformMulticamSmartSwitch(self,settings):self.switched=settings;return True
    def SmartReframe(self):return True
    def SetProperty(self,key,value):self.properties[key]=value;return True
    def GetProperty(self):return self.properties
    def SetFades(self,fades):self.fades=fades;return True
    def GetFades(self):return self.fades
    def GetLeftOffset(self):return 0
    def GetMediaPoolItem(self):return getattr(self,'media',object())
    def ImportFusionComp(self,path):
        text=Path(path).read_text()
        match=re.search(r'StyledText = Input \{ Value = ("(?:\\.|[^"\\])*")',text)
        value=json.loads(match[1])
        return type('Comp',(),{'FindTool':lambda s,name:s,'GetInput':lambda s,*args:value})()

class Timeline:
    def __init__(self,name):
        self.name=name;self.tracks={'video':[[]],'audio':[[]]};self.markers={};self.voice={}
    def GetName(self):return self.name
    def SetName(self,name):self.name=name;return True
    def GetStartFrame(self):return 86400
    def SetSetting(self,*args):return True
    def GetSetting(self,key):return '24'
    def GetTrackCount(self,kind):return len(self.tracks[kind])
    def AddTrack(self,kind):self.tracks[kind].append([]);return True
    def SetTrackName(self,*args):return True
    def SetTrackEnable(self,*args):return True
    def GetItemListInTrack(self,kind,index):return self.tracks[kind][index-1]
    def SetVoiceIsolationState(self,index,state):self.voice=state;return True
    def GetVoiceIsolationState(self,index):return self.voice
    def AddMarker(self,frame,color,name,text,length,custom):self.markers[frame]={'customData':custom,'note':text};return True
    def DeleteMarkerAtFrame(self,frame):self.markers.pop(frame,None);return True
    def GetMarkers(self):return self.markers
    def GetNormalizeAudioModes(self):return ['Integrated Loudness']
    def NormalizeAudioLevel(self,clips,options):self.normalization=options;return True

class Pool:
    def __init__(self,project):self.project=project
    def CreateEmptyTimeline(self,name):
        t=Timeline(name);self.project.timelines.append(t);return t
    def AppendToTimeline(self,infos):
        result=[]
        for info in infos:
            a=info['recordFrame'];b=a+info['endFrame']-info['startFrame']+1
            clip=Clip(a,b);kind='video' if info['mediaType']==1 else 'audio'
            self.project.current.tracks[kind][info['trackIndex']-1].append(clip)
            result.append(clip)
        return result
    def ImportMedia(self,paths):return [object() for path in paths]

class Project:
    def __init__(self):self.timelines=[];self.current=None;self.pool=Pool(self)
    def GetMediaPool(self):return self.pool
    def GetCurrentTimeline(self):return self.current
    def GetTimelineCount(self):return len(self.timelines)
    def GetTimelineByIndex(self,i):return self.timelines[i-1]
    def SetCurrentTimeline(self,t):self.current=t;return True
    def GetRenderJobList(self):return getattr(self,'jobs',[])
    def GetRenderCodecs(self,format):return {'H.264':'H264'}
    def SetCurrentRenderFormatAndCodec(self,*args):return True
    def SetCurrentRenderMode(self,*args):return True
    def SetRenderSettings(self,settings):self.render_settings=settings;return True
    def AddRenderJob(self):
        if not hasattr(self,'jobs'):self.jobs=[]
        identity=str(len(self.jobs)+1)
        self.jobs.append({'JobId':identity,'TimelineName':self.current.GetName(),
                          'OutputFilename':self.render_settings['CustomName']+'.mp4'})
        return identity

class Manager:
    def __init__(self):self.project=Project()
    def GetCurrentProject(self):return self.project
    def SaveProject(self):return True

class Resolve:
    def __init__(self):self.manager=Manager()
    def GetProjectManager(self):return self.manager

class NativeAdapterContractTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        m=json.loads((Path(__file__).parents[1]/'example.contract-test.json').read_text())
        self.r=Resolve();self.e=Engine(m,self.temp.name,resolve=self.r,docs='test')
        self.e.media=object();self.e.item=type('Source',(),{'GetLeftOffset':lambda s:0})()
    def tearDown(self):self.temp.cleanup()
    def test_master_assembly_preserves_original_length_and_duplicates_hook(self):
        t=self.e.master()
        self.assertEqual([(c.a,c.b) for c in t.tracks['video'][0]],[(86400,86640),(86640,89040)])
        self.assertEqual(len(t.tracks['audio'][0]),2)
        self.assertEqual(t.voice,{'isEnabled':True,'amount':35})
        self.assertTrue(all(c.switched for c in t.tracks['video'][0]))
    def test_repeated_master_does_not_duplicate(self):
        t=self.e.master();second=self.e.master()
        self.assertIs(t,second);self.assertEqual(len(self.r.manager.project.timelines),1)
    def test_existing_unmarked_timeline_is_preserved(self):
        self.e.pool.CreateEmptyTimeline('SPM_DEMO_MASTER_EDIT')
        with self.assertRaises(ResolveUnavailable):self.e.master()
        self.assertEqual(len(self.r.manager.project.timelines),1)
    def test_append_rejects_native_duration_mismatch(self):
        t,_=self.e.create('TEST',1920,1080)
        real=self.e.pool.AppendToTimeline
        def broken(infos):
            clips=real(infos);clips[0].b+=1;return clips
        self.e.pool.AppendToTimeline=broken
        with self.assertRaises(ResolveUnavailable):self.e.append(t,object(),0,24,86400)
    def test_voice_isolation_failure_is_not_success(self):
        t,_=self.e.create('TEST',1920,1080)
        t.SetVoiceIsolationState=lambda *args:False
        with self.assertRaises(ResolveUnavailable):self.e.audio(t)
    def test_source_failure_before_creating_timeline(self):
        with self.assertRaises(ResolveUnavailable):self.e.run()
        self.assertEqual(self.r.manager.project.timelines,[])
        result=json.loads((Path(self.temp.name)/'execution.json').read_text())
        self.assertEqual(result['status'],'FAILED')
    def test_partial_owned_timeline_recovery_preserves_backup(self):
        t,_=self.e.create('SPM_DEMO_MASTER_EDIT',1920,1080)
        rebuilt,_=self.e.create('SPM_DEMO_MASTER_EDIT',1920,1080)
        self.assertIsNot(t,rebuilt)
        self.assertIn('RECOVERY',t.GetName())
    def test_native_normalization_failure_is_not_success(self):
        t,_=self.e.create('TEST',1920,1080)
        self.e.append(t,object(),0,24,86400)
        t.NormalizeAudioLevel=lambda *args:False
        with self.assertRaises(RuntimeError):self.e.audio(t)
    def test_export_queue_uses_inclusive_final_frame_and_is_repeatable(self):
        from spm_editor.finishing import queue_exports
        self.e.master()
        jobs=queue_exports(self.e)
        self.assertEqual(len(jobs),1)
        self.assertEqual(self.e.project.render_settings['MarkOut'],89039)
        queue_exports(self.e)
        self.assertEqual(len(self.e.project.jobs),1)

if __name__=='__main__':unittest.main()

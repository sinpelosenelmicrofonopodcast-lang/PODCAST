import json
import tempfile
import unittest
from pathlib import Path
from spm_editor.engine import Engine
from spm_editor.resolve import ResolveUnavailable

class Clip:
    def __init__(self,a,b):self.a=a;self.b=b
    def GetStart(self):return self.a
    def GetEnd(self):return self.b
    def PerformMulticamSmartSwitch(self,settings):self.switched=settings;return True
    def SmartReframe(self):return True

class Timeline:
    def __init__(self,name):
        self.name=name;self.tracks={'video':[[]],'audio':[[]]};self.markers={};self.voice={}
    def GetName(self):return self.name
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
    def AddMarker(self,frame,color,name,text,length,custom):self.markers[frame]={'customData':custom};return True
    def GetMarkers(self):return self.markers

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

class Project:
    def __init__(self):self.timelines=[];self.current=None;self.pool=Pool(self)
    def GetMediaPool(self):return self.pool
    def GetCurrentTimeline(self):return self.current
    def GetTimelineCount(self):return len(self.timelines)
    def GetTimelineByIndex(self,i):return self.timelines[i-1]
    def SetCurrentTimeline(self,t):self.current=t;return True

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

if __name__=='__main__':unittest.main()

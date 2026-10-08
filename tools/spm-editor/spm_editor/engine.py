"""Native Resolve execution. Checks every mutating API response."""
import json
import re
from fractions import Fraction
from pathlib import Path
from .core import compile_plan, fingerprint, save_json, source_to_output
from .resolve import connect, ResolveUnavailable
from .media import protected_reel_ranges, caption_assets

def require(value,message):
    if value is None or value is False:
        raise ResolveUnavailable(message)
    return value

def sequence(value):
    return list(value.values()) if isinstance(value,dict) else list(value or [])

class Engine:
    def __init__(self,manifest,output,resolve=None,docs=None):
        self.m=manifest;self.plan=compile_plan(manifest)
        self.output=Path(output).resolve();self.output.mkdir(parents=True,exist_ok=True)
        self.resolve,self.docs=(resolve,docs or '') if resolve else connect()
        self.manager=require(self.resolve.GetProjectManager(),'No project manager')
        self.project=require(self.manager.GetCurrentProject(),'No current project')
        self.pool=require(self.project.GetMediaPool(),'No media pool')
        self.original=self.project.GetCurrentTimeline()
        self.state_path=self.output/'execution.json'
        self.state={'manifest_hash':fingerprint(manifest),'status':'RUNNING','timelines':{},
                    'review':[],'native_integration_verified':False,'project_modified':False}
        self.assets={};self.source=None;self.item=None

    def timelines(self):
        return [self.project.GetTimelineByIndex(i) for i in range(1,self.project.GetTimelineCount()+1)]

    def find(self,name):
        items=[t for t in self.timelines() if t.GetName()==name]
        if len(items)>1:raise ResolveUnavailable('Ambiguous timeline: '+name)
        return items[0] if items else None

    def checkpoint(self):
        require(self.manager.SaveProject(),'Resolve could not save project')
        save_json(self.state_path,self.state)

    def preflight(self):
        self.source=require(self.find(self.m['source']['timeline_name']),'Named source timeline not found')
        rate=float(self.source.GetSetting('timelineFrameRate'))
        if abs(rate-float(Fraction(self.m['source']['frame_rate'])))>0.001:
            raise ResolveUnavailable('JSON frame rate differs from source timeline')
        videos=sequence(self.source.GetItemListInTrack('video',1))
        if len(videos)!=1:
            raise ResolveUnavailable('This adapter requires one synchronized multicam item on source V1')
        self.item=videos[0]
        if int(self.item.GetStart())!=int(self.source.GetStartFrame()):
            raise ResolveUnavailable('Source item must start at source timeline frame zero')
        if int(self.item.GetEnd()-self.item.GetStart())!=self.m['source']['duration_frames']:
            raise ResolveUnavailable('Source duration does not match JSON')
        self.media=require(self.item.GetMediaPoolItem(),'Source multicam media unavailable')
        if not self.m['source'].get('multicam_verified'):
            raise ResolveUnavailable('source.multicam_verified must confirm the existing native multicam')
        if self.m['master_edit'].get('camera_decisions'):
            raise ResolveUnavailable('Exact angle instructions need an angle-selection adapter; SmartSwitch cannot certify them')
        if 'PerformMulticamSmartSwitch' not in self.docs:
            raise ResolveUnavailable('Installed documentation does not expose native Multicam SmartSwitch')
        if 'SetVoiceIsolationState' not in self.docs:
            raise ResolveUnavailable('Installed documentation does not expose Voice Isolation')
        for sponsor in self.m['sponsors']:
            if sponsor['mode'] not in ['INTERRUPTION','OVERLAY','LOWER_THIRD']:
                raise ResolveUnavailable('Unsupported sponsor placement mode: '+sponsor['mode'])
            self.asset(sponsor['id'],sponsor['asset_path'])
        intro=self.m['opening'].get('intro')
        if intro:self.asset(intro['asset_id'],intro['asset_path'])
        # Verify every reel locally before creating any output timelines.
        self.reel_plans={}
        for reel in self.m['reels']:
            pause=protected_reel_ranges(self.m,reel,self.output/'cache')
            overlay,cues=caption_assets(self.m,reel,pause['ranges'],self.output/'captions')
            self.reel_plans[reel['id']]={'pause':pause,'caption_path':str(overlay),'captions':cues}
        save_json(self.output/'source_to_output.json',self.plan)
        self.checkpoint()

    def asset(self,identity,path):
        if identity in self.assets:return self.assets[identity]
        p=Path(path)
        if not p.is_file():raise ResolveUnavailable('Required media missing: '+str(p))
        result=sequence(self.pool.ImportMedia([str(p.resolve())]))
        if len(result)!=1:raise ResolveUnavailable('Cannot import media: '+str(p))
        self.assets[identity]=result[0];return result[0]

    def create(self,name,width,height):
        existing=self.find(name)
        if existing:
            markers=existing.GetMarkers() or {}
            expected='SPM_DONE:'+fingerprint(self.m)
            if any(v.get('customData')==expected for v in markers.values()):
                return existing,True
            raise ResolveUnavailable('Existing incomplete/approved timeline preserved: '+name)
        timeline=require(self.pool.CreateEmptyTimeline(name),'Cannot create timeline '+name)
        self.state['project_modified']=True
        require(self.project.SetCurrentTimeline(timeline),'Cannot activate timeline')
        require(timeline.SetSetting('useCustomSettings','1'),'Cannot enable custom settings')
        require(timeline.SetSetting('timelineResolutionWidth',str(width)),'Cannot set width')
        require(timeline.SetSetting('timelineResolutionHeight',str(height)),'Cannot set height')
        fps=float(timeline.GetSetting('timelineFrameRate'))
        if abs(fps-float(Fraction(self.m['source']['frame_rate'])))>0.001:
            raise ResolveUnavailable('New timeline FPS differs; no automatic project retiming')
        for kind,names in [('video',['MULTICAM MASTER','SPONSORS / ADS','EDITOR NOTES','PROGRAM GRAPHICS']),
                           ('audio',['PODCAST DIALOGUE','SPONSOR AUDIO','MUSIC / EFFECTS'])]:
            while timeline.GetTrackCount(kind)<len(names):
                require(timeline.AddTrack(kind),'Cannot add '+kind+' track')
            for i,title in enumerate(names,1):require(timeline.SetTrackName(kind,i,title),'Cannot name track')
        require(timeline.SetTrackEnable('video',3,False),'Cannot disable production-only notes track')
        return timeline,False

    def append(self,timeline,media,a,b,record,video_track=1,audio_track=1,audio=True):
        require(self.project.SetCurrentTimeline(timeline),'Cannot activate output timeline')
        infos=[{'mediaPoolItem':media,'startFrame':a,'endFrame':b-1,'recordFrame':record,
                'mediaType':1,'trackIndex':video_track}]
        if audio:infos.append({'mediaPoolItem':media,'startFrame':a,'endFrame':b-1,
                              'recordFrame':record,'mediaType':2,'trackIndex':audio_track})
        items=sequence(self.pool.AppendToTimeline(infos))
        if len(items)!=len(infos):raise ResolveUnavailable('Incomplete video/audio insertion')
        for item in items:
            if int(item.GetStart())!=record or int(item.GetEnd())!=record+b-a:
                raise ResolveUnavailable('Inserted clip boundaries differ from exact frame plan')
        return items[0]

    def direct(self,clip):
        require(clip.PerformMulticamSmartSwitch({'minEditDuration':4.0,'editChangeDelay':0.3,
                    'isAutoDetectWideAngle':True,'isUseWideAngleForSilence':True}),
                'Native SmartSwitch failed; timeline retained for diagnosis')

    def audio(self,timeline):
        amount=int(self.m['audio'].get('voice_isolation_amount',35))
        state={'isEnabled':True,'amount':amount}
        require(timeline.SetVoiceIsolationState(1,state),'Cannot enable Voice Isolation on dialogue')
        actual=timeline.GetVoiceIsolationState(1)
        if not actual or actual.get('isEnabled') is not True or actual.get('amount')!=amount:
            raise ResolveUnavailable('Voice Isolation readback differs from requested state')
        self.state['review'].append({'timeline':timeline.GetName(),'category':'audio',
            'message':'Voice Isolation applied. Speaker balancing, compressor/limiter and rendered LUFS are not verified.'})

    def mark(self,timeline,frame,identity,message,color='Yellow'):
        require(timeline.AddMarker(frame,color,identity,message,1,identity),'Cannot save review marker')

    def finish(self,timeline,length):
        start=int(timeline.GetStartFrame())
        for kind in ['video','audio']:
            clips=sorted(sequence(timeline.GetItemListInTrack(kind,1)),key=lambda x:x.GetStart())
            cursor=start
            for clip in clips:
                if int(clip.GetStart())!=cursor:raise ResolveUnavailable('Gap/overlap on '+kind+' track')
                cursor=int(clip.GetEnd())
            if cursor!=start+length:raise ResolveUnavailable('Output duration does not match plan')
        self.mark(timeline,0,'SPM_DONE:'+fingerprint(self.m),'Assembly verified; see execution report','Green')
        self.state['timelines'][timeline.GetName()]={'assembly':'VERIFIED','duration_frames':length}
        self.checkpoint()

    def master(self):
        name='SPM_'+self.m['episode']['id']+'_MASTER_EDIT'
        timeline,complete=self.create(name,1920,1080)
        if complete:return timeline
        start=int(timeline.GetStartFrame());offset=int(self.item.GetLeftOffset())
        for chunk in self.plan['master_map']:
            a,b=chunk['output_frames'];frames=chunk['source_frames']
            if frames:
                clip=self.append(timeline,self.media,offset+frames[0],offset+frames[1],start+a)
                self.direct(clip)
            else:
                self.append(timeline,self.assets[chunk['id']],0,b-a,start+a,
                            video_track=2 if chunk['kind']=='sponsor' else 1,
                            audio_track=2 if chunk['kind']=='sponsor' else 1)
                # Main continuity across ads is checked against all program tracks below.
        for sponsor in self.m['sponsors']:
            if sponsor['mode']=='INTERRUPTION':continue
            anchor=source_to_output(self.plan,sponsor['source_frame'])
            n=sponsor['duration_frames']
            if anchor+n>self.plan['master_duration_frames']:raise ResolveUnavailable('Sponsor extends beyond master')
            self.append(timeline,self.assets[sponsor['id']],0,n,start+anchor,video_track=2,audio=False)
        for note in self.m['editor_notes']:
            frame=source_to_output(self.plan,note['source_frame'])
            self.mark(timeline,frame,note['id'],note['text'])
        self.audio(timeline)
        # Sponsors occupy program gaps on their dedicated tracks, so use the plan
        # as the timing proof rather than requiring V1 to cover ad interruptions.
        if any(x['kind']=='sponsor' for x in self.plan['master_map']):
            self.mark(timeline,0,'SPM_DONE:'+fingerprint(self.m),'Exact insertion frames verified','Green')
            self.state['timelines'][name]={'assembly':'VERIFIED','duration_frames':self.plan['master_duration_frames']}
            self.checkpoint()
        else:self.finish(timeline,self.plan['master_duration_frames'])
        return timeline

    def reels(self):
        for index,reel in enumerate(self.m['reels'],1):
            name=f"SPM_{self.m['episode']['id']}_REEL_{index:02d}"
            timeline,complete=self.create(name,1080,1920)
            if complete:continue
            spec=self.reel_plans[reel['id']]
            ranges=spec['pause']['ranges'];cursor=int(timeline.GetStartFrame())
            offset=int(self.item.GetLeftOffset())
            for a,b in ranges:
                clip=self.append(timeline,self.media,offset+a,offset+b,cursor)
                self.direct(clip)
                require(clip.SmartReframe(),'Native vertical SmartReframe failed')
                cursor+=b-a
            length=cursor-int(timeline.GetStartFrame())
            caption=self.asset(reel['id']+'_CAPTIONS',spec['caption_path'])
            self.append(timeline,caption,0,length,int(timeline.GetStartFrame()),video_track=4,audio=False)
            self.audio(timeline)
            self.state['review'].append({'timeline':name,'category':'captions',
                'message':'Styled caption overlay inserted; editable ASS/SRT provided, not native Text+ captions.'})
            save_json(self.output/(reel['id']+'_silence_log.json'),spec['pause'])
            self.finish(timeline,length)

    def metadata(self):
        metadata=dict(self.m['youtube']);chapters=[]
        fps=Fraction(self.m['source']['frame_rate'])
        for c in metadata.get('chapters',[]):
            frame=source_to_output(self.plan,c['source_frame'])
            seconds=int(frame/fps)
            chapters.append({'title':c['title'],'output_frame':frame,
                             'time':f'{seconds//3600:02d}:{seconds//60%60:02d}:{seconds%60:02d}'})
        metadata['chapters']=chapters
        save_json(self.output/'youtube.json',metadata)
        (self.output/'youtube.txt').write_text(metadata.get('title','')+'\n\n'+metadata.get('description','')+
            '\n\n'+'\n'.join(c['time']+' '+c['title'] for c in chapters))

    def run(self):
        try:
            self.preflight();self.master();self.reels();self.metadata()
            self.state['status']='ASSEMBLED_REVIEW_REQUIRED'
            self.state['native_integration_verified']=True
            self.state['complete_product']=False
            self.state['remaining']=['Exact camera-angle adapter','Speaker mixing and loudness verification',
                                      'Native editable subtitle styling','Export queue preparation']
            self.checkpoint()
            return self.state
        except Exception as exc:
            self.state['status']='FAILED';self.state['error']=str(exc)
            save_json(self.state_path,self.state)
            raise
        finally:
            if self.original:self.project.SetCurrentTimeline(self.original)

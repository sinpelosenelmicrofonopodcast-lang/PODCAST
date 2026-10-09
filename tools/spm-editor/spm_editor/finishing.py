"""Editable Fusion captions, native level processing, render queue and rendered QC."""
import json
import math
import subprocess
import time
from fractions import Fraction
from pathlib import Path
from .core import fingerprint, save_json
from .media import ffmpeg

def lua_string(text):
    return '"'+text.replace('\\','\\\\').replace('"','\\"').replace('\n','\\n').replace('\r','\\r')+'"'

def fusion_comp(text,style,width,height,duration):
    """A real editable Text+ composition, attached to a duration-correct carrier."""
    size=float(style.get('font_size',76))/height
    bottom=float(style.get('margin_bottom',320))/height
    font=lua_string(style.get('font','Arial'))
    return '''{
 Tools = ordered() {
  SPMCaption = TextPlus {
   Inputs = {
    GlobalIn = Input { Value = 0 },
    GlobalOut = Input { Value = %d },
    Width = Input { Value = %d }, Height = Input { Value = %d },
    UseFrameFormatSettings = Input { Value = 1 },
    StyledText = Input { Value = %s },
    Font = Input { Value = %s }, Style = Input { Value = "Bold" },
    Size = Input { Value = %.9f },
    Center = Input { Value = { 0.5, %.9f } },
    Red1 = Input { Value = 1 }, Green1 = Input { Value = 1 }, Blue1 = Input { Value = 1 },
    Enabled2 = Input { Value = 1 }, Appearance2 = Input { Value = 1 },
    Red2 = Input { Value = 0 }, Green2 = Input { Value = 0 }, Blue2 = Input { Value = 0 },
    Thickness2 = Input { Value = 0.04 }
   }
  },
  MediaOut1 = MediaOut {
   Inputs = { Index = Input { Value = "0" }, Input = Input { SourceOp = "SPMCaption", Source = "Output" } }
  }
 }
}
''' % (duration-1,width,height,lua_string(text),font,size,bottom)

def carrier(folder,fps,length):
    folder=Path(folder);folder.mkdir(parents=True,exist_ok=True)
    output=folder/f'blank_{str(fps).replace("/","_")}_{length}.mov'
    if not output.is_file():
        ffmpeg('-v','error','-y','-f','lavfi','-i',
               f'color=c=black@0.0:s=1080x1920:r={fps},format=rgba','-frames:v',length,
               '-c:v','qtrle','-pix_fmt','argb',output)
    return output

def native_captions(engine,timeline,reel,cues):
    if not cues:raise RuntimeError('Reel has no spoken captions')
    style=engine.m['subtitle_presets'][reel['subtitle_preset']]
    longest=max(c['frames'][1]-c['frames'][0] for c in cues)
    path=carrier(engine.output/'captions',engine.m['source']['frame_rate'],longest)
    media=engine.asset('CAPTION_CARRIER_'+str(longest),path)
    track=int(timeline.GetTrackCount('video'))+1
    if not timeline.AddTrack('video'):raise RuntimeError('Cannot create editable caption track')
    if not timeline.SetTrackName('video',track,'EDITABLE TEXT+ CAPTIONS'):raise RuntimeError('Cannot name caption track')
    # Imported captions have one independent editable native Text+ item per cue.
    for i,cue in enumerate(cues):
        a,b=cue['frames']
        clip=engine.append(timeline,media,0,b-a,int(timeline.GetStartFrame())+a,video_track=track,audio=False)
        comp_path=engine.output/'captions'/f'{reel["id"]}_{i:04d}.comp'
        comp_path.write_text(fusion_comp(cue['text'],style,1080,1920,b-a))
        composition=clip.ImportFusionComp(str(comp_path))
        if not composition:raise RuntimeError('Resolve rejected caption Fusion composition')
        tool=composition.FindTool('SPMCaption')
        if not tool or str(tool.GetInput('StyledText',0))!=cue['text']:
            raise RuntimeError('Native caption text readback failed')
    return track

def finish_native_audio(engine,timeline):
    if not engine.project.SetCurrentTimeline(timeline):raise RuntimeError('Cannot activate audio timeline')
    clips=[]
    for track in range(1,int(timeline.GetTrackCount('audio'))+1):
        clips.extend(list((timeline.GetItemListInTrack('audio',track) or [])))
    if not clips:raise RuntimeError('No audio clips to process')
    for clip in timeline.GetItemListInTrack('audio',1) or []:
        properties={'AudioDialogueLevelerEnabled':True,'AudioDialogueLevelerReduceLoudDialogue':True,
                    'AudioDialogueLevelerLiftSoftDialogue':True,'AudioDialogueLevelerBackgroundReduction':False}
        for key,value in properties.items():
            if not clip.SetProperty(key,value):raise RuntimeError('Native audio processor rejected '+key)
        actual=clip.GetProperty()
        if any(actual.get(k)!=v for k,v in properties.items()):
            raise RuntimeError('Native dialogue processing readback differs')
    modes=timeline.GetNormalizeAudioModes() or []
    selected=next((mode for mode in modes if 'loudness' in mode.lower() or 'ebu' in mode.lower()),None)
    if not selected:raise RuntimeError('No native loudness normalization mode available')
    options={'normalizationMode':selected,'targetLoudness':float(engine.m['audio'].get('target_lufs',-16)),
             'targetLevel':float(engine.m['audio'].get('true_peak_db',-1))}
    if not timeline.NormalizeAudioLevel(clips,options):raise RuntimeError('Native loudness normalization failed')
    return {'voice_isolation':'APPLIED','dialogue_leveler':'APPLIED','normalization_options':options,
            'rendered_lufs':'NOT_MEASURED_YET'}

def measure_render(path,target=-16,peak=-1):
    # EBU loudness and true peak are measured from actual audio, not inferred from settings.
    result=ffmpeg('-v','info','-i',path,'-vn','-af',
                  f'loudnorm=I={target}:TP={peak}:LRA=11:print_format=json','-f','null','-')
    a=result.stderr.rfind('{');b=result.stderr.rfind('}')
    if a<0 or b<a:raise RuntimeError('No rendered loudness measurement')
    data=json.loads(result.stderr[a:b+1])
    integrated=float(data['input_i']);true_peak=float(data['input_tp'])
    if not math.isfinite(integrated) or not math.isfinite(true_peak):
        raise RuntimeError('Rendered audio is silent or cannot be measured')
    return {'integrated_lufs':integrated,'true_peak_db':true_peak,
            'target_lufs':target,'ceiling_db':peak,'passed':abs(integrated-target)<=1 and true_peak<=peak+0.1}

def queue_exports(engine):
    jobs=[]
    existing=engine.project.GetRenderJobList() or []
    for name,proof in engine.state['timelines'].items():
        timeline=engine.find(name)
        if not engine.project.SetCurrentTimeline(timeline):raise RuntimeError('Cannot activate export timeline')
        existing_job=next((j for j in existing if j.get('TimelineName')==name and
                          j.get('OutputFilename','').startswith(name)),None)
        if existing_job:
            jobs.append({'timeline':name,'job_id':existing_job.get('JobId'),'reused':True});continue
        codecs=engine.project.GetRenderCodecs('mp4') or {}
        codec=next((v for k,v in codecs.items() if '264' in str(k)+' '+str(v)),None)
        if not codec or not engine.project.SetCurrentRenderFormatAndCodec('mp4',codec):
            raise RuntimeError('MP4/H.264 export is unavailable')
        if not engine.project.SetCurrentRenderMode(1):raise RuntimeError('Cannot set single-file render mode')
        vertical='_REEL_' in name
        target=engine.output/'EXPORTS';target.mkdir(exist_ok=True)
        settings={'TargetDir':str(target),'CustomName':name,'SelectAllFrames':False,
                  'MarkIn':int(timeline.GetStartFrame()),
                  'MarkOut':int(timeline.GetStartFrame())+proof['duration_frames']-1,
                  'ExportVideo':True,'ExportAudio':True,
                  'FormatWidth':1080 if vertical else 1920,'FormatHeight':1920 if vertical else 1080}
        if not engine.project.SetRenderSettings(settings):raise RuntimeError('Cannot configure export '+name)
        job=engine.project.AddRenderJob()
        if not job:raise RuntimeError('Cannot enqueue export '+name)
        jobs.append({'timeline':name,'job_id':job,'reused':False})
    save_json(engine.output/'render_queue.json',jobs)
    return jobs

def source_audio(engine):
    """Render only the selected source's analysis audio, preserving all source timing."""
    configured=engine.m['source'].get('analysis_audio_path')
    if configured and Path(configured).is_file():return str(Path(configured).resolve())
    target=engine.output/'cache';target.mkdir(exist_ok=True)
    name='source_'+fingerprint(engine.m)[:16];output=target/(name+'.wav')
    if output.is_file():return str(output)
    if engine.project.IsRenderingInProgress():raise RuntimeError('Resolve is already rendering; source analysis deferred')
    if not engine.project.SetCurrentTimeline(engine.source):raise RuntimeError('Cannot activate source for analysis')
    codecs=engine.project.GetAudioRenderCodecs('wav') or {}
    codec=next((v for k,v in codecs.items() if 'pcm' in (str(k)+' '+str(v)).lower()),None)
    if not codec or not engine.project.SetCurrentRenderFormatAndCodec('wav',codec):
        raise RuntimeError('Native WAV analysis export unavailable')
    settings={'TargetDir':str(target),'CustomName':name,'SelectAllFrames':False,
              'MarkIn':int(engine.source.GetStartFrame()),
              'MarkOut':int(engine.source.GetStartFrame())+engine.m['source']['duration_frames']-1,
              'ExportVideo':False,'ExportAudio':True}
    if not engine.project.SetRenderSettings(settings):raise RuntimeError('Cannot set analysis render settings')
    job=engine.project.AddRenderJob()
    if not job or not engine.project.StartRendering([job]):raise RuntimeError('Cannot render analysis audio')
    deadline=time.monotonic()+3600
    while engine.project.IsRenderingInProgress():
        if time.monotonic()>deadline:raise RuntimeError('Source analysis audio render timeout; job retained')
        time.sleep(0.5)
    state=engine.project.GetRenderJobStatus(job) or {}
    if state.get('JobStatus')!='Complete' or not output.is_file():
        raise RuntimeError('Source analysis render failed: '+str(state))
    if not engine.project.DeleteRenderJob(job):raise RuntimeError('Cannot remove completed analysis job')
    return str(output)

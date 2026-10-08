"""Local analysis and caption assets. Never edits a master timeline."""
import hashlib
import json
import math
import re
import shutil
import subprocess
from fractions import Fraction
from pathlib import Path
from .core import InvalidManifest, interval, caption_interval

def ffmpeg(*args):
    executable=shutil.which('ffmpeg')
    if not executable:
        raise RuntimeError('FFmpeg is required for local media analysis')
    result=subprocess.run([executable,'-nostdin','-hide_banner',*map(str,args)],
                          capture_output=True,text=True,check=False)
    if result.returncode:
        raise RuntimeError('FFmpeg failed: '+result.stderr[-2500:])
    return result

def protected_reel_ranges(manifest, reel, cache):
    """Cut only waveform gaps corroborated by verified word boundaries.

    Timing is source-timeline-relative in frames. Strong editorial pauses must
    be supplied as protected intervals; no semantic guesses are made here.
    """
    if reel.get('automatic_silence_removal') is not True:
        raise InvalidManifest('Silence engine requires an independent reel')
    if reel.get('id') not in {r['id'] for r in manifest['reels']}:
        raise InvalidManifest('Silence engine cannot target the master')
    fps=Fraction(manifest['source']['frame_rate'])
    path=Path(manifest['source'].get('analysis_audio_path',''))
    if not path.is_file():
        raise RuntimeError('Reel analysis requires source.analysis_audio_path matching source timeline time zero')
    words=manifest['transcript'].get('words',[])
    if not words or manifest['transcript'].get('word_timing_verified') is not True:
        raise RuntimeError('Safe reel pause edits require verified transcript word frames')
    duration=manifest['source']['duration_frames']
    protected=[interval(x,duration) for x in reel.get('protected_pause_frames',[])]
    rules=reel.get('silence_rules',{})
    minimum=float(rules.get('minimum_seconds',0.7))
    threshold=float(rules.get('noise_db',-40))
    pad=max(1,math.ceil(float(rules.get('speech_padding_seconds',0.08))*fps))
    residual=max(0,round(float(rules.get('residual_seconds',0.2))*fps))
    if minimum<0.35 or not -90<=threshold<=-15:
        raise InvalidManifest('Unsafe reel silence thresholds')
    stat=path.stat()
    signature={'path':str(path.resolve()),'size':stat.st_size,'mtime':stat.st_mtime_ns,
               'reel':reel,'words':words,'fps':str(fps)}
    key=hashlib.sha256(json.dumps(signature,sort_keys=True).encode()).hexdigest()
    saved=Path(cache)/('silence-'+key+'.json')
    if saved.is_file():return json.loads(saved.read_text())
    ranges=[]
    removals=[]
    for segment in reel['segments']:
        a,b=interval(segment['source_frames'],duration)
        output=ffmpeg('-v','info','-ss',float(a/fps),'-i',path,'-t',float((b-a)/fps),
                      '-map','0:a:0','-vn','-af',f'silencedetect=noise={threshold}dB:d={minimum}',
                      '-f','null','-').stderr
        pending=None
        cuts=[]
        for line in output.splitlines():
            start=re.search(r'silence_start:\s*([\d.\-]+)',line)
            end=re.search(r'silence_end:\s*([\d.\-]+)',line)
            if start:pending=max(a,a+math.ceil(float(start[1])*fps))
            if end and pending is not None:
                finish=min(b,a+math.floor(float(end[1])*fps))
                cuts.append((pending,finish));pending=None
        # Trailing silence is retained: no following verified word exists.
        safe=[]
        for x,y in cuts:
            before=[w for w in words if w['source_frames'][1]<=x and w['source_frames'][0]>=a]
            after=[w for w in words if w['source_frames'][0]>=y and w['source_frames'][1]<=b]
            if not before or not after:continue
            left=max(w['source_frames'][1] for w in before)+pad
            right=min(w['source_frames'][0] for w in after)-pad
            x=max(x,left)+residual//2
            y=min(y,right)-(residual-residual//2)
            if y<=x:continue
            if any(w['source_frames'][0]<y and w['source_frames'][1]>x for w in words):continue
            if any(u<y and v>x for u,v in protected):continue
            safe.append((x,y))
        cursor=a
        for x,y in sorted(safe):
            if x<cursor:continue
            if x>cursor:ranges.append([cursor,x])
            removals.append([x,y]);cursor=y
        if cursor<b:ranges.append([cursor,b])
    result={'ranges':ranges,'removed_source_frames':removals,
            'method':'waveform_plus_verified_words','semantic_pause_status':'JSON_PROTECTED_INTERVALS_ONLY'}
    from .core import save_json
    save_json(saved,result)
    return result

def mapped_captions(manifest, ranges):
    words=manifest['transcript'].get('words',[])
    if not words or manifest['transcript'].get('word_timing_verified') is not True:
        raise RuntimeError('Final captions require verified word-level timestamps')
    mapped=[];cursor=0
    for a,b in ranges:
        for word in words:
            x,y=word['source_frames']
            if x>=a and y<=b:
                mapped.append({'text':word['text'],'frames':[cursor+x-a,cursor+y-a]})
            elif x<b and y>a:
                raise RuntimeError('Reel edit bisects a transcript word; adjust source selection')
        cursor+=b-a
    cues=[];previous=0
    # Short groups improve readability while not bridging real speech gaps.
    group=[]
    def flush():
        nonlocal previous,group
        if not group:return
        a,b=caption_interval(group[0]['frames'][0],group[-1]['frames'][1],previous)
        cues.append({'text':' '.join(w['text'] for w in group),'frames':[a,b],'words':group})
        previous=b;group=[]
    for w in mapped:
        if group and (len(group)>=5 or w['frames'][0]-group[-1]['frames'][1]>2):flush()
        group.append(w)
    flush()
    return cues,cursor

def ass_time(frames,fps):
    centis=round(float(Fraction(frames,1)/fps)*100)
    return f'{centis//360000}:{centis//6000%60:02d}:{centis//100%60:02d}.{centis%100:02d}'

def caption_assets(manifest,reel,ranges,folder):
    fps=Fraction(manifest['source']['frame_rate'])
    cues,duration=mapped_captions(manifest,ranges)
    style=manifest['subtitle_presets'][reel['subtitle_preset']]
    font=style.get('font','Arial')
    if any(x in font for x in ',\n\r'):raise InvalidManifest('Invalid subtitle font')
    size=int(style.get('font_size',76));margin=int(style.get('margin_bottom',320))
    if not 16<=size<=160 or not 100<=margin<=800:raise InvalidManifest('Unsafe caption layout')
    folder=Path(folder);folder.mkdir(parents=True,exist_ok=True)
    ass=folder/(reel['id']+'.ass');mov=folder/(reel['id']+'_CAPTIONS.mov')
    def text(value):
        return value.replace('\\','\\\\').replace('{','\\{').replace('}','\\}').replace('\n','\\N')
    header=f'''[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font},{size},&H00FFFFFF,&H000080FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,4,2,2,90,90,{margin},1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
    for cue in cues:
        payload=text(cue['text'])
        if reel['subtitle_preset']=='SPM_KARAOKE':
            payload=' '.join('{\\k'+str(max(1,round(float((w['frames'][1]-w['frames'][0])/fps)*100)))+'}'+text(w['text']) for w in cue['words'])
        header+=f"Dialogue: 0,{ass_time(cue['frames'][0],fps)},{ass_time(cue['frames'][1],fps)},Default,,0,0,0,,{payload}\n"
    ass.write_text(header)
    # FFmpeg runs in the asset directory: user paths never become filter syntax.
    executable=shutil.which('ffmpeg')
    if not executable:raise RuntimeError('FFmpeg missing')
    command=[executable,'-nostdin','-hide_banner','-y','-f','lavfi','-i',
        f'color=c=black@0.0:s=1080x1920:r={fps}:d={float(duration/fps)},format=rgba',
        '-vf',f"format=rgba,subtitles=filename='{ass.name}':alpha=1",'-frames:v',str(duration),
        '-c:v','qtrle','-pix_fmt','argb',mov.name]
    subprocess.run(command,cwd=folder,check=True,capture_output=True)
    from .core import save_json
    save_json(folder/(reel['id']+'_caption_map.json'),cues)
    def srt_time(f):
        ms=round(float(f/fps)*1000)
        return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
    srt=folder/(reel['id']+'.srt')
    srt.write_text('\n\n'.join(f"{i}\n{srt_time(c['frames'][0])} --> {srt_time(c['frames'][1])}\n{c['text']}" for i,c in enumerate(cues,1))+'\n')
    return mov,cues

"""Local word timing with optional faster-whisper; refuses invented word times."""
import difflib
import hashlib
import json
import re
import unicodedata
from fractions import Fraction
from pathlib import Path
from .core import save_json

def token(text):
    return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',text.lower()))

def align_words(reference,observed,fps,aliases=None):
    aliases=aliases or {}
    normalized=[aliases.get(token(w['text']),token(w['text'])) for w in observed]
    expected=[token(w) for w in reference]
    result={}
    matcher=difflib.SequenceMatcher(a=expected,b=normalized,autojunk=False)
    for block in matcher.get_matching_blocks():
        for i in range(block.size):
            raw=observed[block.b+i]
            start=max(0,int(round(float(raw['start'])*fps)))
            end=max(start+1,int(round(float(raw['end'])*fps)))
            result[block.a+i]={'text':reference[block.a+i],'source_frames':[start,end]}
    missing=[reference[i] for i in range(len(reference)) if i not in result]
    if missing:raise RuntimeError('Word alignment needs review; unmatched transcript words: '+' '.join(missing[:20]))
    return [result[i] for i in range(len(reference))]

def ensure_words(manifest,audio_path,cache):
    transcript=manifest['transcript']
    if transcript.get('word_timing_verified') is True and transcript.get('words'):return
    text=transcript.get('text') or ' '.join(s['text'] for s in transcript.get('segments',[]))
    if not text.strip():raise RuntimeError('A real episode transcript is required')
    file=Path(audio_path);stat=file.stat()
    signature={'text':text,'path':str(file.resolve()),'size':stat.st_size,'mtime':stat.st_mtime_ns,
               'fps':manifest['source']['frame_rate'],'model':transcript.get('alignment_model','tiny')}
    key=hashlib.sha256(json.dumps(signature,sort_keys=True).encode()).hexdigest()
    saved=Path(cache)/('words_'+key+'.json')
    if saved.is_file():words=json.loads(saved.read_text())
    else:
        try:from faster_whisper import WhisperModel
        except ImportError as exc:raise RuntimeError('Install the local alignment dependency faster-whisper') from exc
        model=WhisperModel(signature['model'],device='cpu',compute_type='int8',
                          download_root=str(Path(cache)/'models'))
        segments,_=model.transcribe(str(file),language='es',word_timestamps=True,vad_filter=True)
        observed=[{'text':w.word.strip(),'start':w.start,'end':w.end} for s in segments for w in s.words or []]
        words=align_words(text.split(),observed,Fraction(manifest['source']['frame_rate']),
                          transcript.get('alignment_aliases'))
        save_json(saved,words)
    transcript['words']=words;transcript['word_timing_verified']=True

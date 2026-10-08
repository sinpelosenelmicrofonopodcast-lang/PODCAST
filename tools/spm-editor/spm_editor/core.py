import hashlib
import json
import re
from fractions import Fraction
from pathlib import Path

class InvalidManifest(ValueError):
    pass

def interval(value, duration):
    a, b = value
    if type(a) is not int or type(b) is not int or not 0 <= a < b <= duration:
        raise InvalidManifest(f'Invalid half-open source frame interval: {value}')
    return a, b

def validate(m):
    required = ['schema_version','episode','source','transcript','speakers','cameras',
                'opening','master_edit','sponsors','editor_notes','audio','reels',
                'subtitle_presets','youtube','quality_control','exports']
    missing = [x for x in required if x not in m]
    if missing:
        raise InvalidManifest('Missing: ' + ', '.join(missing))
    if m['schema_version'] != '3.0':
        raise InvalidManifest('Unsupported schema_version')
    if m['master_edit'].get('automatic_silence_removal') is not False:
        raise InvalidManifest('Master automatic_silence_removal must be false')
    if m['master_edit'].get('automatic_filler_removal', False) is not False:
        raise InvalidManifest('Master filler removal is prohibited')
    s = m['source']
    fps = Fraction(s['frame_rate'])
    if fps <= 0 or fps > 120:
        raise InvalidManifest('Invalid rational frame rate')
    duration = s['duration_frames']
    if type(duration) is not int or duration <= 0:
        raise InvalidManifest('Invalid source duration')
    if not s.get('timeline_name') or s.get('synchronized') is not True:
        raise InvalidManifest('Named, already synchronized source required')
    ids = set()
    if not re.fullmatch(r'[A-Za-z0-9_-]+',m['episode']['id']):
        raise InvalidManifest('Episode ID must contain only letters, digits, underscores or hyphens')
    for kind in ['cameras','speakers','sponsors','editor_notes','reels']:
        for obj in m[kind]:
            identity = obj.get('id')
            if not isinstance(identity,str) or not re.fullmatch(r'[A-Za-z0-9_-]+',identity) or identity in ids:
                raise InvalidManifest('Missing or duplicate stable ID: ' + str(identity))
            ids.add(identity)
    for word in m['transcript'].get('words',[]):
        interval(word['source_frames'],duration)
        if not isinstance(word.get('text'),str) or not word['text'].strip():
            raise InvalidManifest('Transcript word has no text')
    camera_ids = {c['id'] for c in m['cameras']}
    for c in m['master_edit'].get('camera_decisions', []):
        interval(c['source_frames'], duration)
        if c['camera_id'] not in camera_ids:
            raise InvalidManifest('Unknown camera ID')
    for x in m['master_edit'].get('exclusions', []):
        interval(x['source_frames'], duration)
        if x.get('approved') is not True or not x.get('reason'):
            raise InvalidManifest('Every exclusion requires approval and a reason')
    for r in m['reels']:
        if r.get('automatic_silence_removal') is not True:
            raise InvalidManifest('Reel automatic_silence_removal must be true')
        if not r.get('segments'):
            raise InvalidManifest('Empty reel')
        for segment in r['segments']:
            interval(segment['source_frames'], duration)
        if r.get('subtitle_preset') not in m['subtitle_presets']:
            raise InvalidManifest('Unknown subtitle preset')
    if m['opening'].get('hook'):
        interval(m['opening']['hook']['source_frames'], duration)
    return m

def fingerprint(m):
    return hashlib.sha256(json.dumps(m, sort_keys=True, separators=(',',':')).encode()).hexdigest()

def preserved_ranges(duration, exclusions):
    ordered = sorted(interval(x['source_frames'], duration) for x in exclusions)
    cursor = 0
    result = []
    for a, b in ordered:
        if a < cursor:
            raise InvalidManifest('Overlapping approved exclusions')
        if a > cursor:
            result.append((cursor, a))
        cursor = b
    if cursor < duration:
        result.append((cursor, duration))
    return result

def compile_plan(m):
    validate(m)
    mapping = []
    cursor = 0
    def append(kind, frames=None, length=None, identity=None):
        nonlocal cursor
        n = frames[1] - frames[0] if frames else length
        if type(n) is not int or n <= 0:
            raise InvalidManifest('Asset duration_frames must be a positive integer')
        mapping.append({'kind':kind,'id':identity,'source_frames':list(frames) if frames else None,
                        'output_frames':[cursor, cursor+n]})
        cursor += n
    hook = m['opening'].get('hook')
    if hook:
        append('hook', interval(hook['source_frames'], m['source']['duration_frames']))
    intro = m['opening'].get('intro')
    if intro:
        append('intro', length=intro['duration_frames'], identity=intro.get('asset_id'))
    # Insertions use source coordinates, so cold-open duplication cannot move their anchors.
    insertions = sorted((x for x in m['sponsors'] if x['mode'] == 'INTERRUPTION'),
                        key=lambda x: x['source_frame'])
    for a,b in preserved_ranges(m['source']['duration_frames'], m['master_edit'].get('exclusions', [])):
        pos=a
        for sponsor in insertions:
            anchor=sponsor['source_frame']
            if a <= anchor < b:
                if anchor > pos:
                    append('main', (pos,anchor))
                append('sponsor', length=sponsor['duration_frames'], identity=sponsor['id'])
                pos=anchor
        if pos < b:
            append('main', (pos,b))
    return {'manifest_hash':fingerprint(m), 'frame_rate':m['source']['frame_rate'],
            'master_map':mapping, 'master_duration_frames':cursor,
            'master_pause_policy':'PRESERVE', 'reel_count':len(m['reels']),
            'integration_status':'NOT_EXECUTED'}

def source_to_output(plan, frame, occurrence='main'):
    hits=[]
    for x in plan['master_map']:
        src=x['source_frames']
        if x['kind']==occurrence and src and src[0] <= frame < src[1]:
            hits.append(x['output_frames'][0]+frame-src[0])
    if len(hits)!=1:
        raise InvalidManifest(f'Source frame {frame} has {len(hits)} {occurrence} mappings')
    return hits[0]

def caption_interval(start, end, previous_end=0):
    if type(start) is not int or type(end) is not int or start < 0 or end <= start:
        raise InvalidManifest('Invalid speech interval')
    a,b=start+1,end-1
    if b<=a: # Preserve short spoken words rather than produce a negative caption.
        a,b=start,end
    a=max(a,previous_end)
    if b<=a:
        raise InvalidManifest('No nonoverlapping caption interval available')
    return a,b

def save_json(path, value):
    path=Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp=path.with_suffix(path.suffix+'.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')
    tmp.replace(path)

"""Full orchestration against an explicit native API simulator plus real media."""
import copy
import json
import math
import shutil
import struct
import tempfile
import unittest
import wave
from pathlib import Path
from spm_editor.engine import Engine
from test_engine import Resolve, Timeline, Clip

@unittest.skipUnless(shutil.which('ffmpeg'),'FFmpeg required')
class SimulatedResolveFullPipeline(unittest.TestCase):
    def test_full_episode_six_reels_native_captions_and_queue(self):
        with tempfile.TemporaryDirectory() as folder:
            folder=Path(folder)
            m=json.loads((Path(__file__).parents[1]/'example.contract-test.json').read_text())
            audio=folder/'actual_source.wav'
            with wave.open(str(audio),'wb') as wav:
                wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(16000)
                data=[int(12000*math.sin(i*2*math.pi*440/16000)) if i<16000 or i>=48000 else 0 for i in range(64000)]
                wav.writeframes(struct.pack('<'+'h'*len(data),*data))
            m['source'].update({'duration_frames':96,'multicam_verified':True,'analysis_audio_path':str(audio)})
            m['opening']={'hook':{'source_frames':[72,96]},'intro':{'source_frames':[0,24]}}
            m['transcript']={'word_timing_verified':True,'words':[{'text':'Hola','source_frames':[0,24]},
                {'text':'Bito','source_frames':[72,96]}]}
            m['subtitle_presets']['SPM_BOLD']['font']='DejaVu Sans'
            m['reels']=[{'id':f'R{i}','segments':[{'source_frames':[0,96]}],
                'automatic_silence_removal':True,'subtitle_preset':'SPM_BOLD'} for i in range(6)]
            r=Resolve();source=Timeline('SPM_SOURCE')
            source.tracks['video'][0]=[Clip(86400,86496)]
            source.tracks['audio'][0]=[Clip(86400,86496)]
            r.manager.project.timelines=[source];r.manager.project.current=source
            original=copy.deepcopy(source.tracks['video'][0][0].__dict__)
            result=Engine(m,folder/'output',resolve=r,
                docs='PerformMulticamSmartSwitch SetVoiceIsolationState').run()
            self.assertEqual(result['status'],'REVIEW_READY')
            self.assertEqual(len(result['timelines']),7)
            self.assertEqual(len(result['render_jobs']),7)
            self.assertEqual(result['timelines']['SPM_DEMO_MASTER_EDIT']['duration_frames'],144)
            self.assertEqual(source.tracks['video'][0][0].__dict__,original)
            self.assertIs(r.manager.project.current,source)
            for t in r.manager.project.timelines:
                if '_REEL_' in t.GetName():
                    self.assertLess(max(c.GetEnd() for c in t.tracks['video'][0])-86400,96)
                    self.assertTrue(t.tracks['video'][-1],'Native Text+ clips must exist')
            self.assertFalse(result['native_integration_verified'],'A simulator must not certify real Resolve')

if __name__=='__main__':unittest.main()

import copy
import json
import math
import shutil
import struct
import subprocess
import tempfile
import unittest
import wave
from pathlib import Path
from spm_editor.core import compile_plan, InvalidManifest
from spm_editor.media import protected_reel_ranges, mapped_captions, caption_assets

@unittest.skipUnless(shutil.which('ffmpeg'),'FFmpeg required')
class RealMediaTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.folder=Path(self.temp.name)
        self.m=json.loads((Path(__file__).parents[1]/'example.contract-test.json').read_text())
        self.m['source']['duration_frames']=96;self.m['opening']={}
        self.m['reels'][0]['segments']=[{'source_frames':[0,96]}]
        self.m['subtitle_presets']['SPM_BOLD']['font']='DejaVu Sans'
        self.m['transcript']={'word_timing_verified':True,'words':[
            {'text':'Hola','source_frames':[0,24]},
            {'text':'Bito','source_frames':[72,96]}]}
        self.wav=self.folder/'source.wav'
        with wave.open(str(self.wav),'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000)
            samples=[int(12000*math.sin(i*2*math.pi*440/16000)) if i<16000 or i>=48000 else 0 for i in range(64000)]
            w.writeframes(struct.pack('<'+'h'*len(samples),*samples))
        self.m['source']['analysis_audio_path']=str(self.wav)
    def tearDown(self):self.temp.cleanup()
    def test_real_waveform_cut_preserves_words_and_master(self):
        original=copy.deepcopy(compile_plan(self.m))
        result=protected_reel_ranges(self.m,self.m['reels'][0],self.folder/'cache')
        self.assertTrue(result['removed_source_frames'])
        self.assertEqual(compile_plan(self.m),original)
        for a,b in result['removed_source_frames']:
            self.assertGreaterEqual(a,24);self.assertLessEqual(b,72)
        self.assertEqual(protected_reel_ranges(self.m,self.m['reels'][0],self.folder/'cache'),result)
    def test_protected_emotional_pause_survives(self):
        self.m['reels'][0]['protected_pause_frames']=[[24,72]]
        result=protected_reel_ranges(self.m,self.m['reels'][0],self.folder/'cache')
        self.assertEqual(result['removed_source_frames'],[])
    def test_silence_engine_rejects_master_target(self):
        reel=copy.deepcopy(self.m['reels'][0]);reel['id']='MASTER'
        with self.assertRaises(InvalidManifest):protected_reel_ranges(self.m,reel,self.folder/'cache')
    def test_real_caption_render_alpha_and_final_frame_count(self):
        # A short, actual RGBA render checks libass and FFmpeg rather than mocking them.
        mov,cues=caption_assets(self.m,self.m['reels'][0],[[0,24],[72,96]],self.folder/'captions')
        self.assertEqual([c['text'] for c in cues],['Hola Bito'])
        probe=subprocess.run(['ffprobe','-v','error','-select_streams','v:0','-show_entries',
            'stream=nb_frames,pix_fmt,width,height','-of','json',str(mov)],check=True,capture_output=True,text=True)
        stream=json.loads(probe.stdout)['streams'][0]
        self.assertEqual(int(stream['nb_frames']),48)
        self.assertEqual((stream['width'],stream['height']),(1080,1920))
        self.assertEqual(stream['pix_fmt'],'argb')
        raw=subprocess.run(['ffmpeg','-v','error','-i',str(mov),'-frames:v','1','-f','rawvideo','-pix_fmt','rgba','-'],
                           capture_output=True,check=True).stdout
        self.assertEqual(raw[3],0,'Corner must remain transparent')

if __name__=='__main__':unittest.main()

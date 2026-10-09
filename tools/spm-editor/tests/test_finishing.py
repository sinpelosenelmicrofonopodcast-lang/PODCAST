import json
import shutil
import tempfile
import unittest
from fractions import Fraction
from pathlib import Path
from spm_editor.alignment import align_words
from spm_editor.finishing import fusion_comp, measure_render
from spm_editor.media import ffmpeg

class AlignmentTests(unittest.TestCase):
    def test_exact_words_are_aligned_without_rewriting_slang(self):
        result=align_words(['Vaina','real.'],[{'text':'vaina','start':0.0,'end':0.5},
            {'text':'real','start':0.5,'end':1.0}],Fraction(24))
        self.assertEqual(result,[{'text':'Vaina','source_frames':[0,12]},
                                 {'text':'real.','source_frames':[12,24]}])
    def test_unmatched_words_cannot_receive_invented_times(self):
        with self.assertRaises(RuntimeError):align_words(['Bito'],[{'text':'Otro','start':0,'end':1}],Fraction(24))
    def test_explicit_name_alias(self):
        result=align_words(['Bito'],[{'text':'Vito','start':0,'end':1}],Fraction(24),{'vito':'bito'})
        self.assertEqual(result[0]['text'],'Bito')
    def test_native_composition_escapes_dialogue(self):
        comp=fusion_comp('Él dijo: "vaina"\\n',{'font':'Arial'},1080,1920,24)
        self.assertIn('SPMCaption = TextPlus',comp)
        self.assertIn('\\"vaina\\"',comp)
        self.assertIn('GlobalOut = Input { Value = 23 }',comp)

@unittest.skipUnless(shutil.which('ffmpeg'),'FFmpeg required')
class RenderedLoudnessTests(unittest.TestCase):
    def test_actual_export_measurement(self):
        with tempfile.TemporaryDirectory() as directory:
            audio=Path(directory)/'tone.wav'
            ffmpeg('-v','error','-y','-f','lavfi','-i','sine=frequency=440:duration=4',
                   '-af','loudnorm=I=-16:TP=-1:LRA=11','-ar',48000,audio)
            result=measure_render(audio)
            self.assertTrue(result['passed'])
            self.assertAlmostEqual(result['integrated_lufs'],-16,delta=1)
    def test_silent_export_is_not_success(self):
        with tempfile.TemporaryDirectory() as directory:
            audio=Path(directory)/'silent.wav'
            ffmpeg('-v','error','-y','-f','lavfi','-i','anullsrc=r=48000:cl=mono','-t',1,audio)
            with self.assertRaises(RuntimeError):measure_render(audio)

if __name__=='__main__':unittest.main()

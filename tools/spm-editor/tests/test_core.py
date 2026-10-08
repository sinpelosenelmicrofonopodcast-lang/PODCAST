import copy
import json
import unittest
from pathlib import Path
from spm_editor.core import *

class ContractTests(unittest.TestCase):
    def setUp(self):
        self.m=json.loads((Path(__file__).parents[1]/'example.contract-test.json').read_text())
    def test_master_pause_preservation(self):
        p=compile_plan(self.m)
        main=[x for x in p['master_map'] if x['kind']=='main']
        self.assertEqual(main[0]['source_frames'],[0,2400])
        self.assertEqual(p['master_duration_frames'],2640)
    def test_master_silence_policy_cannot_flip(self):
        for value in [True,0,None,'false']:
            self.m['master_edit']['automatic_silence_removal']=value
            with self.assertRaises(InvalidManifest):validate(self.m)
    def test_reel_policy_cannot_inherit_master(self):
        self.m['reels'][0]['automatic_silence_removal']=False
        with self.assertRaises(InvalidManifest):validate(self.m)
    def test_duplicate_hook_mapping(self):
        p=compile_plan(self.m)
        self.assertEqual(source_to_output(p,300,'hook'),60)
        self.assertEqual(source_to_output(p,300),540)
    def test_excluded_frame_has_no_chapter_position(self):
        self.m['master_edit']['exclusions']=[{'source_frames':[100,200],'approved':True,'reason':'Technical interruption'}]
        p=compile_plan(self.m)
        with self.assertRaises(InvalidManifest):source_to_output(p,150)
        self.assertEqual(source_to_output(p,200),340)
    def test_sponsor_updates_main_map(self):
        self.m['sponsors']=[{'id':'AD01','mode':'INTERRUPTION','source_frame':100,'duration_frames':48}]
        p=compile_plan(self.m)
        self.assertEqual(source_to_output(p,100),388)
    def test_caption_edges(self):
        self.assertEqual(caption_interval(10,30),(11,29))
        self.assertEqual(caption_interval(10,11),(10,11))
        with self.assertRaises(InvalidManifest):caption_interval(10,20,21)
    def test_invalid_ranges(self):
        for frames in [[0,2401],[-1,10],[10,10],[True,10],[0,1.5]]:
            with self.assertRaises(InvalidManifest):interval(frames,2400)
    def test_overlapping_exclusions(self):
        with self.assertRaises(InvalidManifest):
            preserved_ranges(100,[{'source_frames':[10,30]},{'source_frames':[20,40]}])

if __name__=='__main__':unittest.main()

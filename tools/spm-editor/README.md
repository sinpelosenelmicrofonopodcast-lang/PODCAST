# SPM Podcast Editor — development build

This package contains the contract compiler, local media engine and native Resolve
execution adapter. It is **not the complete Autopilot application requested**.
`run` and `resume` now execute assembly after successful preflight. They return
code 2 while required production features remain incomplete, even if assembly
succeeds. They can modify new output timelines, never the original source.

Added: native master/reel assembly, AUTO SmartSwitch calls, native Voice Isolation
with readback, native vertical SmartReframe calls, dedicated sponsor tracks,
review markers, word-protected waveform pause cuts, real ASS/SRT plus transparent
styled caption-video generation, corrected chapter outputs and timeline
completion markers. Native calls are simulator-tested, not certified in Resolve.
Existing partial timelines are retained; recovery from an interrupted phase
is not yet automatic. Completed matching timelines can be reused.

Implemented: master/reel silence policy validation, rational frame-rate validation,
half-open source intervals, approved exclusion checks, stable entity IDs,
cold-open duplication-aware source maps, source-anchored interruption maps,
one-frame caption interval utility, atomic JSON reports, and installed Resolve
documentation inspection. The schema is an envelope schema; the runtime adds
semantic validation. It is not a complete schema for every planned feature.

## Commands

From this directory, using Python 3.10+:

```sh
python3 -m spm_editor validate example.contract-test.json
python3 -m spm_editor dry-run example.contract-test.json
python3 -m spm_editor inspect master.json
python3 -m unittest discover -s tests -v
```

`inspect` requires Resolve open on macOS with local external scripting enabled.
Documented capabilities are reported separately from tested capabilities.
`qc` checks the contract and map only, not actual audio/video.
The example is synthetic and does not describe a real episode or select real reels.
Default example FPS is 24/1; preserve an existing 24000/1001 project when verified.

## Existing implementation audit

The source package examined was SIN_PELOS_AUTOPILOT_NATIVE_CANDIDATE REV04,
plus Sin_Pelos_Multicam_Editor.py version 12. Its README explicitly requires
manual SRT import and subtitle styling. Its QA report says real Resolve QA is
pending. The Python multicam engine explicitly reports flat edits, not native
multicam angle references. The reel engine uses FFmpeg silencedetect rather
than contextual VAD plus word alignment. Existing code is preserved unchanged
under legacy_reference for further integration, not installed by this package.

## Remaining integration blockers

1. Validate native SmartSwitch and specific camera instructions on the installed
   Resolve build, including preservation of editable multicam references.
2. Implement actual master assembly, sponsor placement and note tracks.
3. Integrate word alignment, contextual reel pause cuts and correct final captions.
4. Validate safe styled subtitle insertion following the previously reported crash.
5. Integrate Voice Isolation, speaker balancing and rendered loudness measurement.
6. Verify vertical framing, export preparation and recovery on a real project.

The included API reference mentions PerformMulticamSmartSwitch and
SetVoiceIsolationState. That reference is not proof that either works in the
user's installed build. This environment has no macOS Resolve process or real
episode project, so no native integration or installer execution is certified.
The installer installs this development package only and is not a signed .pkg.

To unblock real integration, provide the installed Resolve Developer/Scripting
README.txt and an exported small .drp test project containing the synchronized
multicam, with linked test media. The application should then be tested on that
Mac; a .drp file alone cannot execute Resolve in this Linux environment.

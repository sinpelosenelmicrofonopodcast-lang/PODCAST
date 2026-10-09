# SPM Podcast Editor Autopilot

Local macOS application for assembling an existing synchronized multicam podcast from a MASTER JSON. Open Resolve Studio on the source project, launch the app, select the JSON and an output folder, then run or resume.

The engine preserves full-episode timing, creates hook and intro sections, inserts source-anchored sponsors, keeps production notes on a disabled track, creates independent vertical reels, trims only corroborated reel pauses, aligns transcript words locally, creates editable Text+ captions or karaoke overlays, applies native voice isolation and dialogue leveling, and prepares the export queue. Atomic reports and ownership markers allow completed outputs to be reused and interrupted outputs to be preserved before rebuilding.

## Install and execute

GitHub Actions builds separate Apple Silicon and Intel application/installer artifacts. Install the matching `.pkg` in Applications. FFmpeg, Python and local transcription dependencies are bundled; the first automatic transcription downloads model weights. Builds use ad-hoc signing and are not Apple notarized.

Resolve must permit local external scripting. Source JSON must name a verified, synchronized native multicam timeline with matching duration and frame rate. AUTO camera switching uses the native SmartSwitch API. EXACT camera selections are rejected until a compatible angle selector is validated. Original source timelines are preserved.

For source execution with Python 3.10+ and FFmpeg:

```sh
python3 -m spm_editor validate master.json
python3 -m spm_editor dry-run master.json
python3 -m spm_editor inspect master.json
python3 -m spm_editor run master.json --output ./reports
python3 -m spm_editor resume master.json --output ./reports
python3 -m spm_editor qc master.json --render exported_episode.mp4
python3 -m unittest discover -s tests -v
```

`qc --render` measures loudness on a real exported file. Queuing exports does not prove final loudness or start final rendering. Review the generated timelines before exporting. The supplied example is a synthetic contract fixture, not a real episode.

## Verification

29 local tests pass, including real waveform processing, transparent caption rendering, rendered loudness checks, recovery, and a full episode/six-reel scenario using a Resolve API simulator. GitHub CI repeats the checks and builds both macOS packages with frozen CLI and GUI startup tests. Simulator success is not actual Resolve certification. The optional self-hosted native workflow requires a Mac with Resolve and a linked test project; hosted runners do not supply that environment.

Native multicam switching, framing and Fusion imports still require verification in the installed Resolve build. Dedicated bin organization and automatic sponsor image conforming are not implemented. The JSON schema describes the envelope; runtime validation checks editorial semantics.

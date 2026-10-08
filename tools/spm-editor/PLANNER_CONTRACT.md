# Transcript to SPM manifest

Return schema_version 3.0 and every top-level object in master.schema.json.
Use the verified source timeline frame rate. Bito's default for new work is 24/1.
Never convert an existing 24000/1001 timeline without an explicit decision.

The planner must request a locally generated source profile once per project.
It must not invent multicam angle mappings, source file paths, intro/sponsor
assets, speaker identities, word timing or the source duration.

Store source-relative half-open integer frame ranges, not output timecodes.
Set master_edit.automatic_silence_removal=false and
master_edit.automatic_filler_removal=false. Explicit exclusions need approved=true
and a reason. Set automatic_silence_removal=true independently for every reel.
Preserve comedic, emotional and other intentional reel pauses using
protected_pause_frames. Select six truthful, coherent reels when the transcript
contains enough suitable material; do not fill a quota with invented moments.

Reel waveform analysis requires source.analysis_audio_path aligned to source
timeline time zero. Captions require transcript.words containing text and
source_frames and transcript.word_timing_verified=true. Phrase-level SRT is
insufficient to claim verified word timestamps. Alignment is not implemented
in this version; leave unverified inputs blocked rather than fabricate them.

Execution currently uses native AUTO SmartSwitch. Exact camera instructions
are blocked pending an angle-selection adapter. Sponsor modes implemented are
INTERRUPTION, OVERLAY and LOWER_THIRD. Each requires id, asset_path,
source_frame and duration_frames. Intro requires asset_id, asset_path and
duration_frames. Chapters contain title and source_frame. Editor notes contain
id, text and source_frame.

The product is still under development. Current caption output is an editable
ASS/SRT sidecar plus a styled alpha-video overlay, not editable native Text+.

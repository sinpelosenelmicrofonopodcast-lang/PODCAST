# Verification boundaries

GitHub CI runs the actual Python contract compiler and local FFmpeg operations.
Native adapter tests use an explicitly named Resolve API simulator.
An online CI pass does not imply a successful DaVinci Resolve integration.

Linux: contract tests, adapter tests, actual waveform analysis, actual styled
caption rendering, alpha channel/frame count inspection, command smoke tests.
macOS: Python compilation, contract/adapter tests and INSTALL.command execution.
DaVinci Resolve is not assumed to be installed on a hosted GitHub runner.

Native integration can be invoked separately on a self-hosted runner labeled
spm-resolve with Resolve installed and a test project already open. This is
manual and not scheduled on every push. No self-hosted runner is claimed to
exist or to have passed until its actual workflow result confirms that.

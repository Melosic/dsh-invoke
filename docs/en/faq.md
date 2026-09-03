# FAQ

Frequently asked questions about using dsh-invoke, plus version compatibility notes.

## FAQ

**Q: After copying to the clipboard, can it auto-paste into the input box?**

A: The current version uses manual paste for stability. Once Harness officially exposes an input-write API, we will support it right away.

**Q: Can the built-in example prompt be deleted?**

A: Yes. The example prompt supports edit and delete just like user-defined prompts.

**Q: If both project-level and user-level exist, which wins?**

A: Project-level takes priority; for a duplicate ID, the project-level config wins.

**Q: How do I use auto variable extraction? Why does it sometimes not work?**

A: Auto-extraction is planned and not yet wired up: the extraction engine is implemented, but the current Harness web client exposes no editor-selection API, so the dialog always asks for manual input. It will light up automatically once the host provides selection access.

**Q: Do I have to use the command line?**

A: No. All operations can be done through the sidebar GUI; the command line is an optional fallback for keyboard-driven users and degraded scenarios.

## Version Compatibility

The v0.2.x series is compatible with DeepSeek Harness >=0.1.0 <0.2.0. When Harness ships a major update, we will adapt promptly — follow the GitHub Releases page.
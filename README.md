# @kevinweber/pi-copy-prompt

Copy your current Pi draft to the clipboard with **⌘Y** on macOS (`super+y`). Collapsed pasted text is copied in full, and the editor briefly shows `prompt copied`.

## Install

```bash
pi install npm:@kevinweber/pi-copy-prompt@1.0.0
```

## Behavior

- Copies draft text without submitting it, preserving whitespace and expanding collapsed pastes.
- Does not copy system instructions, conversation history or attachments.
- Leaves the clipboard unchanged when the draft is empty or whitespace-only.
- Reports clipboard errors.

## Compatibility and privacy

Requires Node.js >=22.19.0 and Pi with custom-editor and expanded-paste support.

Your terminal must support the Super/Command modifier, typically through the Kitty keyboard protocol, and pass the shortcut through to Pi. `ctrl+y` keeps its usual yank behavior.

Do not combine this package with another custom-editor extension or a local copy of this extension. Pi supports only one custom editor at a time.

Remote clipboard copying requires terminal support for OSC 52; the confirmation cannot guarantee that the terminal accepted it. Copied text may be saved in clipboard history or synced to other devices.

## Contributing

See [CONTRIBUTING.md](https://github.com/kevinweber/pi-copy-prompt/blob/main/CONTRIBUTING.md) for development checks.

## License

MIT © Kevin Weber

# @kevinweber/pi-copy-prompt

Copy the full expanded Pi editor draft to the clipboard with **super+y** (⌘Y on macOS). The editor's bottom border shows `⌘Y (copy prompt)` and briefly confirms `prompt copied`. No LLM calls are made.

## Install

Once published to npm, install with:

```bash
pi install npm:@kevinweber/pi-copy-prompt@1.0.0
```

Try a local checkout without changing your Pi settings:

```bash
pi -e ./src/index.ts
```

## Behavior

- Copies the complete current text draft, including the contents of collapsed paste markers.
- Does **not** copy system instructions, conversation history, attachments or image bytes.
- Preserves whitespace in a non-empty draft. An empty or whitespace-only draft leaves the clipboard unchanged.
- Shows `prompt copied` briefly after copying and reports clipboard errors.
- Does nothing in RPC, JSON or print mode. There is no additional command or configuration.

## Compatibility and privacy

Requires Node.js >=22.19.0 and Pi with custom-editor and expanded-paste support.

`super` requires the terminal to report the modifier separately, typically through the Kitty keyboard protocol. The terminal or operating system must also pass the shortcut through rather than intercept it. Terminals without that support may not deliver ⌘Y. The shortcut remains `super+y`; `ctrl+y` retains Pi's yank behavior.

This extension replaces Pi's main editor and keeps its standard controls. Do not combine it with another custom-editor extension: Pi supports only one editor replacement at a time. Disable duplicate workspace copies before installing this package.

Clipboard delivery uses Pi's platform/native clipboard helper and remote OSC 52 support. OSC 52 emission cannot verify terminal acceptance; `prompt copied` means the helper resolved, not that every terminal accepted the text. Copying expanded pasted content can expose it to clipboard history or synchronization. Only copy content you intend to put there.

## Contributing

See [CONTRIBUTING.md](https://github.com/kevinweber/pi-copy-prompt/blob/main/CONTRIBUTING.md) for development checks.

## License

MIT © Kevin Weber

# @kevinweber/pi-copy-prompt

Copy the full expanded Pi editor draft to the clipboard with **super+y** (⌘Y on macOS). The editor's bottom border shows `⌘Y (copy prompt)` and briefly confirms `prompt copied`. No LLM calls are made.

## Install

From the repository, once it has been published:

```text
pi install git:github.com/kevinweber/pi-copy-prompt
```

Try a local checkout without changing your Pi settings:

```bash
pi -e ./src/index.ts
```

## Behavior

- Copies the complete current text draft, including the contents of collapsed paste markers.
- Does **not** copy system instructions, conversation history, attachments or image bytes.
- Preserves whitespace in a non-empty draft. An empty or whitespace-only draft shows `Nothing to copy — editor is empty` without writing to the clipboard.
- Shows confirmation for two seconds after the clipboard helper succeeds, or until the next editor input or programmatic text change.
- Reports clipboard rejection without success feedback. Pending operations cannot confirm on a replacement editor or session.
- Does nothing in RPC, JSON or print mode. There is no additional command or configuration.

## Compatibility and privacy

Requires Node.js >=22.19.0 and Pi with `CustomEditor` and `getExpandedText()` support. Development checks use Pi 1.4.0. Both Pi host packages are peers, not bundled runtime dependencies.

`super` requires the terminal to report the modifier separately, typically through the Kitty keyboard protocol. The terminal or operating system must also pass the shortcut through rather than intercept it. Terminals without that support may not deliver ⌘Y. The shortcut remains `super+y`; `ctrl+y` retains Pi's yank behavior.

This extension replaces Pi's main editor while inheriting `CustomEditor` controls. Do not combine it with another custom-editor extension: Pi has one editor replacement slot, and load order can leave the hint and shortcut attached to different editors. Disable duplicate workspace copies before installing this package.

Clipboard delivery uses Pi's platform/native clipboard helper and remote OSC 52 support. OSC 52 emission cannot verify terminal acceptance; `prompt copied` means the helper resolved, not that every terminal accepted the text. Copying expanded pasted content can expose it to clipboard history or synchronization. Only copy content you intend to put there.

## Development

```bash
npm install
npm run ci
npm pack --dry-run
```

`npm run ci` runs syntax checks, strict typechecks and unit tests. Tests use the real host editor and a mocked clipboard with synthetic drafts; they never write to the system clipboard. These checks do not prove physical key delivery or real terminal/clipboard compatibility. Inspect the package payload before any authorized publication. No publication workflow is included and npm publication is not part of this extraction.

Repository location: <https://github.com/kevinweber/pi-copy-prompt> (planned; not created by this extraction).

## License

MIT © Kevin Weber

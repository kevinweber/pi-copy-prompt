# Contributing

Repository: <https://github.com/kevinweber/pi-copy-prompt>.

Before submitting a change, run:

```bash
npm install
npm run ci
npm pack --dry-run
```

`npm run ci` runs syntax checks, strict typechecks and unit tests against the development Pi version pinned in `package.json`. The tests do not verify physical shortcut delivery or real terminal/clipboard compatibility. Inspect the package payload before publication.

Keep each change focused. Add unit tests in `src/index.test.mjs` for new behavior. Use synthetic drafts and a mocked clipboard; do not modify a contributor's real clipboard or Pi configuration during automated checks.

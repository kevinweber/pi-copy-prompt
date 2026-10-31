# Contributing

The planned repository location is <https://github.com/kevinweber/pi-copy-prompt>.

Before submitting a change, run:

```bash
npm run ci
npm pack --dry-run
```

Keep each change focused. Add unit tests in `src/index.test.mjs` for new behavior. Use synthetic drafts and a mocked clipboard; do not modify a contributor's real clipboard or Pi configuration during automated checks.

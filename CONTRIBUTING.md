# Contributing

Thanks for helping out! This plugin is intentionally small: one host command, one browser half.

## Setup

```sh
git clone git@github.com:deqingLv/dsh-slash-new.git
cd dsh-slash-new
node --test test/*.test.mjs
```

There are no runtime dependencies; Node 20+ is enough to run the tests.

## Ground rules

- **Keep it dependency-free.** The plugin runs inside the DSH host and renderer; new npm dependencies have to be vendored into the profile and bloat the bundle.
- **Host half stays thin.** `lib/index.js` only registers the command and settles a result; session switching belongs to the browser half, which listens to `command/executed` (see `lib/index.js` and `client/client.js`).
- **Never touch a service without injecting it.** The renderer context is a cordis proxy: `ctx.sessions` etc. must be declared in `exports.inject` (or read through `ctx.get(name)`), otherwise the property access throws.
- **Fail loudly, degrade quietly.** If the host does not expose what we need, log a `console.warn` with the `[dsh-slash-new]` prefix and leave the session usable — never crash the composer.
- **Tests for behaviour, not coverage.** Add a case to `test/client.test.mjs` when you change session switching or preset replay.

## Pull requests

1. Fork, branch from `main`, keep the diff focused.
2. Run the test suite and `node --check` on both halves.
3. Describe *what the host does* (which projection/command you relied on) in the PR body — DSH internals are under-documented, so the reasoning is valuable.
4. If you tested in a real DSH desktop session, say which version (`0.2.x`).

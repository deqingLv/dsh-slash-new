# dsh-slash-new

[![CI](https://github.com/deqingLv/dsh-slash-new/actions/workflows/ci.yml/badge.svg)](https://github.com/deqingLv/dsh-slash-new/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

A small [DeepSeek Harness](https://github.com/dsh-market/dsh-market) (DSH) plugin that adds a single slash command: **`/new`**.

![The `/new` command in the DSH composer](docs/screenshot.jpg)

It starts a blank session in the current workspace — the same action as the sidebar's 「新会话」 button and `Cmd+N` — and carries the old session's **permission preset** and **agent preset** over to the new one, so starting fresh never silently widens or narrows what the agent is allowed to do.

## Why it exists

DSH sessions are append-only logs, so there is nothing to truncate in place. "Clearing" a conversation means starting a new one and leaving the old log in the sidebar. DSH ships `/compact`, but no `/new` in the desktop composer, and hand-creating a session resets its permission preset to the profile default.

## What `/new` does

| Step | Behaviour |
| --- | --- |
| 1 | Reads the current session's `permissions` projection (`read-only` / `ask` / `never` / `danger-full-access` / `auto`) and its `agentPreset` |
| 2 | Creates or reuses a blank session in the **same workspace**, passing the agent preset to session creation |
| 3 | Opens that session in the main panel |
| 4 | Replays the permission preset by running the host's own `/permission <preset>` command in the new session — the same call the permission chip in the composer makes |

The previous session keeps its log and stays in the sidebar. A *custom* (hand-tuned) permission mix cannot be expressed as a preset, so the new session falls back to the host default and a warning is logged to the client console.

## Install

```sh
# 1. point the desktop profile at this package
dsh plugin --profile desktop add link:/absolute/path/to/dsh-slash-new

# 2. add "dsh-slash-new" to dsh.bundle.bundles in
#    ~/.dsh/profiles/desktop/package.json

# 3. restart the desktop app (Cmd+Q, then reopen)
```

Once published to npm, `dsh plugin --profile desktop add dsh-slash-new` is enough; the bundle entry is still required.

Client bundles are compiled at boot, so **restart the app after installing or changing either half** of the plugin.

## Uninstall

```sh
dsh plugin --profile desktop remove dsh-slash-new
```

…then drop `"dsh-slash-new"` from `dsh.bundle.bundles` and restart.

## Compatibility

- Tested with DSH desktop `0.2.1-rc.3` (Web renderer). The client half needs `sessions`, `workspaces` and `uiWorkspace` (blank-session creation, session switching) and the host's `/permission` command.
- Do not install it alongside another plugin that owns `/new` (for example `deepseek-harness-ultra-slash`): both register the same command name and both listen to `command/executed`, so a single `/new` would switch sessions twice.

## Development

```sh
node --test test/*.test.mjs   # unit tests (no dependencies, Node >= 20)
node --check lib/index.js && node --check client/client.js
```

- `lib/index.js` — host half: registers the command in `ctx.commands` and settles a short result.
- `client/client.js` — browser half: listens to `command/executed`, opens the blank session and replays the preset.
- `test/` — fake-context tests for both halves, including the inherited-preset and custom-preset paths.

For an end-to-end check without touching your real profile, boot a disposable instance and run `/new` there:

```sh
DSH_HOME=/tmp/dshhome dsh --profile scratch --no-open --port 63002
```

## 中文速览

`/new` 在 DSH 桌面端开启一个空白会话（等同于侧边栏「新会话」/`Cmd+N`），并把当前会话的**权限预设**和**代理预设**带到新会话里，避免一开新会话权限就被重置成默认值。旧会话的日志仍留在左侧列表。自定义（custom）权限无法用预设表达，新会话会回落到默认并在控制台告警。

安装、卸载和兼容性说明见上方英文部分；装完记得重启 App（客户端 bundle 在启动时编译）。

## License

MIT © 2026 deqingLv

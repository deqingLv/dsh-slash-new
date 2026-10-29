# Changelog

## 1.0.0

First public release.

- Adds `/new` to the DeepSeek Harness composer: opens (or reuses) a blank
  session in the current workspace, exactly like the sidebar's 「新会话」.
- Carries the old session's permission preset into the new session by replaying
  the host's `/permission <preset>` command; a custom permission mix falls back
  to the host default with a console warning.
- Carries the agent preset through session creation.
- Unit tests for both halves (no dependencies), CI on Node 22 and 24.

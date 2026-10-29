/**
 * dsh-slash-new — browser half.
 *
 * The host half registers `/new` and settles a short result. This half
 * listens to the client command service's `command/executed` event, then
 * starts a blank session in the same workspace — the same blank the sidebar's
 * "新会话" button and Cmd+N reach — and, crucially, replays the old session's
 * permission preset into the new one so a /new never silently widens or
 * narrows your access. The old session is untouched: its log stays in the
 * sidebar.
 */
window.__ModuleLoader__.load({
  id: 'dsh-slash-new',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports

    const TAG = '[dsh-slash-new]'

    /**
     * Read a cordis service without touching an un-injected property.
     * The desktop host injects `sessions` / `workspaces` / `uiWorkspace`;
     * this helper keeps the plugin loadable on a host that omits one.
     */
    function service(ctx, name) {
      try {
        const value = ctx.get(name)
        if (value !== undefined && value !== null) return value
      } catch {}
      return undefined
    }

    function snapshotOf(store) {
      try {
        if (store !== undefined && store !== null && typeof store.getSnapshot === 'function') return store.getSnapshot()
        if (store !== undefined && store !== null && typeof store === 'object' && 'value' in store) return store.value
      } catch {}
      return undefined
    }

    /** The materialized Session object behind an id, if this client holds it. */
    function sessionOf(ctx, sessionId) {
      try {
        return service(ctx, 'sessions')?.binding?.(sessionId)?.session
      } catch {
        return undefined
      }
    }

    /** "permissions" projection -> { currentValue: preset | "auto" | "custom" }. */
    function permissionOf(session) {
      try {
        return session?.projections?.faceOf?.('permissions')?.getSnapshot?.()?.currentValue
      } catch {
        return undefined
      }
    }

    function agentPresetOf(ctx, sessionId) {
      try {
        const byId = snapshotOf(service(ctx, 'sessions')?.list)?.byId
        const value = byId?.[sessionId]?.projectionValues?.agentPreset
        return typeof value === 'string' && value.length > 0 ? value : undefined
      } catch {
        return undefined
      }
    }

    function workspaceOf(ctx, sessionId) {
      try {
        const items = snapshotOf(service(ctx, 'workspaces')?.list)?.items
        if (!Array.isArray(items)) return undefined
        return items.find((item) => Array.isArray(item.sessionIds) && item.sessionIds.includes(sessionId))
      } catch {
        return undefined
      }
    }

    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /**
     * Replay one permission preset onto a freshly opened session. Waits for the
     * session binding to materialize (the client only holds bindings for
     * sessions it has retained), then runs the host's own `/permission`
     * command, which is exactly what the permission chip in the composer does.
     */
    async function inheritPermission(ctx, sessionId, preset) {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const session = sessionOf(ctx, sessionId)
        if (session !== undefined && typeof session.command === 'function') {
          const current = permissionOf(session)
          if (current === preset) return
          try {
            const result = await session.command(`/permission ${preset}`)
            if (result !== undefined && result !== null && result.ok === false) {
              console.warn(`${TAG} /new: /permission ${preset} failed`, result.error)
            } else if (result !== undefined && result !== null && result.value?.matched === false) {
              console.warn(`${TAG} /new: the host offers no /permission command`)
            }
          } catch (error) {
            console.warn(`${TAG} /new: /permission ${preset} threw`, error)
          }
          return
        }
        await sleep(100)
      }
      console.warn(`${TAG} /new: new session ${sessionId} never materialized; permission preset "${preset}" not inherited`)
    }

    /**
     * Open a blank session in the old session's workspace, reusing an existing
     * blank when one matches, then carry the old session's agent preset and
     * permission preset over.
     */
    async function clearToBlank(ctx, oldSessionId) {
      const ui = service(ctx, 'uiWorkspace') ?? service(ctx, 'workspaces')
      if (ui === undefined) {
        console.warn(`${TAG} /new: no workspace service (uiWorkspace/workspaces) to open a blank session`)
        return
      }

      const oldSession = sessionOf(ctx, oldSessionId)
      const permission = permissionOf(oldSession)
      // "custom" is the derived not-a-preset state; /permission rejects it.
      const inheritablePermission =
        typeof permission === 'string' && permission.length > 0 && permission !== 'custom' ? permission : undefined
      const agentPreset = agentPresetOf(ctx, oldSessionId)
      const workspace = workspaceOf(ctx, oldSessionId)
      const reuse = agentPreset === undefined ? {} : { agentPreset }

      let newSessionId
      if (workspace !== undefined && typeof ui.connectBlank === 'function') {
        newSessionId = await ui.connectBlank(workspace.workspaceId, reuse)
      } else if (workspace !== undefined && typeof ui.connectWorkspace === 'function') {
        newSessionId = await ui.connectWorkspace(workspace.workspaceId, reuse)
      } else if (typeof ui.startSession === 'function') {
        ui.startSession(workspace?.workspaceId, reuse)
        console.warn(`${TAG} /new: host exposes no blank-session create result; permission preset cannot be inherited`)
        return
      } else {
        console.warn(`${TAG} /new: no blank-session starter available`)
        return
      }

      if (typeof newSessionId !== 'string' || newSessionId.length === 0) {
        console.warn(`${TAG} /new: blank session create returned no session id`)
        return
      }

      if (typeof ui.openSession === 'function') ui.openSession(newSessionId)

      if (inheritablePermission !== undefined) {
        // Fire-and-forget: the new session must render immediately; the preset
        // settles a moment later, like a manual chip pick.
        void inheritPermission(ctx, newSessionId, inheritablePermission)
      } else if (permission === 'custom') {
        console.warn(`${TAG} /new: the old session uses a custom permission mix; the new session keeps the host default`)
      }
    }

    function apply(ctx) {
      if (typeof ctx.on !== 'function') {
        console.warn(`${TAG} ctx.on unavailable; /new will not switch sessions`)
        return
      }
      ctx.effect(
        () =>
          ctx.on('command/executed', (sessionId, commandName, result) => {
            if (commandName !== 'new') return
            if (result !== null && typeof result === 'object' && result.kind === 'error') return
            clearToBlank(ctx, sessionId).catch((error) => {
              console.warn(`${TAG} /new: session switch failed`, error)
            })
          }),
        'dsh-slash-new: /new session switch',
      )
    }

    exports.apply = apply
    exports.inject = ['sessions', 'workspaces', 'uiWorkspace']
    return module.exports
  },
})

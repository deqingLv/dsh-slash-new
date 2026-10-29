import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const CLIENT_PATH = fileURLToPath(new URL('../client/client.js', import.meta.url))
const CLIENT_SOURCE = readFileSync(CLIENT_PATH, 'utf8')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Loads client/client.js the way the DSH renderer does — through
 * window.__ModuleLoader__.load — and wires a fake context whose services
 * record every call.
 */
async function loadClient(options = {}) {
  const calls = []
  const warnings = []
  let executed = null
  const preset = options.preset ?? 'danger-full-access'
  const agentPreset = options.agentPreset ?? 'standard'
  const oldSessionId = 'old1'
  const newSessionId = 'new1'

  const oldLive = {
    projections: { faceOf: () => ({ getSnapshot: () => ({ currentValue: preset }) }) },
  }
  const newLive = {
    command: async (command) => {
      calls.push(['command', command])
      return { ok: true }
    },
  }
  const sessions = {
    binding: (id) => (id === newSessionId ? { session: newLive } : { session: oldLive }),
    list: {
      getSnapshot: () => ({
        byId: { [oldSessionId]: { projectionValues: { agentPreset } } },
      }),
    },
  }
  const workspaces = {
    list: {
      getSnapshot: () => ({
        items: [{ workspaceId: 'ws1', sessionIds: [oldSessionId] }],
      }),
    },
  }
  const uiWorkspace = {
    connectBlank: async (workspaceId, reuse) => {
      // `reuse` is created inside the vm realm; clone it to a plain object.
      calls.push(['connectBlank', workspaceId, JSON.parse(JSON.stringify(reuse ?? null))])
      return newSessionId
    },
    openSession: async (id) => {
      calls.push(['openSession', id])
    },
  }
  const services = options.services ?? { sessions, workspaces, uiWorkspace }

  const ctx = {
    get: (serviceName) => services[serviceName],
    on: (event, handler) => {
      if (event === 'command/executed') executed = handler
      return () => {}
    },
    effect: (fn) => fn(),
  }

  let exports
  const window = {
    __ModuleLoader__: {
      load: ({ factory }) => {
        exports = factory(() => ({}))
      },
    },
  }
  vm.runInNewContext(CLIENT_SOURCE, { window, console: { warn: (...args) => warnings.push(args.join(' ')) }, setTimeout })

  exports.apply(ctx)
  return {
    exports,
    calls,
    warnings,
    async run(name, result = { kind: 'success' }) {
      executed(oldSessionId, name, result)
      await sleep(50)
    },
  }
}

test('declares the services the client half needs', async () => {
  const client = await loadClient()
  assert.deepEqual([...client.exports.inject], ['sessions', 'workspaces', 'uiWorkspace'])
})

test('ignores commands other than /new', async () => {
  const client = await loadClient()
  await client.run('compact')
  assert.deepEqual(client.calls, [])
})

test('ignores failed results', async () => {
  const client = await loadClient()
  await client.run('new', { kind: 'error', text: 'boom' })
  assert.deepEqual(client.calls, [])
})

test('opens a blank session in the same workspace and replays the permission preset', async () => {
  const client = await loadClient()
  await client.run('new')
  assert.deepEqual(client.calls, [
    ['connectBlank', 'ws1', { agentPreset: 'standard' }],
    ['openSession', 'new1'],
    ['command', '/permission danger-full-access'],
  ])
  assert.deepEqual(client.warnings, [])
})

test('replays a non-default preset instead of the host default', async () => {
  const client = await loadClient({ preset: 'read-only' })
  await client.run('new')
  assert.deepEqual(client.calls.at(-1), ['command', '/permission read-only'])
})

test('cannot replay a custom permission mix and says so', async () => {
  const client = await loadClient({ preset: 'custom' })
  await client.run('new')
  assert.deepEqual(client.calls, [
    ['connectBlank', 'ws1', { agentPreset: 'standard' }],
    ['openSession', 'new1'],
  ])
  assert.equal(client.warnings.length, 1)
  assert.match(client.warnings[0], /custom permission mix/)
})

test('survives a host without the workspace service', async () => {
  const client = await loadClient({ services: { sessions: { binding: () => undefined } } })
  await client.run('new')
  assert.equal(client.calls.length, 0)
  assert.match(client.warnings[0], /no workspace service/)
})

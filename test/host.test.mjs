import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, inject, name } from '../lib/index.js'

function fakeHost() {
  const registered = []
  const effects = []
  const ctx = {
    commands: {
      register: (command) => {
        registered.push(command)
        return { dispose() {} }
      },
    },
    effect: (fn) => {
      effects.push(fn())
    },
  }
  return { ctx, registered, effects }
}

test('exports the plugin id and command service injection', () => {
  assert.equal(name, 'dsh-slash-new')
  assert.deepEqual(inject, ['commands'])
})

test('registers exactly one command named /new', () => {
  const { ctx, registered } = fakeHost()
  apply(ctx)
  assert.equal(registered.length, 1)
  assert.equal(registered[0].name, 'new')
  assert.ok(registered[0].description.includes('/new'))
})

test('handler settles a success result without calling the model', () => {
  const { ctx, registered } = fakeHost()
  apply(ctx)
  const result = registered[0].handler({})
  assert.equal(result.kind, 'success')
  assert.equal(typeof result.text, 'string')
})

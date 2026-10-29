/**
 * dsh-slash-new — host half.
 *
 * Registers one human command in the DSH command registry: `/new`.
 * The registry runs it directly against the agent (no model message), so the
 * handler only settles a short result. The browser half listens for
 * `command/executed` and opens a blank session in the current workspace,
 * which is what the CLI's /new does on this host: a DSH
 * session is an append-only log, so "clearing" a conversation means starting
 * a fresh one and leaving the old log in the sidebar.
 */

export const name = 'dsh-slash-new'

export const inject = ['commands']

const RESULT_TEXT = '已清空当前对话上下文：正在切到空白会话（旧会话仍留在左侧列表）。'

export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.commands.register({
        name: 'new',
        description: '开启空白会话，清空当前对话上下文（沿用当前权限预设；等同 CLI 的 /new）',
        handler: () => ({ kind: 'success', text: RESULT_TEXT }),
      }),
    'dsh-slash-new: /new command',
  )
}

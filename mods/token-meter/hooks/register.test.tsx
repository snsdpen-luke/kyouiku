import { expect, mock, test } from 'claude-code/testing'

import { bar, fmt, total } from './register'

test('bar fills in proportion and clamps', async () => {
  expect(bar(50, 10)).toBe('█████░░░░░')
  expect(bar(0, 4)).toBe('░░░░')
  expect(bar(150, 4)).toBe('████')
})

test('fmt shortens large counts', async () => {
  expect(fmt(950)).toBe('950')
  expect(fmt(12_345)).toBe('12.3k')
  expect(fmt(2_500_000)).toBe('2.50M')
})

test('total sums every token kind', async () => {
  expect(total({ input: 1, output: 2, cacheRead: 3, cacheWrite: 4, turns: 9 })).toBe(10)
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`pane draws on ${surface}`, async ($, on) => {
    mock.clock(on, { now: 1_700_000_000_000 })
    const ui = await $.ui.mount({ plugin: 'token-meter', surface, component: 'Pane', requestId: 'token-meter', props: {} } as any)
    const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text).join('\n')
    expect(texts).toContain('アカウント全体')
    expect(texts).toContain('このセッション')
  })
}

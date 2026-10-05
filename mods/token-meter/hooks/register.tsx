import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Meter, SessionRecord, Tokens } from '../types'

const PANE = 'token-meter'
const STORE_KEY = 'sessions'
const KEEP = 30

const ZERO: Tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, turns: 0 }
const meter = atom({ plugin: 'token-meter', key: 'meter' } as const, { limits: [], contextWindow: 0 })
const current = atom({ plugin: 'token-meter', key: 'current' } as const, {
  id: '', cwd: '', startedAt: 0, updatedAt: 0, tokens: ZERO,
})
const history = atom({ plugin: 'token-meter', key: 'history' } as const, [])

export const total = (t: Tokens) => t.input + t.output + t.cacheRead + t.cacheWrite

export const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n)

export const bar = (pct: number, width = 20) => {
  const p = Math.max(0, Math.min(100, pct))
  const full = Math.round((p / 100) * width)
  return '█'.repeat(full) + '░'.repeat(width - full)
}

const LABEL: Record<string, string> = { five_hour: '5時間枠', seven_day: '7日枠', spend_limit: '支出上限' }

const until = (iso: string | undefined, now: number) => {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (!(ms > 0)) return 'まもなくリセット'
  const h = Math.floor(ms / 3.6e6)
  const m = Math.floor((ms % 3.6e6) / 6e4)
  return h >= 24 ? `${Math.floor(h / 24)}日${h % 24}時間後リセット` : `${h}時間${m}分後リセット`
}

const tone = (pct: number) => (pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green')

const statusLine = (m: Meter) => {
  const parts = m.limits.map(l => `${LABEL[l.kind] ?? l.kind} ${l.percentUsed}%`)
  if (m.contextPercent !== undefined) parts.push(`ctx ${m.contextPercent}%`)
  return parts.length ? `◆ ${parts.join(' · ')}` : undefined
}

async function persist($: EngineInterface) {
  const rec = await read($, current)
  if (!rec.id) return
  const saved = ((await $.store.get(STORE_KEY)) ?? []) as SessionRecord[]
  const kept = [rec, ...saved.filter(s => s.id !== rec.id)].slice(0, KEEP)
  await $.store.set(STORE_KEY, kept)
  await update($, history, () => kept)
}

async function measure($: EngineInterface) {
  const u = await $.session.usage()
  const m: Meter = {
    limits: u.rateLimits,
    contextTokens: u.context.tokens,
    contextWindow: u.context.window,
    contextPercent: u.context.percent,
    usd: u.cost?.usd,
  }
  const now = await $.clock.now()
  await update($, meter, () => m)
  await update($, current, r => ({ ...r, contextPercent: m.contextPercent, usd: m.usd, updatedAt: now }))
  $.ui.status(statusLine(m))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'tokens', description: 'トークン使用量メーターを開く' })
    const id = await $.session.id()
    const saved = ((await $.store.get(STORE_KEY)) ?? []) as SessionRecord[]
    const prior = saved.find(s => s.id === id)
    const usage = await $.session.usage()
    const now = await $.clock.now()
    await update($, current, r =>
      r.id === id ? r : prior ?? { id, cwd: e.cwd, startedAt: usage.startedAt, updatedAt: now, tokens: ZERO },
    )
    await update($, history, () => saved)
    await measure($)
    void $.ui.open({ id: PANE, title: 'トークンメーター' })
    return next(e)
  })

  on('command.run', { command: 'tokens' }, async $ => {
    await measure($)
    await $.ui.open({ id: PANE, title: 'トークンメーター' })
    const m = await read($, meter)
    return { text: statusLine(m) ?? 'まだ計測値なし（最初の応答のあとに出る）' }
  })

  on('turn.complete', async ($, e, next) => {
    const res = await next(e)
    const u = e.usage
    if (u) {
      const now = await $.clock.now()
      await update($, current, r => ({
        ...r,
        updatedAt: now,
        tokens: {
          input: r.tokens.input + u.input_tokens,
          output: r.tokens.output + u.output_tokens,
          cacheRead: r.tokens.cacheRead + u.cache_read_input_tokens,
          cacheWrite: r.tokens.cacheWrite + u.cache_creation_input_tokens,
          turns: r.tokens.turns + 1,
        },
      }))
      await persist($)
    }
    return res
  })

  on('session.measure', async ($, e, next) => {
    await measure($)
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await persist($)
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const m = await read($, meter)
    const rec = await read($, current)
    const past = (await read($, history)).filter(s => s.id !== rec.id)
    const now = await $.clock.now()
    const t = rec.tokens
    const sum = total(t)

    return (
      <Box flexDirection="column">
        <Text bold>■ アカウント全体（全アプリ共通の利用枠）</Text>
        {m.limits.length === 0 && <Text dimColor>まだ計測値なし。最初の応答のあとに出る。</Text>}
        {m.limits.map(l => (
          <Box flexDirection="column">
            <Text>
              {(LABEL[l.kind] ?? l.kind).padEnd(5, '　')} <Text color={tone(l.percentUsed)}>{bar(l.percentUsed)}</Text>{' '}
              {l.percentUsed}% 使用 / 残り {Math.max(0, Math.round((100 - l.percentUsed) * 10) / 10)}%
            </Text>
            <Text dimColor>{'      '}{until(l.resetsAt, now)}</Text>
          </Box>
        ))}

        <Text> </Text>
        <Text bold>■ このセッション</Text>
        {m.contextPercent !== undefined && (
          <Text>
            文脈窓　 <Text color={tone(m.contextPercent)}>{bar(m.contextPercent)}</Text> {m.contextPercent}%（
            {fmt(m.contextTokens ?? 0)} / {fmt(m.contextWindow)}）
          </Text>
        )}
        <Text>
          累計 {fmt(sum)} トークン（{t.turns} ターン）
          {m.usd !== undefined ? `  API換算 $${m.usd.toFixed(2)}` : ''}
        </Text>
        <Text dimColor>
          {'  '}入力 {fmt(t.input)} / 出力 {fmt(t.output)} / キャッシュ読 {fmt(t.cacheRead)} / キャッシュ書 {fmt(t.cacheWrite)}
        </Text>

        <Text> </Text>
        <Text bold>■ 過去のセッション（このMODが入っていたもの）</Text>
        {past.length === 0 && <Text dimColor>記録なし</Text>}
        {past.slice(0, Math.max(1, (e.viewport?.rows ?? 30) - 16)).map(s => (
          <Text wrap="truncate-end">
            {new Date(s.startedAt).toISOString().slice(5, 16).replace('T', ' ')}  {fmt(total(s.tokens)).padStart(7)}  ctx{' '}
            {s.contextPercent ?? '-'}%  {s.cwd.split('/').pop()}
          </Text>
        ))}
      </Box>
    )
  })
}

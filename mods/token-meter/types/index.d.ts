export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number; turns: number }

export type SessionRecord = {
  id: string
  cwd: string
  startedAt: number
  updatedAt: number
  tokens: Tokens
  contextPercent?: number
  usd?: number
}

export type Meter = {
  limits: Limit[]
  contextTokens?: number
  contextWindow: number
  contextPercent?: number
  usd?: number
}

declare module 'claude-code' {
  interface PluginState {
    'token-meter': { meter: Meter; current: SessionRecord; history: SessionRecord[] }
  }
}

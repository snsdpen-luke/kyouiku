# token-meter（Claude Code 用 MOD）

Claude Code のセッション内にペインとステータス行を出す。

- アカウント全体: 5時間枠・7日枠の使用率（%）とリセットまでの時間
- このセッション: 文脈窓の使用率、累計トークン（入力/出力/キャッシュ読/キャッシュ書）、API換算コスト
- 過去のセッション: この MOD が入っていたセッションの記録（最大30件）

`/tokens` でペインを開く。

## 読み込み方

```
claude --plugin-dir /path/to/kyouiku/mods/token-meter
```

## 確認

```
claude plugin validate mods/token-meter
claude plugin test mods/token-meter
```

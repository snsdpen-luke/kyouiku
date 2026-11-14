---
name: dounyuu
description: 授業や小テストの最初に、教室の大画面（プロジェクター・テレビ）に映す導入スライドを作るとき、教材の URL の QR コードを作るときに使う。「スライドを作って」「導入を作って」「テストの前に説明したい」「QR にして」「QR コードをつけて」と言われたら開く。生徒が自分の Chromebook で読み進める教材そのものは kyouzai。
---

# dounyuu — 導入スライドと QR コード

剛さんの授業では、導入は**先生が大画面に映して口で話す**もの。スライドには言いたいことを1枚に1つだけ書き、手順や注意は先生用メモ（`N` キー）に書いて口で言う。

## 1. 既定（聞かずに決めてよい）

| 項目 | 既定 |
|---|---|
| 枚数 | 3〜6枚。最後の1枚は QR コード（生徒が教材を開く URL）を大きく |
| 中身の順 | 何をするか（1枚）→ 動く見本や問いかけ（1〜3枚）→ 時間と終わりの形（1枚）→ QR |
| 説明で始めない | 1枚目は問い・場面・見本。定義や手順の箇条書きで始めない |
| 文字 | 1枚に見出し＋短い文が3行まで。教室の後ろから読める大きさ（本文 28px 以上、1024×768 の舞台で） |
| 手順・注意 | 画面に書かない。各スライドの `data-note` に書く（`N` キーで先生にだけ出る）。メモも公開される（生徒に見せられない物を書かない） |
| 画面 | 1024×768 の舞台を画面に合わせて拡大縮小（教室の大画面は機種がまちまちなので、ここだけは比率固定）。白基調・ライトモード固定 |
| 操作 | → / Space / PageDown で次、← / PageUp で前、`N` でメモ。下に前へ・次へのボタン（タップでも動く） |
| 置き場所 | 本体は日本語名（例 `小テスト第3回導入.html`）、配る場所はその教材のフォルダの `intro.html`（`build.py` の `PAGES` に1行） |

## 2. 作り方

1. **ひな形**：`小テスト第2回導入.html` を写して中身を入れかえる（舞台の拡大縮小・キー操作・メモ・点の並びがそろっている）。QR の例は `制御クイズ導入.html`
   ```bash
   cp 小テスト第2回導入.html 小テスト第3回導入.html
   ```
2. **QR コード**：生徒が開く URL から作る（毎回 venv を作らない。`npm install` 済みの `qrcode` を使う）
   ```bash
   node .claude/skills/dounyuu/qr.mjs https://snsdpen-luke.github.io/kyouiku/review1/            # SVG を標準出力へ（HTML に貼る）
   node .claude/skills/dounyuu/qr.mjs https://snsdpen-luke.github.io/kyouiku/review1/ --png /tmp/qr.png   # 印刷・チラシ用の画像
   ```
   出た `<svg>` を最後のスライドに貼り、下に URL を文字でも書く（読めない端末のため）。**URL は生徒に配る物（`/<フォルダ>/`）にする**。`#sensei` などの先生用の URL を QR にしない
3. **確かめる**：
   - `python3 build.py` と `python3 kakunin.py`
   - 実物の Chrome で全スライドを撮る：`node .claude/skills/kyouzai/check-browser.mjs 本体.html --walk next --next '#next' --only chromebook,4x3 --out /tmp/dounyuu`。写真を自分の目で見る（文字のはみ出し・小さすぎ）
   - QR を読んで URL が合っているか：`node .claude/skills/dounyuu/qr.mjs <URL> --check 本体.html`（本体の中の QR が、その URL を作り直した物と同じかを比べる）
4. 公開は koukai。教材本体の URL がまだ公開されていないと、QR を読んでも開けないことを報告に書く

## 3. 報告

枚数と各スライドの1行要約／`N` キーのメモに入れたこと／QR の URL／見た画面写真。

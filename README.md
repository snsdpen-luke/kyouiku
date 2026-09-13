# kyouiku — 電子計測制御31 の教材

工業高校の科目「電子計測制御31」で使う教材。
中心は **ラダー工房** — 三菱系PLCのラダー図エディタ＋シミュレータ。

生徒はChromebookのブラウザで開き、ラダー図を組んで仮想の機械（自動ドア・踏切・
自動販売機・エレベーター）を動かす。単一HTML・ビルド不要・依存なし・通信なし。

## 生徒に配るURL

<https://snsdpen-luke.github.io/kyouiku/>

Google Classroom にはこのリンクを貼る。ファイルは配らない
（古い版を開いてしまう事故が起きるため）。

## ファイル

| ファイル | 中身 |
|---|---|
| `ラダー工房v2.html` | **本体。直すのはここだけ** |
| `index.html` | GitHub Pages が配るもの。`build.py` が作る**生成物**。手で編集しない |
| `ラダー工房.html` | 引き継ぎ前の現行版。授業で使ってきたもの。無傷で温存 |
| `regression.js` | jsdom によるリグレッション（85項目） |
| `build.py` | 本体から配布物を作る |
| `HANDOFF.md` | **引き継ぎ書。仕様・設計判断・禁止事項の正典。作業前に必ず読む** |

## 別のパソコンで作業を始める

```bash
git clone https://github.com/snsdpen-luke/kyouiku.git
cd kyouiku
npm install jsdom          # 検証に使う。これだけ
node regression.js ラダー工房v2.html    # 85項目すべて合格すればOK
```

ブラウザで `ラダー工房v2.html` を直接開けば動く。サーバーは要らない。

## 直したときの手順

```bash
node regression.js ラダー工房v2.html    # 1. 検証（必ず通す）
python3 build.py                        # 2. index.html を作り直す
git add -A && git commit -m "…"         # 3. 記録
git push                                # 4. 生徒の画面に反映される
```

画面右上の版表示（`VER 2026-09-14b`）も更新すること。
本体の `const VER="…"` を書き換える。

## claude.ai の Artifact 版について

同じものを Artifact でも公開してある。`python3 build.py <出力先>` で
Artifact 用の断片を作り、それを publish する。

**注意**: Artifact は「リンクを知っている全員に公開」と「最新版を自動で配る」を
同時にできない。生徒に配る設定にすると版が固定され、更新のたびに手で
切り替えることになる。**配布は GitHub Pages を主にする。**

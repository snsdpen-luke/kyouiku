---
name: koukai
description: kyouiku の教材を公開する（git push で GitHub Pages に出す）とき、Classroom に載せるとき、公開した教材の URL や QR コードを出すときに使う。教材を直し終えたら毎回（push は自動）。「push して」「公開して」「プッシュ」「出して」「URL は？」「反映されてない」「中身が変わってないぞ」「Classroom に出して」と言われたら開く。
---

# koukai — 教材を公開して、本当に変わったかを確かめる

`git push` した時点で生徒の画面が変わる。**push は自動**（剛さんの判断 2026-11-14）：教材を直し終えて確かめが通ったら、聞かずにこのスキルの手順で push し、公開ページの版まで確かめて報告する。

**push の前に剛さんに聞くのは、次のときだけ**（自動 push の例外）：
- 保存の名前（`'〇〇-v3'` など）を変える → 生徒の途中の記録が消える
- URL（フォルダ名・build.py の配る場所）を変える・消す → 配ったリンクが切れる
- 外へ送る通信（Apps Script など）を足す
- 定期考査の本番に近い問題を入れる（`#sensei` は鍵ではない。ソースは全世界から読める）
- 生徒の氏名・出席番号・成績・答案、学校の内部事情、鍵が混ざったかもしれない

前の2つは `kakunin.py` が「聞く」で知らせる（終わりのコード 3）。後ろの3つは自分で見る。
授業中かもしれない時間に出すときは、報告に「再読み込みした生徒から新しい版になる」と書く。
Trinity から任された作業でも、途中で Claude アプリから続けた作業でも、同じく自動で push する（剛さんの判断 2026-11-14「Trinity が公開するから自分はできない、は面倒。どちらでも勝手に push・公開して」）。worktree で作業したなら、下の2のとおり main に取り込んでから push する。

## 1. push の前（全部、毎回）

```bash
git status --short                 # 何が変わったか。関係ないファイルが混ざっていないか
python3 build.py                   # 本体 → 配る場所
git fetch -q origin
python3 kakunin.py --base origin/main   # 公開中の版と比べる。NG 0 になるまで直す。「聞く」が出たら止まって剛さんに聞く
```
- 新しい教材なら：`build.py` の `PAGES` に1行、README の「何をするもの」「生徒に配るURL」「ファイル」の3つの表に1行ずつ
- **公開してよい物か**を見る：生徒の氏名・出席番号・成績・答案、学校の内部事情、鍵（スプレッドシートの URL など、剛さんが決めた物を除く）、定期考査の本番の問題が入っていないか。`#sensei` は鍵ではない（ソースは全世界から読める）
- コミット：`[crocky] ` で始め、何を直したかを日本語で。最後に `Co-Authored-By:` の行

## 2. push

```bash
git pull --rebase origin main      # Trinity や別の作業が先に入っていることがある
python3 build.py && python3 kakunin.py --base origin/main   # 取り込んだあとにもう一度（生成物がずれていないか）
git push origin HEAD:main
```
- worktree の枝から出すときも `git push origin <枝>:main` ではなく、main に取り込んでから push する（前に、枝が Trinity の取り込みで消えていて、push する物がないことがあった）
- 拒否されたら force しない。出力をそのまま剛さんに見せる
- 翔陽ミニマートは来校者用の別の箱 `../kyouiku-free.github.io` にも写る（build.py が写す）。そちらでも `git -C ../kyouiku-free.github.io commit` と push が要る。作者は kyouiku-free（個人名で記録しない）

## 3. push のあと：本当に変わったかを確かめる（「中身が変わってないぞ」を防ぐ）

```bash
bash .claude/skills/koukai/kakunin-koukai.sh <フォルダ> <VER>
#  例: bash .claude/skills/koukai/kakunin-koukai.sh seigyo100 2026-11-14a
#  GitHub Pages の作り直しを待ち（最大5分）、公開ページに新しい VER が出たら ok
```
- VER のない教材（古い物）は、直した所の文字を3つ目の引数に渡す：`kakunin-koukai.sh wifi - "約 1/7"`
- ok が出てから剛さんに伝える。出なければ、何が古いままかを書く
- 剛さんの Chromebook で古いままなら：ページの再読み込み（Ctrl+Shift+R）。Classroom にはファイルではなく URL を貼る

## 4. Classroom に載せる（公開ページの ok が出たあと）

受け口の準備は `apps-script/README-Classroom.md`（剛さんが1回）。準備ができているかは `node .claude/skills/koukai/classroom.mjs status`（終わりのコード 3 なら未準備 → この章は飛ばし、報告に「Classroom には手で貼る」と書く）。

| いつ | すること |
|---|---|
| **新しい教材**（URL が増えた） | その科目のクラスに**下書き**で載せる：`node .claude/skills/koukai/classroom.mjs post <呼び名> <フォルダ>`。どのクラスか（呼び名）が決まらなければ聞く |
| 剛さんが「Classroom に出して」 | 言われたクラスに下書きで載せる。「すぐ公開」「生徒に出して」と言われたときだけ `--publish` |
| 直しただけ | 載せない（URL は同じ。生徒は前のリンクから新しい版を開く） |

- 題は README の「生徒に配るURL」の表の名前を使う（`--title` で変えられる）。導入スライド（`intro.html`）は先生が映す物なので載せない
- 先生用の入口（`#sensei` など）は載せない（classroom.mjs が断る）
- 同じ URL がもうあれば二重に載せない（`もう載っている` と出る）
- 載せたら、Classroom の下書きのリンクを報告に書く。剛さんが開いて「投稿」を押すと生徒に出る
- 呼び名は**科目ごと**（例：電気回路・電子計測制御・コンピュータシステム技術）。1つの呼び名にクラスをいくつでも入れられ、post するとその全部に載る。教材の科目は README の「何をするもの」の表の科目の欄で決める
- 呼び名を付けるのは `classroom.mjs courses` → `classroom.mjs map <呼び名> <id> [<id> …]`（足していく）。新しいクラスができたら同じく map で足す。年度が終わってアーカイブしたクラスは `courses` が「注意」で知らせるので `unmap <呼び名> <id>` で外す。受け口の URL と合言葉は `~/.config/kyouiku/classroom.json` にだけある。会話・repo・all-db に書かない

## 5. 剛さんに返すもの（2〜4行）

- 生徒に配る URL：`https://snsdpen-luke.github.io/kyouiku/<フォルダ>/`（トップのラダー工房だけ `/kyouiku/`）
- 先生用の入口（`#sensei` / `#demo` / `N` キー）があれば、その URL も
- 公開ページで確かめた版
- Classroom に載せたなら、その下書きのリンク（載せなかったなら、その理由）
- QR コードが要ると言われたら：`node .claude/skills/dounyuu/qr.mjs <URL> --png /tmp/qr.png` で作って SendUserFile で渡す

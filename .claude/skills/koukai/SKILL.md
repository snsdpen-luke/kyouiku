---
name: koukai
description: kyouiku の教材を公開する（git push で GitHub Pages に出す）とき、公開した教材の URL や QR コードを出すときに使う。「push して」「公開して」「プッシュ」「出して」「URL は？」「反映されてない」「中身が変わってないぞ」と言われたら開く。
---

# koukai — 教材を公開して、本当に変わったかを確かめる

`git push` した時点で生徒の画面が変わる。だから **push は剛さんが言ったときだけ**。
剛さんの「push して」「公開して」「ぷっしゅ」は、その会話の中ではそのまま許可として扱う（もう一度聞かない）。
Trinity から任された作業（worktree の中、指示文に「push や送信はしない」）では push しない。作り終えたら Trinity が取り込んで公開する。

## 1. push の前（全部、毎回）

```bash
git status --short                 # 何が変わったか。関係ないファイルが混ざっていないか
python3 build.py                   # 本体 → 配る場所
python3 kakunin.py                 # NG 0 になるまで直す（build 忘れ・VER・確認スクリプト）
```
- 新しい教材なら：`build.py` の `PAGES` に1行、README の「何をするもの」「生徒に配るURL」「ファイル」の3つの表に1行ずつ
- **公開してよい物か**を見る：生徒の氏名・出席番号・成績・答案、学校の内部事情、鍵（スプレッドシートの URL など、剛さんが決めた物を除く）、定期考査の本番の問題が入っていないか。`#sensei` は鍵ではない（ソースは全世界から読める）
- コミット：`[crocky] ` で始め、何を直したかを日本語で。最後に `Co-Authored-By:` の行

## 2. push

```bash
git pull --rebase origin main      # Trinity や別の作業が先に入っていることがある
python3 build.py && python3 kakunin.py   # 取り込んだあとにもう一度（生成物がずれていないか）
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

## 4. 剛さんに返すもの（2〜4行）

- 生徒に配る URL：`https://snsdpen-luke.github.io/kyouiku/<フォルダ>/`（トップのラダー工房だけ `/kyouiku/`）
- 先生用の入口（`#sensei` / `#demo` / `N` キー）があれば、その URL も
- 公開ページで確かめた版
- QR コードが要ると言われたら：`node .claude/skills/dounyuu/qr.mjs <URL> --png /tmp/qr.png` で作って SendUserFile で渡す

#!/bin/bash
# push のあと、公開ページが本当に新しくなったかを確かめる。
#   bash kakunin-koukai.sh <フォルダ> <VER> [ページに出るはずの文字]
#   例: bash kakunin-koukai.sh seigyo100 2026-11-14a
#       bash kakunin-koukai.sh wifi - "約 1/7"      （VER のない教材）
#   フォルダに "." を渡すとトップ（ラダー工房）。
# GitHub Pages の作り直しを最大5分待つ。見つかれば ok で 0、見つからなければ NG で 1。
folder="$1"; ver="$2"; text="$3"
if [ -z "$folder" ] || [ -z "$ver" ]; then echo "使い方: bash kakunin-koukai.sh <フォルダ> <VER|-> [文字]"; exit 2; fi
if [ "$folder" = "." ]; then url="https://snsdpen-luke.github.io/kyouiku/"; else url="https://snsdpen-luke.github.io/kyouiku/$folder/"; fi
head=$(git rev-parse HEAD 2>/dev/null)
for i in $(seq 1 30); do
  st=$(gh api repos/snsdpen-luke/kyouiku/pages/builds/latest --jq '.status + " " + .commit' 2>/dev/null)
  page=$(curl -s -H 'Cache-Control: no-cache' "$url?nocache=$(date +%s)")
  hit=1
  [ "$ver" != "-" ] && ! grep -q -- "$ver" <<<"$page" && hit=0
  [ -n "$text" ] && ! grep -q -- "$text" <<<"$page" && hit=0
  show="$ver"; [ "$ver" = "-" ] && show=""
  if [ $hit = 1 ]; then echo "ok   公開ページ $url に ${show:+版 $show }${text:+「$text」}が出ている（Pages: $st）"; exit 0; fi
  echo "…待つ ($((i*10))秒)  Pages: ${st:-不明}  HEAD: ${head:0:7}"
  sleep 10
done
cur=$(grep -o -E "VER *= *['\"][^'\"]+['\"]" <<<"$page" | head -1)
echo "NG   5分待っても $url が新しくならない。いま公開されている版: ${cur:-VERなし}"
echo "     確かめること: push は通ったか（git log origin/main -1）、build.py を走らせて生成物をコミットしたか"
exit 1

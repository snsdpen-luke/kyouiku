#!/bin/bash
# 使い方: bash tools/compile-check.sh src/arduino-kyozai-1.html
# 答えを入れた全課題のコードを取り出し、g++ で文法だけ調べる（本物の Arduino 変換ではない）。
# 本物で調べるなら arduino-cli compile -b arduino:avr:uno を使う（ネットが通る環境で）。
set -e
HTML=$(realpath "$1"); DIR=$(dirname "$0"); WORK=$(mktemp -d)
cp "$DIR/arduino-stub.h" "$WORK/stub.h"
node -e "
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://$HTML');
  const codes = await p.evaluate(() => LESSONS.map(L => L.code.replace(/\{([A-Z])\}/g, (_, k) => L.answers[k])));
  codes.forEach((c, i) => fs.writeFileSync('$WORK/t' + (i + 1) + '.cpp', '#include \"stub.h\"\n' + c.replace('#include <Servo.h>', '') + '\nint main(){setup();loop();}\n'));
  await b.close();
})();"
for f in $(ls $WORK/t*.cpp | sort -V); do
  r=$(g++ -fsyntax-only "$f" 2>&1 | grep -E "error" | head -2 || true)
  echo "$(basename $f .cpp): ${r:-OK}"
done

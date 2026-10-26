// 使い方: node tools/make-kotae.mjs src/arduino-kyozai-1.html src/arduino-kyozai-1_kotae.txt
//        node tools/make-kotae.mjs src/arduino-kyozai-2.html src/arduino-kyozai-2_kotae.txt
// ページを実際に開いて LESSONS を読み、教師用の答えファイル（UTF-8 BOM、CRLF）を作る。
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
const [html, out] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('file://' + path.resolve(html));
const text = await p.evaluate(() => {
  const NL = '\r\n', bar = '='.repeat(60);
  // 2回目のページは FIRST（最初の課題番号）・KOTAE_HEAD・KOTAE_WIRE を持つ。1回目は持たない
  const first = typeof FIRST === 'number' ? FIRST : 1;
  let s = (typeof KOTAE_HEAD === 'string' ? KOTAE_HEAD : 'Arduino 教材 1回目　教師用 完全コード（課題1〜' + LESSONS.length + '）') + NL +
    '（穴の答えを入れた状態。そのまま Arduino IDE に貼れば動く）' + NL +
    (typeof KOTAE_WIRE === 'string' ? KOTAE_WIRE : '課題11〜20の配線：D2 スイッチ / D6 LED（220Ω）/ D7 Trig / D8 Echo / D9 サーボ') + NL + NL;
  LESSONS.forEach((L, i) => {
    const fmt = a => Object.entries(a).map(([k, v]) => `  ${k}：${v}`).join(NL);
    HARDMODE = false; const v1 = variant(L, i);
    HARDMODE = true;  const v2 = variant(L, i);
    s += bar + NL + `課題${first + i}：${L.title}` + NL + bar + NL +
      (HARD[i + 1] ? '【ふつう】の答え' + NL + fmt(v1.answers) + NL + '【むずかしい】の答え' + NL + fmt(v2.answers) + NL + NL
                   : '【答え】' + NL + fmt(v1.answers) + NL + NL) +
      L.code.replace(/\{([A-Z])\}/g, (_, k) => L.answers[k]).replace(/\n/g, NL) + NL + NL;
  });
  return s;
});
fs.writeFileSync(out, '﻿' + text);
console.log('書き出し:', out);
await b.close();

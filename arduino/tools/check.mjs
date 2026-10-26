// 使い方: node tools/check.mjs src/arduino-kyozai-1.html
// 1) ページのエラー  2) むずかしいモードの穴が全部見つかるか（答えを入れると同じコードに戻るか）
// 3) 「形」ヒントが答えそのものになっていないか  4) 全画面を一度ずつ描けるか
import { chromium } from 'playwright';
import path from 'path';
const html = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() !== 'log') errs.push(m.text()); });
await p.goto('file://' + path.resolve(html));
const r = await p.evaluate(() => LESSONS.map((L, i) => {
  const fill = v => v.code.replace(/\{([A-Z])\}/g, (_, k) => v.answers[k]);
  const base = fill(L);
  HARDMODE = true; const vh = variant(L, i); HARDMODE = false;
  const missing = (HARD[i + 1] || []).filter(([s]) => !L.code.includes(s)).map(x => x[0]);
  const leak = Object.values(L.answers).concat(Object.values(vh.answers)).filter(a => shapeOf(a) === a);
  return { n: i + 1, tab: L.tab, blanks: Object.keys(L.answers).length, hard: Object.keys(vh.answers).length,
           hardOk: fill(vh) === base, missing, leak };
}));
for (const x of r) console.log(`${x.tab}\t穴 ${x.blanks}（むずかしい ${x.hard}）\t${x.hardOk ? 'OK' : '★むずかしいの答えが合わない'}\t${x.missing.length ? '★見つからない穴:' + x.missing.join(' | ') : ''}\t${x.leak.length ? '★形=答え:' + x.leak.join(' | ') : ''}`);
for (let i = 0; i < r.length; i++) { await p.evaluate(i => showLesson(i), i); await p.waitForTimeout(60); }
console.log(errs.length ? '★エラー:\n' + errs.join('\n') : 'ページのエラー: なし');
await b.close();

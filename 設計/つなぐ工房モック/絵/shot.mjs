import { chromium } from 'playwright';
const jobs = [
  ['_pv_Concept.html',   1000, 1780, 'つなぐ工房_01_コンセプト.png'],
  ['_pv_Edit.html',      1366,  768, 'つなぐ工房_02_課題02編集モード.png'],
  ['_pv_Main.html',      1366,  768, 'つなぐ工房_03_課題02運転モード.png'],
  ['_pv_Lesson05.html', 1366, 768, 'つなぐ工房_04_課題05真理値表と記号.png'],
  ['_pv_HalfAdder.html', 1366,  768, 'つなぐ工房_05_課題07半加算器.png'],
  ['_pv_HintJudge.html', 1366,  768, 'つなぐ工房_06_ヒントと判定.png'],
];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const [f, w, h, out] of jobs) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.goto('file://' + process.cwd() + '/' + f, { waitUntil: 'load' });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: out });
  console.log('shot', out);
  await p.close();
}
await b.close();

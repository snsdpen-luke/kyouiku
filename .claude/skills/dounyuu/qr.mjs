// URL から QR コードを作る（導入スライド・チラシ用）。npm の qrcode を使う（repo の package.json にある）。
//   node .claude/skills/dounyuu/qr.mjs <URL>                     SVG を標準出力へ（HTML にそのまま貼れる）
//   node .claude/skills/dounyuu/qr.mjs <URL> --png <出力.png>   画像（印刷用。600px）
//   node .claude/skills/dounyuu/qr.mjs <URL> --check <本体.html|画像.png>
//        中の QR を Chrome の読み取り（BarcodeDetector）で実際に読み、その URL になっているかを確かめる。
//        模様どうしは比べない（作る道具がちがうと、同じ URL でも模様が変わるため）。通信はしない。
// 誤り訂正は M、まわりの白い余白は 2 マス。
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(path.resolve('package.json'));
let QR;
try { QR = require('qrcode'); } catch {
  console.error('qrcode が入っていません。repo のいちばん上で npm install を走らせてください。'); process.exit(2);
}
const [url, opt, arg] = process.argv.slice(2);
if (!url || !/^https?:\/\//.test(url)) { console.error('使い方: node qr.mjs <URL> [--png 出力.png | --check 本体.html]'); process.exit(2); }
if (/#/.test(url)) console.error('注意: URL に # が入っています。先生用の入口を生徒に配っていないか確かめてください。');
const o = { errorCorrectionLevel: 'M', margin: 2, color: { dark: '#000000', light: '#ffffff' } };

if (opt === '--png') {
  await QR.toFile(arg, url, { ...o, width: 600 });
  console.log('作った: ' + arg);
} else if (opt === '--check') {
  const images = [];
  if (/\.png$/i.test(arg)) images.push('data:image/png;base64,' + fs.readFileSync(arg).toString('base64'));
  else {
    const html = fs.readFileSync(arg, 'utf8');
    for (const [svg] of html.matchAll(/<svg[^>]*viewBox="0 0 (\d+) \1"[^>]*>[\s\S]*?<\/svg>/g)) {
      let s = svg.includes('xmlns=') ? svg : svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      s = s.replace('<svg', '<svg width="400" height="400"');
      images.push('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s));
    }
  }
  if (!images.length) { console.log(`NG   ${arg} に QR らしい正方形の SVG がない`); process.exit(1); }
  const { chromium } = require('playwright');
  let b;
  try { b = await chromium.launch({ channel: 'chrome' }); } catch { b = await chromium.launch(); }
  const p = await b.newPage();
  // BarcodeDetector は https のページでしか使えない。作り物の https のページを返して、外へは出ない
  await p.route('**/*', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>qr</title>' }));
  await p.goto('https://qr-check.invalid/');
  const read = await p.evaluate(async (images) => {
    if (!('BarcodeDetector' in window)) return null;
    const det = new BarcodeDetector({ formats: ['qr_code'] }); const out = [];
    for (const src of images) {
      const img = new Image(); img.src = src; await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = 400; const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 400); g.drawImage(img, 0, 0, 400, 400);
      out.push(...(await det.detect(c)).map(x => x.rawValue));
    }
    return out;
  }, images);
  await b.close();
  if (read === null) { console.log('NG   この Chrome では QR を読めない（BarcodeDetector がない）。スマートフォンで読んで確かめる'); process.exit(1); }
  const ok = read.includes(url);
  console.log(ok ? `ok   ${arg} の QR を読むと ${url}` : `NG   ${arg} の QR を読むと ${read.length ? read.join(' / ') : '（読めない）'}。${url} ではない`);
  process.exit(ok ? 0 : 1);
} else {
  process.stdout.write(await QR.toString(url, { ...o, type: 'svg' }));
}

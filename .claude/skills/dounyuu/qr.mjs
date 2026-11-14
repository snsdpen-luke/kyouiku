// URL から QR コードを作る（導入スライド・チラシ用）。npm の qrcode を使う（repo の package.json にある）。
//   node .claude/skills/dounyuu/qr.mjs <URL>                     SVG を標準出力へ（HTML にそのまま貼れる）
//   node .claude/skills/dounyuu/qr.mjs <URL> --png <出力.png>   画像（印刷用。1枚 600px 前後）
//   node .claude/skills/dounyuu/qr.mjs <URL> --check <本体.html> 本体に貼った QR が、この URL の QR と同じ模様か
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
  // 模様だけを比べる：QR の行列を作り、本体の SVG の黒マスの位置と突き合わせる
  const m = QR.create(url, o).modules; const n = m.size;
  const html = fs.readFileSync(arg, 'utf8');
  const svgs = [...html.matchAll(/<svg[^>]*viewBox="0 0 (\d+) \1"[^>]*>([\s\S]*?)<\/svg>/g)];
  let found = false;
  for (const [, size, body] of svgs) {
    const s = +size, pad = (s - n) / 2; if (pad < 0 || pad % 1) continue;
    const black = new Set();
    for (const [, d] of body.matchAll(/<path[^>]*stroke="[^"]+"[^>]*d="([^"]+)"/g)) {
      // "M2 2.5h7m1 0h4..." の形（qrcode / segno の線の SVG）。M は絶対、m は相対
      let x = 0, y = 0;
      for (const [, c, a, b] of d.matchAll(/([MmHh])\s*(-?[\d.]+)(?:\s+(-?[\d.]+))?/g)) {
        if (c === 'M') { x = +a; y = +b; } else if (c === 'm') { x += +a; y += +b; }
        else { const len = c === 'h' ? +a : +a - x; for (let k = 0; k < len; k++) black.add(`${x + k},${Math.floor(y)}`); x += len; }
      }
    }
    let same = true;
    for (let r = 0; r < n && same; r++) for (let c = 0; c < n; c++) if (!!m.get(r, c) !== black.has(`${c + pad},${r + pad}`)) { same = false; break; }
    if (same) { found = true; break; }
  }
  console.log(found ? `ok   ${arg} の中に ${url} の QR がある` : `NG   ${arg} の中に ${url} の QR が見つからない（URL が違うか、別の形で描いてある）`);
  process.exit(found ? 0 : 1);
} else {
  process.stdout.write(await QR.toString(url, { ...o, type: 'svg' }));
}

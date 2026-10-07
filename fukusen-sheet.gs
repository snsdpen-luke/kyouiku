/**
 * 複線図れんしゅう → 先生の Google スプレッドシートに記録をためるスクリプト
 *
 * 使い方（1回だけ）
 *   1. Google スプレッドシートを新しく作る（名前は自由。例「複線図れんしゅう 記録」）
 *   2. メニュー「拡張機能」→「Apps Script」を開き、最初からある中身を全部消して、このファイルの中身を貼る → 保存
 *   3. 右上「デプロイ」→「新しいデプロイ」→ 種類の歯車で「ウェブアプリ」
 *        説明: 複線図れんしゅう
 *        次のユーザーとして実行: 自分
 *        アクセスできるユーザー: 全員
 *      →「デプロイ」。権限の確認が出たら、自分のアカウントで許可する
 *   4. 表示された「ウェブアプリの URL」（https://script.google.com/macros/s/…/exec）をコピーして開発担当に渡す
 *
 * 記録はシート「記録」に1行ずつたまる（無ければ自動で作る）。
 * 生徒のアプリは、判定・模擬試験の提出のたびに1行送る。届かなかった分は生徒の端末にためて、あとで送り直す。
 *
 * 注意: URL を知っていれば誰でも書き込める。授業の外に URL を広めないこと。
 */
const SHEET_NAME = "記録";
const HEADER = ["受信日時", "記録日時", "出席番号", "名前", "種類", "問題", "結果", "間違いの分類",
  "かかった時間(秒)", "挑戦回数", "合格回数", "ヒント回数", "お手本回数", "アプリの版"];

function doGet(e) {
  const p = (e && e.parameter) || {};
  const cb = String(p.cb || "callback").replace(/[^\w$]/g, "").slice(0, 60) || "callback";
  let res;
  const lock = LockService.getScriptLock();
  try {
    const d = JSON.parse(p.d || "{}");
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) { sh.appendRow(HEADER); sh.setFrozenRows(1); }
    sh.appendRow([new Date(), txt(d.t), txt(d.no), txt(d.name), txt(d.kind), txt(d.prob), txt(d.result), txt(d.cats),
      num(d.sec), num(d.tries), num(d.pass), num(d.hints), num(d.refs), txt(d.ver)]);
    res = { ok: true };
  } catch (err) {
    res = { ok: false, error: String(err).slice(0, 200) };
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
  return ContentService.createTextOutput(cb + "(" + JSON.stringify(res) + ")").setMimeType(ContentService.MimeType.JAVASCRIPT);
}

/* 文字は短く切り、先頭が = + - @ のものは式として動かないよう ' を付ける */
function txt(v) {
  if (v === undefined || v === null) return "";
  let s = String(v).slice(0, 100);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function num(v) { const n = Number(v); return isFinite(n) ? n : ""; }

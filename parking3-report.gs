/**
 * 自動運転への階段「学びのレポート」 → 先生の Google スプレッドシートに1人1行ためるスクリプト
 *
 * 使い方（1回だけ）
 *   1. Google スプレッドシートを新しく作る（名前は自由。例「自動運転への階段 レポート」）
 *   2. メニュー「拡張機能」→「Apps Script」を開き、最初からある中身を全部消して、このファイルの中身を貼る → 保存
 *   3. 右上「デプロイ」→「新しいデプロイ」→ 種類の歯車で「ウェブアプリ」
 *        説明: 自動運転への階段 レポート
 *        次のユーザーとして実行: 自分
 *        アクセスできるユーザー: 全員
 *      →「デプロイ」。権限の確認が出たら、自分のアカウントで許可する
 *   4. 表示された「ウェブアプリの URL」（https://script.google.com/macros/s/…/exec）をコピーして開発担当に渡す
 *
 * レポートはシート「レポート」に1行ずつたまる（無ければ自動で作る）。
 * 生徒のアプリは、本文を POST で送り（doPost）、届いたかを提出IDで問い合わせる（doGet の check。JSONP で返す）。
 * 同じ提出IDがもう一度届いたら、新しい行を足さずにその行を上書きする（送り直しで行が増えない）。
 * 生徒が直して出し直すと、新しい提出IDになり、新しい行が足される。いちばん下の行がその生徒の最新。
 *
 * 注意: URL を知っていれば誰でも書き込める。授業の外に URL を広めないこと。
 */
const SHEET_NAME = "レポート";
const HEADER = ["受信日時", "提出ID", "提出日時", "出席番号", "名前", "アプリの版",
  "レベル2成功", "レベル3成功", "レベル4成功", "レベル5成功", "10回テスト成功", "10回テスト平均",
  "走った回数", "引き継いだ回", "最後の調整",
  "問1 計測", "問2 制御", "問2 くらべた走行", "問3 路面", "問4 人と機械", "問5 社会"];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) { sh.appendRow(HEADER); sh.setFrozenRows(1); }
  return sh;
}
function findRow_(sh, id) {
  const n = sh.getLastRow() - 1;
  if (n < 1 || !id) return 0;
  const ids = sh.getRange(2, 2, n, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const id = String(d.id || "").replace(/[^\w]/g, "").slice(0, 40);
    if (!id) return out_({ ok: false, error: "no id" });
    lock.waitLock(10000);
    const sh = sheet_();
    const row = [new Date(), id, txt(d.t, 40), txt(d.no, 10), txt(d.name, 40), txt(d.ver, 20),
      num(d.w2), num(d.w3), num(d.w4), num(d.w5), num(d.tok), num(d.tavg), num(d.runs), num(d.take), txt(d.tune, 400),
      txt(d.q1), txt(d.q2), txt(d.cmp, 1000), txt(d.q3), txt(d.q4), txt(d.q5)];
    const r = findRow_(sh, id);
    if (r) sh.getRange(r, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err).slice(0, 200) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/* ?check=提出ID&cb=関数名 → cb({ok:true,found:true|false}) */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const cb = String(p.cb || "callback").replace(/[^\w$]/g, "").slice(0, 60) || "callback";
  let res;
  try {
    const id = String(p.check || "").replace(/[^\w]/g, "").slice(0, 40);
    res = { ok: true, found: !!findRow_(sheet_(), id) };
  } catch (err) {
    res = { ok: false, error: String(err).slice(0, 200) };
  }
  return ContentService.createTextOutput(cb + "(" + JSON.stringify(res) + ")").setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
/* 文字は長さを切り、先頭が = + - @ のものは式として動かないよう ' を付ける */
function txt(v, max) {
  if (v === undefined || v === null) return "";
  let s = String(v).slice(0, max || 500);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function num(v) { const n = Number(v); return v !== "" && isFinite(n) ? n : ""; }

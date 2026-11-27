#!/usr/bin/env python3
"""教材（本体の .html と .pdf）を Google ドライブへ写す。

  python3 tools/drive-sync.py                 変わったものだけ写す（新しいもの・中身が変わったもの・分類が変わったもの）
  python3 tools/drive-sync.py --list          写さずに、何をどこへ写すかだけ出す
  python3 tools/drive-sync.py --install-hook  git の post-commit フックを入れる（コミットのたびに裏で走る）

写し先は Drive for Desktop の同期フォルダ（剛さんの判断 2026-11-18）。API は使わない。
  1. 環境変数 KYOUIKU_DRIVE_DIR があればそこ
  2. なければ ~/Library/CloudStorage/GoogleDrive-*/マイドライブ/00_共有 を探す（1つだけ見つかったとき）
その下の「kyouiku教材/<分類>/」に置く。写し先が見つからない機械（クラウドのセッションなど）では何もしない。

分類は下の表 BUNRUI。表にないものは「未分類/」に入る。未分類が出たら、表に1行足して走らせ直す
（走らせ直すと、ドライブの中のファイルも新しい分類のフォルダへ移る）。
写さないもの：build.py の生成物（PAGES の配る場所）・template.html・. で始まるフォルダ・.gitignore で外したもの。
ドライブ側のファイルは消さない（本体の名前を変えたら、古い名前のものがドライブに残る。消すかは剛さんが決める）。
"""
import ast, glob, hashlib, json, os, shutil, subprocess, sys

SUB = "kyouiku教材"

# (本体の名前、または「フォルダ/」, 分類)。上から順に見て、最初に当たったもの
BUNRUI = [
    ("arduino/",                        "Arduino"),
    ("soujiki/",                        "電子計測制御"),
    ("ラダー工房.html",                 "電子計測制御"),
    ("ラダー工房v2.html",               "電子計測制御"),
    ("車の制御50.html",                 "電子計測制御"),
    ("車輪速センサ1.html",              "電子計測制御"),
    ("車輪速センサ2.html",              "電子計測制御"),
    ("距離センサ1.html",                "電子計測制御"),
    ("距離センサ2.html",                "電子計測制御"),
    ("自動駐車.html",                   "電子計測制御"),
    ("駐車を学習する車.html",           "電子計測制御"),
    ("自動運転への階段.html",           "電子計測制御"),
    ("制御クイズ100.html",              "電子計測制御"),
    ("制御クイズ導入.html",             "電子計測制御"),
    ("メッセージが届くまで.html",       "コンピュータシステム技術"),
    ("速い遅いの正体.html",             "コンピュータシステム技術"),
    ("電波はどこまで届くか.html",       "コンピュータシステム技術"),
    ("残高はどこにある.html",           "コンピュータシステム技術"),
    ("キャッシュレス商店.html",         "コンピュータシステム技術"),
    ("決済をえらぶ.html",               "コンピュータシステム技術"),
    ("サトシ・ナカモト事件ファイル.html", "コンピュータシステム技術"),
    ("ふりかえり演習.html",             "コンピュータシステム技術"),
    ("テックリーダー調べ.html",         "コンピュータシステム技術"),
    ("小テスト第2回導入.html",          "コンピュータシステム技術"),
    ("小テスト第2回解説.html",          "コンピュータシステム技術"),
    ("3つの部品RLC.html",               "電気回路"),
    ("コイルとコンデンサ.html",         "電気回路"),
    ("複線図練習.html",                 "電気工事士"),
    ("技能筆記練習.html",               "電気工事士"),
    ("進路シミュレーション.html",       "進路"),
    ("生まれ変わりのサイコロ.html",     "進路"),
    ("馬レース.html",                   "文化祭"),
    ("翔陽ミニマート.html",             "文化祭"),
    ("お化け屋敷サンプラー.html",       "文化祭"),
    ("サンプラー.html",                 "文化祭"),
]

HOOK = """#!/bin/sh
# kyouiku: コミットのたびに教材を Google ドライブへ写す（tools/drive-sync.py）。コミットは止めない
root=$(git rev-parse --show-toplevel)
[ -f "$root/tools/drive-sync.py" ] || exit 0
log="$(git rev-parse --git-common-dir)/drive-sync.log"
( cd "$root" && python3 tools/drive-sync.py >> "$log" 2>&1 & )
exit 0
"""


def git(*a):
    return subprocess.run(["git", *a], capture_output=True, text=True, check=True).stdout


def bunrui(rel):
    for key, cat in BUNRUI:
        if rel == key or (key.endswith("/") and rel.startswith(key)):
            return cat
    return "未分類"


def generated():
    """build.py の PAGES の配る場所（生成物）。build.py は import すると走るので、表だけ読む"""
    tree = ast.parse(open("build.py", encoding="utf-8").read())
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(getattr(t, "id", "") == "PAGES" for t in node.targets):
            return {dst for _, dst, _ in ast.literal_eval(node.value)}
    return set()


def sources():
    gen = generated()
    files = git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0")
    out = []
    for rel in sorted(set(files)):
        if not rel.lower().endswith((".html", ".pdf")):
            continue
        if rel in gen or os.path.basename(rel) == "template.html":
            continue
        if any(p.startswith(".") for p in rel.split("/")[:-1]) or "node_modules/" in rel:
            continue
        if os.path.isfile(rel):
            out.append(rel)
    return out


def drive_root():
    d = os.environ.get("KYOUIKU_DRIVE_DIR")
    if d:
        return d if os.path.isdir(d) else None
    hits = glob.glob(os.path.expanduser("~/Library/CloudStorage/GoogleDrive-*/マイドライブ/00_共有"))
    return hits[0] if len(hits) == 1 else None


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def install_hook():
    path = os.path.join(git("rev-parse", "--git-common-dir").strip(), "hooks", "post-commit")
    if os.path.exists(path) and "drive-sync" not in open(path, encoding="utf-8").read():
        print("止めた: 別の post-commit フックがある → " + path)
        return 1
    with open(path, "w", encoding="utf-8") as f:
        f.write(HOOK)
    os.chmod(path, 0o755)
    print("入れた: " + path)
    return 0


def main():
    os.chdir(git("rev-parse", "--show-toplevel").strip())
    if "--install-hook" in sys.argv:
        return install_hook()
    listing = "--list" in sys.argv
    root = drive_root()
    if not root and not listing:
        print("drive-sync: 写し先が見つからない（この機械には Drive for Desktop がない）。何もしない")
        return 0
    base = os.path.join(root or "<ドライブ>", SUB)
    state_path = os.path.join(git("rev-parse", "--git-common-dir").strip(), "drive-sync.json")
    try:
        state = json.load(open(state_path, encoding="utf-8"))
    except Exception:
        state = {}

    n = {"写した": 0, "移した": 0, "そのまま": 0}
    mibunrui = []
    for rel in sources():
        cat = bunrui(rel)
        if cat == "未分類":
            mibunrui.append(rel)
        dest = os.path.join(base, cat, os.path.basename(rel))
        if listing:
            print(f"{cat}/{os.path.basename(rel)}  ←  {rel}")
            continue
        h = sha(rel)
        old = state.get(rel, {})
        old_dest = old.get("dest")
        if old_dest and old_dest != dest and os.path.exists(old_dest) and not os.path.exists(dest):
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.move(old_dest, dest)  # 分類が変わった → ドライブの中で移す
            print(f"移した: {rel} → {cat}/")
            n["移した"] += 1
        if old.get("sha") == h and os.path.exists(dest):
            n["そのまま"] += 1
        else:
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            shutil.copyfile(rel, dest)
            print(f"写した: {rel} → {cat}/")
            n["写した"] += 1
        state[rel] = {"sha": h, "dest": dest}

    if not listing:
        with open(state_path, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=1)
        print("drive-sync: " + "・".join(f"{k} {v}" for k, v in n.items()) + f"（写し先 ドライブの 00_共有/{SUB}）")
    for rel in mibunrui:
        print("未分類: " + rel + "（tools/drive-sync.py の BUNRUI に1行足す）")
    return 0


if __name__ == "__main__":
    sys.exit(main())

# -*- coding: utf-8 -*-
"""配布物を作る。本体（日本語名の .html）を、配る場所（<フォルダ>/index.html）へ写すだけ。

  python3 build.py                  下の表 PAGES の全部を作る
  python3 build.py <出力先.html>    ラダー工房の Artifact 用断片も作る

本体を直したら必ず走らせること。生成物を手で編集してはいけない。
新しい教材を足すときは、PAGES に1行足す（README の2つの表にも書く）。
"""
import io, os, sys, shutil

# (本体, 配る場所, メモ)。配る場所の URL は https://snsdpen-luke.github.io/kyouiku/<配る場所のフォルダ>/
PAGES = [
    ("ラダー工房v2.html",          "index.html",          "ラダー工房（トップ）"),
    ("進路シミュレーション.html",  "shinro/index.html",   "進路学習（高2）"),
    ("馬レース.html",              "uma/index.html",      "翔陽ダービー（文化祭の QR は /uma/）"),
    ("翔陽ミニマート.html",        "mart/index.html",     "翔陽ミニマート（文化祭の QR は /mart/。下の FREE にも写す）"),
    ("サンプラー.html",            "sampler/index.html",  "こえサンプラー（マイクを使うので https で配る）"),
    ("お化け屋敷サンプラー.html",  "obake/index.html",    "文化祭のお化け屋敷の音響"),
    ("メッセージが届くまで.html",  "network/index.html",  "TCP/IP。導入スライドの QR は /network/"),
    ("車の制御50.html",            "car/index.html",      "センサ当て。導入スライドの QR は /car/"),
    ("車輪速センサ1.html",         "wheel/index.html",    "車輪速センサ 第1時"),
    ("車輪速センサ2.html",         "wheel2/index.html",   "車輪速センサ 第2時"),
    ("距離センサ1.html",           "dist/index.html",     "距離センサ 第1時（超音波）"),
    ("距離センサ2.html",           "dist2/index.html",    "距離センサ 第2時（ミリ波レーダー）"),
    ("自動駐車.html",              "parking/index.html",  "自動駐車をつくろう"),
    ("駐車を学習する車.html",      "parking2/index.html", "駐車を学習する車（試作）"),
    ("自動運転への階段.html",      "parking3/index.html", "自動運転への階段"),
    ("複線図練習.html",            "fukusen/index.html",  "第二種電気工事士 技能試験の複線図"),
    ("速い遅いの正体.html",        "speed/index.html",    "通信速度・画質・ギガ"),
    ("電波はどこまで届くか.html",  "wifi/index.html",     "Wi-Fi・間取り・ルーターの置き方"),
    ("残高はどこにある.html",      "emoney/index.html",   "電子マネー①"),
    ("キャッシュレス商店.html",    "shop/index.html",     "電子マネー単元の経営ゲーム"),
    ("決済をえらぶ.html",          "emoney2/index.html",  "電子マネー②"),
    ("ふりかえり演習.html",        "review1/index.html",  "コンピュータシステム技術の復習演習"),
    ("小テスト第2回導入.html",     "review1/intro.html",  "小テスト第2回の前に映す導入スライド"),
    ("サトシ・ナカモト事件ファイル.html", "bitcoin/index.html", "ブロックチェーン・マイニング"),
    ("技能筆記練習.html",          "ginou/index.html",    "技能試験 筆記トレーニング"),
    ("制御クイズ100.html",         "seigyo100/index.html", "電子計測制御の5択150問"),
    ("制御クイズ導入.html",        "seigyo100/intro.html", "制御クイズ100 の導入スライド"),
]

# 来校者に配る URL は https://kyouiku-free.github.io/mart/（個人名の出ない別の箱）。横に clone してあればそこにも写す。
# 写したあと、その箱で git commit / push する（作者は kyouiku-free。個人名で記録しない）
FREE = os.path.join("..", "kyouiku-free.github.io")
FREE_PAGES = [("翔陽ミニマート.html", "mart/index.html")]


def copy(src, dst):
    d = os.path.dirname(dst)
    if d:
        os.makedirs(d, exist_ok=True)
    shutil.copyfile(src, dst)
    print("生成: " + dst)


for src, dst, _ in PAGES:
    copy(src, dst)

if os.path.isdir(FREE):
    for src, dst in FREE_PAGES:
        copy(src, os.path.join(FREE, dst))
else:
    print("注意: ../kyouiku-free.github.io が無い。来校者用の URL は更新されない")

# Artifact 用（ラダー工房）。<!DOCTYPE>/<html>/<head>/<body> は claude.ai 側が付けるので剥がす
if len(sys.argv) > 1:
    out = sys.argv[1]
    s = io.open("ラダー工房v2.html", encoding="utf-8").read()
    style = s[s.index("<style>") : s.index("</style>") + len("</style>")]
    body  = s[s.index("<body>") + len("<body>") : s.rindex("</body>")]
    style = style.replace(":root{\n", ":root{\n  color-scheme:light;\n", 1)
    assert "color-scheme:light" in style, "color-scheme の差し込みに失敗"
    frag = "<title>ラダー工房</title>\n" + style + "\n" + body.strip() + "\n"
    for tag in ("<!DOCTYPE", "<html", "</html>", "<head>", "</head>", "<body>", "</body>"):
        assert tag not in frag, "剥がし残し: " + tag
    io.open(out, "w", encoding="utf-8").write(frag)
    print("生成: %s  (%d KB)" % (out, len(frag.encode("utf-8")) // 1024))

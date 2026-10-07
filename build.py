# -*- coding: utf-8 -*-
"""配布物を作る。本体は次の8つ。ここから機械的に生成する。

  ラダー工房v2.html   → index.html         （GitHub Pages で配るもの）
  進路シミュレーション.html   → shinro/index.html  （同上。URL を /shinro/ で配るため）
  馬レース.html        → uma/index.html     （同上。文化祭の QR コードは /uma/ を指す）
  翔陽ミニマート.html   → mart/index.html    （同上。文化祭の QR コードは /mart/ を指す）
  サンプラー.html      → sampler/index.html （同上。こえサンプラー）
  メッセージが届くまで.html → network/index.html（同上。TCP/IP 教材。導入スライドの QR は /network/ を指す）
  車の制御50.html     → car/index.html     （同上。電子計測制御・センサ当て。導入スライドの QR は /car/ を指す）
  複線図練習.html     → fukusen/index.html （同上。URL を /fukusen/ で配る）

  python3 build.py                  上の8つを作る
  python3 build.py <出力先.html>    ラダー工房の Artifact 用断片も作る

本体を直したら必ず走らせること。生成物を手で編集してはいけない。
"""
import io, os, sys, shutil

SRC = "ラダー工房v2.html"
SRC2 = "進路シミュレーション.html"
SRC3 = "馬レース.html"
SRC4 = "翔陽ミニマート.html"
SRC5 = "サンプラー.html"
SRC6 = "メッセージが届くまで.html"
SRC7 = "車の制御50.html"
s = io.open(SRC, encoding="utf-8").read()

# 1) GitHub Pages 用。中身は本体そのまま。URL を短くするためだけの複製
shutil.copyfile(SRC, "index.html")
print("生成: index.html")

# 1b) 進路シミュレーション。フォルダに index.html として置き、URL を短くする
os.makedirs("shinro", exist_ok=True)
shutil.copyfile(SRC2, "shinro/index.html")
print("生成: shinro/index.html")

# 1c) 翔陽ダービー（馬レース）。文化祭の来校者に QR で配る
os.makedirs("uma", exist_ok=True)
shutil.copyfile(SRC3, "uma/index.html")
print("生成: uma/index.html")

# 1d) 翔陽ミニマート。文化祭の来校者に QR で配る（持ち帰って遊ぶ）
os.makedirs("mart", exist_ok=True)
shutil.copyfile(SRC4, "mart/index.html")
print("生成: mart/index.html")

# 1e) こえサンプラー。マイクを使うので https の GitHub Pages で配る
os.makedirs("sampler", exist_ok=True)
shutil.copyfile(SRC5, "sampler/index.html")
print("生成: sampler/index.html")

# 1f) メッセージが届くまで（TCP/IP）。コンピュータシステム技術のネットワーク単元
os.makedirs("network", exist_ok=True)
shutil.copyfile(SRC6, "network/index.html")
print("生成: network/index.html")

# 1g) 車の制御50（センサ当て）。電子計測制御の自動車で学ぶ制御
os.makedirs("car", exist_ok=True)
shutil.copyfile(SRC7, "car/index.html")
print("生成: car/index.html")

# 1h) 複線図れんしゅう（第二種電気工事士 技能試験の複線図）
os.makedirs("fukusen", exist_ok=True)
shutil.copyfile("複線図練習.html", "fukusen/index.html")
print("生成: fukusen/index.html")

# 2) Artifact 用。<!DOCTYPE>/<html>/<head>/<body> は claude.ai 側が付けるので剥がす
if len(sys.argv) > 1:
    out = sys.argv[1]
    style = s[s.index("<style>") : s.index("</style>") + len("</style>")]
    body  = s[s.index("<body>") + len("<body>") : s.rindex("</body>")]
    style = style.replace(":root{\n", ":root{\n  color-scheme:light;\n", 1)
    assert "color-scheme:light" in style, "color-scheme の差し込みに失敗"
    frag = "<title>ラダー工房</title>\n" + style + "\n" + body.strip() + "\n"
    for tag in ("<!DOCTYPE", "<html", "</html>", "<head>", "</head>", "<body>", "</body>"):
        assert tag not in frag, "剥がし残し: " + tag
    io.open(out, "w", encoding="utf-8").write(frag)
    print("生成: %s  (%d KB)" % (out, len(frag.encode("utf-8")) // 1024))

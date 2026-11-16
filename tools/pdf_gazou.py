"""PDF を、スマホで見られるページごとの PNG 画像にする。

   使い方: python3 tools/pdf_gazou.py <PDF> [<PDF> ...] [--出力 <フォルダ>] [--長辺 1800]

   既定の出力は、PDF と同じフォルダの 画像/<PDFの名前>-<ページ>.png。
   長辺 1800 画素は、A4 なら約 150dpi、B4 なら約 125dpi。スマホで拡大して文字が読める。
   作った画像の場所を1行ずつ出すので、そのまま PDF と一緒に渡す。

   PDF を作って人に渡すときは毎回これを通す（剛さんはスマホで確かめる。2026-11-16）。
   中で poppler の pdftoppm を使う。無ければ入れる：
     Mac: brew install poppler ／ Ubuntu: sudo apt install poppler-utils
   このファイルは kyouiku と saiten-system の tools/ に同じものを置いている。直すなら両方。
"""
import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path


def gazou(pdf: Path, out: Path, chouhen: int) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    stem = pdf.stem
    # 作り直しで古いページが残らないよう、同じ名前の前の画像を消す
    for old in out.glob(f"{stem}-*.png"):
        if re.fullmatch(re.escape(stem) + r"-\d+\.png", old.name):
            old.unlink()
    subprocess.run(
        ["pdftoppm", "-png", "-scale-to", str(chouhen), str(pdf), str(out / stem)],
        check=True,
    )
    # pdftoppm はページ数が多いと 01 のように0を詰める。ページ順に並べて返す
    files = [p for p in out.glob(f"{stem}-*.png")
             if re.fullmatch(re.escape(stem) + r"-\d+\.png", p.name)]
    return sorted(files, key=lambda p: int(p.stem.rsplit("-", 1)[1]))


def main() -> int:
    ap = argparse.ArgumentParser(description="PDF をページごとの PNG にする（スマホで見る用）")
    ap.add_argument("pdf", nargs="+", type=Path)
    ap.add_argument("--出力", dest="out", type=Path, help="既定は PDF と同じフォルダの 画像/")
    ap.add_argument("--長辺", dest="chouhen", type=int, default=1800, help="画像の長い辺の画素数（既定 1800）")
    a = ap.parse_args()

    if not shutil.which("pdftoppm"):
        print("✗ pdftoppm が無い。Mac: brew install poppler ／ Ubuntu: sudo apt install poppler-utils", file=sys.stderr)
        return 2
    ng = 0
    for pdf in a.pdf:
        if not pdf.is_file():
            print(f"✗ 見つからない: {pdf}", file=sys.stderr)
            ng += 1
            continue
        out = a.out or pdf.parent / "画像"
        for p in gazou(pdf, out, a.chouhen):
            print(p)
    return 1 if ng else 0


if __name__ == "__main__":
    sys.exit(main())

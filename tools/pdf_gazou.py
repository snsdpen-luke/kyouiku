"""PDF を、スマホで見られる縦長の PNG 画像にする（全ページを上から順に1枚につなぐ）。

   使い方: python3 tools/pdf_gazou.py <PDF> [<PDF> ...] [--出力 <フォルダ>] [--長辺 1800] [--ページごと]

   既定の出力は、PDF と同じフォルダの 画像/<PDFの名前>.png。
   ページの境目には灰色の帯を入れる。7ページ以上は6ページずつに分ける（<名前>-1.png, -2.png …）。
   長辺 1800 画素は、A4 なら約 150dpi、B4 なら約 125dpi。スマホで拡大して文字が読める。
   --ページごと を付けると、つながずに1ページ1枚（<名前>-<ページ>.png）にする。
   作った画像の場所を1行ずつ出すので、そのまま PDF と一緒に渡す。

   PDF を作って人に渡すときは毎回これを通す（剛さんはスマホで確かめる。2026-11-16）。
   ページで分かれていると見にくいので、既定でつなぐ（剛さんの判断 2026-11-17）。
   中で poppler の pdftoppm と、つなぐのに Pillow を使う。無ければ入れる：
     Mac: brew install poppler ／ Ubuntu: sudo apt install poppler-utils ／ pip install pillow
   Pillow が無いときは、つながずにページごとの画像を出す。
   このファイルは kyouiku と saiten-system の tools/ に同じものを置いている。直すなら両方。
"""
import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ISSHO = 6     # 1枚につなぐページ数の上限（長すぎるとスマホで縮んで読めない）
SAKAI = 24    # ページの境目の帯の高さ（画素）


def pages(pdf: Path, tmp: Path, chouhen: int) -> list[Path]:
    subprocess.run(["pdftoppm", "-png", "-scale-to", str(chouhen), str(pdf), str(tmp / "p")], check=True)
    # pdftoppm はページ数が多いと 01 のように0を詰める。ページ順に並べる
    return sorted(tmp.glob("p-*.png"), key=lambda p: int(p.stem.rsplit("-", 1)[1]))


def tsunagu(files: list[Path], dst: Path) -> None:
    from PIL import Image
    ims = [Image.open(f).convert("RGB") for f in files]
    w = max(i.width for i in ims)
    h = sum(i.height for i in ims) + SAKAI * (len(ims) - 1)
    out = Image.new("RGB", (w, h), (170, 170, 170))
    y = 0
    for i in ims:
        out.paste(i, ((w - i.width) // 2, y))
        y += i.height + SAKAI
    out.save(dst, optimize=True)


def gazou(pdf: Path, out: Path, chouhen: int, pagegoto: bool) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    stem = pdf.stem
    # 作り直しで古い画像が残らないよう、同じ名前の前の画像を消す
    for old in out.glob(f"{stem}*.png"):
        if re.fullmatch(re.escape(stem) + r"(-\d+)?\.png", old.name):
            old.unlink()
    with tempfile.TemporaryDirectory() as t:
        ps = pages(pdf, Path(t), chouhen)
        if not pagegoto:
            try:
                import PIL  # noqa: F401
            except ImportError:
                print("  （Pillow が無いので、つながずにページごとに出す。pip install pillow）", file=sys.stderr)
                pagegoto = True
        made = []
        if pagegoto:
            for n, p in enumerate(ps, 1):
                dst = out / f"{stem}-{n}.png"
                shutil.move(str(p), dst)
                made.append(dst)
            return made
        kumi = [ps[i:i + ISSHO] for i in range(0, len(ps), ISSHO)]
        for k, g in enumerate(kumi, 1):
            dst = out / (f"{stem}.png" if len(kumi) == 1 else f"{stem}-{k}.png")
            tsunagu(g, dst)
            made.append(dst)
        return made


def main() -> int:
    ap = argparse.ArgumentParser(description="PDF を縦長の PNG にする（スマホで見る用）")
    ap.add_argument("pdf", nargs="+", type=Path)
    ap.add_argument("--出力", dest="out", type=Path, help="既定は PDF と同じフォルダの 画像/")
    ap.add_argument("--長辺", dest="chouhen", type=int, default=1800, help="1ページの長い辺の画素数（既定 1800）")
    ap.add_argument("--ページごと", dest="pagegoto", action="store_true", help="つながずに1ページ1枚にする")
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
        for p in gazou(pdf, a.out or pdf.parent / "画像", a.chouhen, a.pagegoto):
            print(p)
    return 1 if ng else 0


if __name__ == "__main__":
    sys.exit(main())

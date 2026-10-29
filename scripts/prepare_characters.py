"""Creates web-optimized, transparent copies of the SBF character artwork.

Originals in ../Characters are never modified. Backgrounds that are baked in
(white / light checkerboard) are removed via an edge-connected flood fill so
the characters sit cleanly on the dashboard's coloured surfaces.
Run: python scripts/prepare_characters.py
"""
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "Characters"
OUT = ROOT / "public" / "characters"
OUT.mkdir(parents=True, exist_ok=True)

# output name -> (source file, max height, min brightness treated as background)
JOBS = {
    "alex": ("alex (2) (1).png", 900, 232),
    "corix": ("corix (2) (1).png", 900, 236),
    "ecobi": ("ecobi 1 (1).png", 900, 240),
    "iggy": ("formal (2).png", 900, 232),
    "heroes": ("05A8EBA0-1D67-4C6A-95DD-BF61C93F56EA.PNG", 1000, 196),
    "team": ("inv1 (2).png", 900, None),
}


def remove_background(img: Image.Image, min_bright: int) -> Image.Image:
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()

    def is_bg(x, y):
        r, g, b = px[x, y]
        return min(r, g, b) >= min_bright and max(r, g, b) - min(r, g, b) <= 14

    mask = Image.new("L", (w, h), 255)
    m = mask.load()
    q = deque()
    for x in range(w):
        q.extend(((x, 0), (x, h - 1)))
    for y in range(h):
        q.extend(((0, y), (w - 1, y)))
    while q:
        x, y = q.popleft()
        if m[x, y] == 0 or not is_bg(x, y):
            continue
        m[x, y] = 0
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))

    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = rgb.convert("RGBA")
    out.putalpha(mask)
    return out


for name, (file, max_h, min_bright) in JOBS.items():
    img = Image.open(SRC / file)
    scale = min(1.0, max_h / img.height)
    img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    img = img.convert("RGBA") if min_bright is None else remove_background(img, min_bright)
    bbox = img.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
    if bbox:
        img = img.crop(bbox)
    img.save(OUT / f"{name}.png", optimize=True)
    print(f"{name}.png", img.size)

corix = Image.open(OUT / "corix.png")
side = corix.width
avatar = corix.crop((0, 0, side, side)).resize((128, 128), Image.LANCZOS)
avatar.save(OUT / "corix-avatar.png", optimize=True)
print("corix-avatar.png", avatar.size)

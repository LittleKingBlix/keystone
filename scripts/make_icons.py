"""
Generate iPhone home-screen icons for Keystone.
Run from project root: /tmp/keystone-venv/bin/python scripts/make_icons.py
Output: icon-180.png, icon-192.png, icon-512.png, icon-1024.png

Design: cream paper background, subtle grain, off-center bold X mark
in marker style (slight tilt, varying stroke width). Tied to the calendar
cell X used inside the app.
"""

from PIL import Image, ImageDraw, ImageFilter
import random
import os
import sys

PAPER = (244, 234, 213)
PAPER_SHADE = (235, 224, 197)
INK = (42, 38, 32)
INK_SHADOW = (60, 52, 42)

SIZES = [180, 192, 512, 1024]
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def add_paper_grain(img, intensity=12, density_div=30):
    random.seed(42)
    w, h = img.size
    px = img.load()
    for _ in range(w * h // density_div):
        x = random.randint(0, w - 1)
        y = random.randint(0, h - 1)
        shade = random.randint(0, intensity)
        c = px[x, y]
        px[x, y] = tuple(max(0, v - shade) for v in c[:3])


def make_icon(size):
    # Render at 4x supersample for clean edges, then downsample.
    SS = 4
    s = size * SS

    bg = Image.new('RGB', (s, s), PAPER)

    # Paper grain at native resolution after downsample, so do it on a final-size pass.
    # For now, draw shapes on the supersampled canvas.

    draw = ImageDraw.Draw(bg)

    # Subtle inner border, like a calendar cell edge
    border_inset = int(s * 0.08)
    border_w = max(2, s // 250)
    draw.rectangle(
        [border_inset, border_inset, s - border_inset, s - border_inset],
        outline=PAPER_SHADE, width=border_w * 2
    )
    draw.rectangle(
        [border_inset + border_w * 2, border_inset + border_w * 2,
         s - border_inset - border_w * 2, s - border_inset - border_w * 2],
        outline=INK, width=border_w
    )

    # Big X on a transparent layer so we can rotate it cleanly
    x_layer = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    draw_x = ImageDraw.Draw(x_layer)
    pad = int(s * 0.22)
    stroke_w = max(8, s // 14)

    # Subtle "shadow" under the stroke for depth
    shadow_offset = max(2, s // 400)
    draw_x.line(
        [(pad + shadow_offset, pad + shadow_offset),
         (s - pad + shadow_offset, s - pad + shadow_offset)],
        fill=INK_SHADOW + (90,), width=stroke_w
    )
    draw_x.line(
        [(s - pad + shadow_offset, pad + shadow_offset),
         (pad + shadow_offset, s - pad + shadow_offset)],
        fill=INK_SHADOW + (90,), width=stroke_w
    )

    # Main strokes
    draw_x.line(
        [(pad, pad), (s - pad, s - pad)],
        fill=INK + (255,), width=stroke_w
    )
    draw_x.line(
        [(s - pad, pad), (pad, s - pad)],
        fill=INK + (255,), width=stroke_w
    )

    # Slight rotation for a hand-drawn marker feel
    x_layer = x_layer.rotate(-8, resample=Image.BICUBIC)

    bg.paste(x_layer, (0, 0), x_layer)

    # Downsample to target size
    final = bg.resize((size, size), Image.LANCZOS)

    # Add grain at final resolution so the dots stay visible
    add_paper_grain(final, intensity=10, density_div=40)

    return final


def main():
    for sz in SIZES:
        img = make_icon(sz)
        out = os.path.join(OUT_DIR, f'icon-{sz}.png')
        img.save(out, 'PNG', optimize=True)
        kb = os.path.getsize(out) // 1024
        print(f'Wrote {out} ({sz}x{sz}, {kb}KB)')


if __name__ == '__main__':
    main()

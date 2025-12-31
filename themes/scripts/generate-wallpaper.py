#!/usr/bin/env python3
"""Generate solid color PNG wallpapers for themes.

Usage:
    python3 generate-wallpaper.py "#1a1b26" tokyo-night.png
    python3 generate-wallpaper.py "#1d2021" gruvbox.png
"""

import struct
import zlib
import sys
import os
import re

WIDTH = 5120
HEIGHT = 2880


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    hex_color = hex_color.lstrip("#")
    if len(hex_color) != 6:
        raise ValueError(f"Invalid hex color: #{hex_color}")
    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return (r, g, b)


def create_solid_png(width: int, height: int, r: int, g: int, b: int, filename: str) -> None:
    def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
        chunk_len = struct.pack(">I", len(data))
        chunk_crc = struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        return chunk_len + chunk_type + data + chunk_crc

    signature = b"\x89PNG\r\n\x1a\n"

    # IHDR: Width, Height, Bit depth=8, Color type=2 (RGB), Compression=0, Filter=0, Interlace=0
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    ihdr = png_chunk(b"IHDR", ihdr_data)

    # IDAT: Row format is [filter_byte=0, R, G, B, R, G, B, ...] repeated for each row
    row = bytes([0] + [r, g, b] * width)
    compressed = zlib.compress(row * height, 9)
    idat = png_chunk(b"IDAT", compressed)

    iend = png_chunk(b"IEND", b"")

    with open(filename, "wb") as f:
        f.write(signature + ihdr + idat + iend)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        print("Arguments: <hex_color> <output_filename>")
        print(f"\nExample: {sys.argv[0]} '#1a1b26' tokyo-night.png")
        sys.exit(1)

    hex_color = sys.argv[1]
    output_file = sys.argv[2]

    if not re.match(r"^#?[0-9a-fA-F]{6}$", hex_color):
        print(f"Error: Invalid hex color '{hex_color}'. Use format #RRGGBB")
        sys.exit(1)

    try:
        r, g, b = hex_to_rgb(hex_color)
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)

    if "/" not in output_file:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        output_file = os.path.join(script_dir, "..", "wallpapers", output_file)

    create_solid_png(WIDTH, HEIGHT, r, g, b, output_file)
    print(f"Created {WIDTH}x{HEIGHT} wallpaper: {output_file}")
    print(f"Color: {hex_color} (RGB: {r}, {g}, {b})")


if __name__ == "__main__":
    main()

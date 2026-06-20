"""Génère les icônes PNG pour la PWA (stdlib uniquement)."""
import os
import struct
import zlib

ICONS_DIR = os.path.join(os.path.dirname(__file__), "icons")


def write_png(path, width, height, rgb):
    r, g, b = rgb

    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    row = b"\x00" + bytes([r, g, b]) * width
    raw = row * height

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)

    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", zlib.compress(raw, 9)))
        f.write(chunk(b"IEND", b""))


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    purple = (109, 40, 217)
    write_png(os.path.join(ICONS_DIR, "icon-192.png"), 192, 192, purple)
    write_png(os.path.join(ICONS_DIR, "icon-512.png"), 512, 512, purple)
    print("Icones PWA generees : icons/icon-192.png, icons/icon-512.png")


if __name__ == "__main__":
    main()

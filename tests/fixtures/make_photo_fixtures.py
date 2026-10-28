#!/usr/bin/env python3
"""Makes Photo mode's test files from nothing but this script and ffmpeg:

  scene.dng   a real raw file: an RGGB Bayer mosaic, 16 bits, uncompressed,
              with the DNG tags a raw converter needs (the camera's colours
              are linear sRGB, so the picture comes out as drawn)
  scene.tif   a TIFF, RGB, deflate-compressed (so the decoder's zlib is used)
  scene.heic  a HEIC: one HEVC picture (ffmpeg's libx265) in a HEIF file
              written here box by box

The picture: a sky from light blue to lilac, a red circle on the left and a
blue square on the right, 240 x 160. Run: python3 make_photo_fixtures.py
"""
import os, struct, subprocess, tempfile, zlib

W, H = 240, 160
HERE = os.path.dirname(os.path.abspath(__file__))


def scene():
    px = []
    for y in range(H):
        row = []
        t = y / (H - 1)
        for x in range(W):
            c = (int(110 + 60 * t), int(160 - 10 * t), int(220 - 10 * t))
            if (x - 60) ** 2 + (y - 80) ** 2 < 36 ** 2:
                c = (226, 40, 36)
            if 150 <= x < 200 and 55 <= y < 105:
                c = (30, 32, 170)
            row.append(c)
        px.append(row)
    return px


def lin(v):
    v /= 255
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


# ---- TIFF / DNG: little-endian, one IFD, tags sorted ----
def tiff_file(tags, data):
    """tags: (tag, type, values); type 1 BYTE 2 ASCII 3 SHORT 4 LONG 5 RATIONAL 10 SRATIONAL"""
    size = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 10: 8}
    tags = sorted(tags)
    ifd = 8
    extra = ifd + 2 + len(tags) * 12 + 4
    blobs, ents = b'', []
    data_at = None
    for tag, typ, vals in tags:
        if typ == 2:
            raw = vals.encode() + b'\0'
            n = len(raw)
        else:
            n = len(vals) // (2 if typ in (5, 10) else 1)
            fmt = {1: 'B', 3: 'H', 4: 'I', 5: 'I', 10: 'i'}[typ]
            raw = struct.pack('<' + fmt * len(vals), *vals)
        if len(raw) <= 4:
            ents.append((tag, typ, n, raw.ljust(4, b'\0'), None))
        else:
            ents.append((tag, typ, n, None, extra + len(blobs)))
            blobs += raw
            if len(blobs) % 2:
                blobs += b'\0'
    data_at = extra + len(blobs)
    out = b'II*\0' + struct.pack('<I', ifd) + struct.pack('<H', len(ents))
    for tag, typ, n, inline, off in ents:
        if tag == 273:  # (the strip, after everything else)
            inline = struct.pack('<I', data_at)
        out += struct.pack('<HHI', tag, typ, n) + (inline if inline is not None else struct.pack('<I', off))
    out += struct.pack('<I', 0) + blobs + data
    return out


def make_dng(px):
    cfa = [[0, 1], [1, 2]]  # RGGB
    mos = bytearray()
    for y in range(H):
        for x in range(W):
            ch = cfa[y % 2][x % 2]
            mos += struct.pack('<H', round(lin(px[y][x][ch]) * 65535))
    # XYZ (D65) to camera: the camera is linear sRGB, so the inverse of sRGB's matrix
    cm = [3.2406, -1.5372, -0.4986, -0.9689, 1.8758, 0.0415, 0.0557, -0.2040, 1.0570]
    srat = []
    for v in cm:
        srat += [round(v * 10000), 10000]
    tags = [
        (254, 4, [0]), (256, 4, [W]), (257, 4, [H]), (258, 3, [16]), (259, 3, [1]), (262, 3, [32803]),
        (271, 2, 'Paint Alternative'), (272, 2, 'Test Raw'), (273, 4, [0]), (274, 3, [1]), (277, 3, [1]),
        (278, 4, [H]), (279, 4, [len(mos)]), (284, 3, [1]),
        (33421, 3, [2, 2]), (33422, 1, [0, 1, 1, 2]),
        (50706, 1, [1, 4, 0, 0]), (50707, 1, [1, 1, 0, 0]), (50708, 2, 'Paint Alternative Test Raw'),
        (50714, 4, [0]), (50717, 4, [65535]), (50721, 10, srat), (50728, 5, [1, 1, 1, 1, 1, 1]), (50778, 3, [21]),
    ]
    return tiff_file(tags, bytes(mos))


def make_tiff(px):
    raw = bytearray()
    for y in range(H):
        for x in range(W):
            raw += bytes(px[y][x])
    z = zlib.compress(bytes(raw), 9)
    tags = [(256, 4, [W]), (257, 4, [H]), (258, 3, [8, 8, 8]), (259, 3, [8]), (262, 3, [2]), (273, 4, [0]),
            (277, 3, [3]), (278, 4, [H]), (279, 4, [len(z)]), (284, 3, [1])]
    return tiff_file(tags, z)


# ---- HEIC: ffmpeg makes the HEVC picture; the boxes round it are written here ----
def box(t, body):
    return struct.pack('>I', 8 + len(body)) + t + body


def fbox(t, ver, flags, body):
    return box(t, struct.pack('>I', (ver << 24) | flags) + body)


def nals(stream):
    out, i, n = [], 0, len(stream)
    starts = []
    while i < n - 3:
        if stream[i:i + 3] == b'\0\0\1':
            starts.append(i + 3)
            i += 3
        else:
            i += 1
    for k, s in enumerate(starts):
        e = starts[k + 1] - 3 if k + 1 < len(starts) else n
        while e > s and stream[e - 1] == 0:
            e -= 1
        out.append(stream[s:e])
    return out


def make_heic(px):
    with tempfile.TemporaryDirectory() as d:
        rgb = os.path.join(d, 'in.rgb')
        with open(rgb, 'wb') as f:
            for row in px:
                for c in row:
                    f.write(bytes(c))
        hv = os.path.join(d, 'out.hevc')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '%dx%d' % (W, H), '-i', rgb,
                        '-frames:v', '1', '-c:v', 'libx265', '-pix_fmt', 'yuv420p', '-x265-params', 'log-level=error:keyint=1',
                        '-f', 'hevc', hv], check=True)
        stream = open(hv, 'rb').read()
    units = nals(stream)
    kind = lambda u: (u[0] >> 1) & 0x3f
    vps = [u for u in units if kind(u) == 32]
    sps = [u for u in units if kind(u) == 33]
    pps = [u for u in units if kind(u) == 34]
    pics = [u for u in units if kind(u) < 32]
    # hvcC from the SPS's profile, tier and level (the bytes just after its header)
    p = sps[0][2:]  # (the 2-byte NAL header gone)
    ptl = p[1:13]  # (profile_space..level_idc: 12 bytes after the first byte of the SPS)
    hvcc = bytes([1]) + ptl[0:1] + ptl[1:5] + ptl[5:11] + ptl[11:12]
    hvcc += struct.pack('>H', 0xF000) + bytes([0xFC, 0xFD, 0xF8, 0xF8]) + struct.pack('>H', 0) + bytes([0x0F])
    arrays = b''
    for t, us in ((32, vps), (33, sps), (34, pps)):
        arrays += bytes([0x80 | t]) + struct.pack('>H', len(us))
        for u in us:
            arrays += struct.pack('>H', len(u)) + u
    hvcc += bytes([3]) + arrays
    data = b''.join(struct.pack('>I', len(u)) + u for u in pics)
    ftyp = box(b'ftyp', b'heic' + struct.pack('>I', 0) + b'mif1heic')
    hdlr = fbox(b'hdlr', 0, 0, struct.pack('>I', 0) + b'pict' + b'\0' * 12 + b'\0')
    pitm = fbox(b'pitm', 0, 0, struct.pack('>H', 1))
    infe = fbox(b'infe', 2, 0, struct.pack('>HH', 1, 0) + b'hvc1' + b'\0')
    iinf = fbox(b'iinf', 0, 0, struct.pack('>H', 1) + infe)
    ipco = box(b'ipco', box(b'hvcC', hvcc) + fbox(b'ispe', 0, 0, struct.pack('>II', W, H)))
    ipma = fbox(b'ipma', 0, 0, struct.pack('>I', 1) + struct.pack('>HB', 1, 2) + bytes([0x81, 0x02]))
    iprp = box(b'iprp', ipco + ipma)

    def meta_with(off):
        iloc = fbox(b'iloc', 0, 0, bytes([0x44, 0x00]) + struct.pack('>H', 1) + struct.pack('>HHH', 1, 0, 1) + struct.pack('>II', off, len(data)))
        return fbox(b'meta', 0, 0, hdlr + pitm + iloc + iinf + iprp)
    m = meta_with(0)
    off = len(ftyp) + len(m) + 8
    return ftyp + meta_with(off) + box(b'mdat', data)


if __name__ == '__main__':
    px = scene()
    for name, fn in (('scene.dng', make_dng), ('scene.tif', make_tiff), ('scene.heic', make_heic)):
        b = fn(px)
        with open(os.path.join(HERE, name), 'wb') as f:
            f.write(b)
        print(name, len(b), 'bytes')

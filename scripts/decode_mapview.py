#!/usr/bin/env python3
"""Restore patched MapView.tsx from compressed payload."""
import zlib, base64, pathlib
root = pathlib.Path(__file__).resolve().parent
b64 = (root / "mapview.zlib.b64").read_text().strip()
data = zlib.decompress(base64.b64decode(b64))
out = root.parent / "src" / "components" / "map" / "MapView.tsx"
out.write_bytes(data)
print(f"wrote {out} ({len(data)} bytes)")

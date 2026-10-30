#!/usr/bin/env python3
"""Restore MapView.tsx from compressed parts. Run: python3 scripts/decode_mapview.py"""
import zlib, base64, pathlib, sys
root = pathlib.Path(__file__).resolve().parent
parts = [root / f"mapview.p{i}.b64" for i in range(4)]
missing = [p for p in parts if not p.exists()]
if missing:
    print("Missing:", missing, file=sys.stderr)
    sys.exit(1)
b64 = "".join(p.read_text().strip() for p in parts)
data = zlib.decompress(base64.b64decode(b64))
out = root.parent / "src" / "components" / "map" / "MapView.tsx"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(data)
print(f"OK wrote {out} ({len(data)} bytes)")

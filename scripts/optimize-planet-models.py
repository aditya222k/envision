"""Resize embedded NASA GLB textures; preserve meshes, UVs and materials.

Requires Pillow. Usage: python3 scripts/optimize-planet-models.py /tmp
Source files: <folder>/envision-<body>.glb for the Sun and all eight planets.
"""

import io
import json
from pathlib import Path
import struct
import sys

from PIL import Image

output = Path(__file__).resolve().parents[1] / "public/solar-system/models"
output.mkdir(parents=True, exist_ok=True)

for name in ("mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "sun"):
    source = (Path(sys.argv[1]) / f"envision-{name}.glb").read_bytes()
    json_size = struct.unpack_from("<I", source, 12)[0]
    document = json.loads(source[20:20 + json_size])
    binary = source[28 + json_size:]
    replacements = {}
    for image in document.get("images", []):
        index = image["bufferView"]
        view = document["bufferViews"][index]
        start = view.get("byteOffset", 0)
        texture = Image.open(io.BytesIO(binary[start:start + view["byteLength"]]))
        texture.thumbnail((1536, 1536), Image.Resampling.LANCZOS)
        encoded = io.BytesIO()
        # Preserve Saturn's transparent ring gaps; opaque RGBA maps can be JPEG.
        has_alpha = "A" in texture.getbands() and texture.getchannel("A").getextrema()[0] < 255
        if "norm" in image.get("name", "") or has_alpha:
            texture.save(encoded, "PNG", optimize=True)
            image["mimeType"] = "image/png"
        else:
            texture.convert("RGB").save(encoded, "JPEG", quality=88, optimize=True)
            image["mimeType"] = "image/jpeg"
        replacements[index] = encoded.getvalue()

    packed = bytearray()
    for index, view in enumerate(document["bufferViews"]):
        start = view.get("byteOffset", 0)
        chunk = replacements.get(index, binary[start:start + view["byteLength"]])
        packed.extend(b"\0" * (-len(packed) % 4))
        view["byteOffset"] = len(packed)
        view["byteLength"] = len(chunk)
        packed.extend(chunk)
    document["buffers"][0]["byteLength"] = len(packed)
    packed.extend(b"\0" * (-len(packed) % 4))
    metadata = json.dumps(document, separators=(",", ":")).encode()
    metadata += b" " * (-len(metadata) % 4)
    result = (
        struct.pack("<III", 0x46546C67, 2, 28 + len(metadata) + len(packed))
        + struct.pack("<II", len(metadata), 0x4E4F534A) + metadata
        + struct.pack("<II", len(packed), 0x004E4942) + packed
    )
    (output / f"{name}.glb").write_bytes(result)
    print(f"{name}: {len(source):,} → {len(result):,} bytes")

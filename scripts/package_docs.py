from pathlib import Path
import zipfile, sys

ROOT = Path(__file__).resolve().parents[1]
PHASES = ["phase-1-requirements", "phase-2-design", "phase-3-delivery"]

def validate_phase(name):
    d = ROOT / name
    files = sorted(d.glob("[0-9][0-9]_*.md"))
    errors = []
    if len(files) != 10:
        errors.append(f"{name}: expected 10 numbered docs, found {len(files)}")
    if not (d/"README.md").exists():
        errors.append(f"{name}: README.md missing")
    for f in files:
        if f.stat().st_size == 0:
            errors.append(f"{name}: empty file {f.name}")
    return errors

def make_zip(zip_path, paths, base):
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for p in paths:
            if p.is_file():
                z.write(p, p.relative_to(base))
            else:
                for f in p.rglob("*"):
                    if f.is_file():
                        z.write(f, f.relative_to(base))

errors=[]
for p in PHASES:
    errors += validate_phase(p)
if errors:
    print("\n".join(errors))
    sys.exit(1)

for p in PHASES:
    make_zip(ROOT/f"{p}.zip", [ROOT/p], ROOT)

make_zip(
    ROOT/"project-documentation-complete.zip",
    [ROOT/"README.md", ROOT/"00_문서목록_및_추적성.md"] + [ROOT/p for p in PHASES] + [ROOT/"scripts"],
    ROOT
)
print("OK: all packages created")

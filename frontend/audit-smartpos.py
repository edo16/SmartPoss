from pathlib import Path
from collections import Counter
import re

ROOT = Path(".")
EXCLUDE = {"node_modules", ".git", "dist", "build"}

def files_with(exts):
    return [
        p for p in ROOT.rglob("*")
        if p.is_file()
        and p.suffix.lower() in exts
        and not any(part in EXCLUDE for part in p.parts)
    ]

css_files = files_with({".css"})
html_files = files_with({".html"})
js_files = files_with({".js"})

print("\n========== FILES ==========")
for group, files in [
    ("CSS", css_files),
    ("HTML", html_files),
    ("JAVASCRIPT", js_files),
]:
    print(f"\n{group}: {len(files)} file")
    for p in files:
        print(f"  {p}")

print("\n========== CSS DUPLICATE SELECTORS ==========")
selector_counts = Counter()
selector_locations = {}

for p in css_files:
    content = p.read_text(errors="replace")
    # Hapus komentar CSS sebelum pemindaian sederhana.
    content = re.sub(r"/\*.*?\*/", "", content, flags=re.S)

    # Temukan selector sebelum tanda {.
    for match in re.finditer(r"([^{}]+)\{", content):
        selector = match.group(1).strip()
        if not selector or "@" in selector:
            continue
        selector = re.sub(r"\s+", " ", selector)
        selector_counts[selector] += 1
        selector_locations.setdefault(selector, []).append(str(p))

for selector, count in selector_counts.most_common():
    if count > 1:
        locations = ", ".join(sorted(set(selector_locations[selector])))
        print(f"{count}x  {selector}\n     file: {locations}")

print("\n========== CSS SELECTOR REFERENCES ==========")
all_html = "\n".join(p.read_text(errors="replace") for p in html_files)
all_js = "\n".join(p.read_text(errors="replace") for p in js_files)

ids = set(re.findall(r"""id\s*=\s*["']([^"']+)["']""", all_html))
classes = set()
for value in re.findall(r"""class\s*=\s*["']([^"']+)["']""", all_html):
    classes.update(value.split())

js_ids = set(re.findall(
    r"""getElementById\(\s*["']([^"']+)["']\s*\)""", all_js
))
js_classes = set()
for pattern in [
    r"""querySelector(?:All)?\(\s*["'][^"']*\.([a-zA-Z_-][\w-]*)""",
    r"""classList\.(?:add|remove|toggle|contains)\(\s*["']([^"']+)["']""",
]:
    js_classes.update(re.findall(pattern, all_js))

print("\nHTML IDs:", len(ids))
print("HTML classes:", len(classes))
print("IDs referenced by JS but absent in HTML (may be dynamically created):")
for value in sorted(js_ids - ids):
    print("  #" + value)

print("\nClasses referenced by JS but absent in static HTML (may be dynamic):")
for value in sorted(js_classes - classes):
    print("  ." + value)

print("\n========== DONE ==========")
print("Audit ini indikator awal, bukan dasar otomatis untuk menghapus CSS.")

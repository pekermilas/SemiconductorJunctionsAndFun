"""Assemble the single-file offline app: python build.py  ->  PNJunction.html"""
from pathlib import Path
root = Path(__file__).parent
plotly = (root / "vendor" / "plotly-basic.min.js").read_text(encoding="utf-8")
safe = lambda js: js.replace("</script", "<\\/script")
html = (root / "src" / "template.html").read_text(encoding="utf-8")
for tag, js in (("__PLOTLY__", plotly), ("__PHYSICS__", (root / "src" / "physics.js").read_text(encoding="utf-8")),
                ("__UI__", (root / "src" / "ui.js").read_text(encoding="utf-8"))):
    html = html.replace(f"/*{tag}*/", safe(js), 1)
(root / "PNJunction.html").write_text(html, encoding="utf-8")
print(f"PNJunction.html written ({len(html.encode()) / 1e6:.2f} MB)")

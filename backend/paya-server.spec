# PyInstaller spec: bundles the Django project, the built panel (web/) and the exercise library data.
# Build (from backend/, with the panel built at ../apps/web/dist):  pyinstaller paya-server.spec
from PyInstaller.utils.hooks import collect_all, collect_submodules

datas, binaries, hidden = [], [], []
for pkg in ["django", "rest_framework", "rest_framework_simplejwt", "corsheaders", "django_filters", "drf_spectacular",
            "channels", "daphne", "autobahn", "twisted", "zope.interface", "weasyprint", "pyphen", "cssselect2", "tinycss2", "pydyf", "fontTools"]:
    d, b, h = collect_all(pkg)
    datas += d; binaries += b; hidden += h
# collect_submodules imports each module and silently skips the ones that need configured settings (asgi,
# consumers, …), so list every project module by file instead.
import os
for app in ["config", "accounts", "coaching", "core", "messaging", "tracking", "training"]:
    for root, dirs, files in os.walk(app):
        dirs[:] = [d for d in dirs if d not in ("__pycache__", "tests")]
        for f in files:
            if f.endswith(".py"):
                mod = os.path.join(root, f)[:-3].replace(os.sep, ".")
                hidden.append(mod[: -len(".__init__")] if mod.endswith(".__init__") else mod)
datas += [("../apps/web/dist", "web")]
# every non-Python file of the project's apps (JSON data loaded by migrations, PDF templates/fonts, library photos…)
import os
for app in ["config", "accounts", "coaching", "core", "messaging", "tracking", "training"]:
    for root, dirs, files in os.walk(app):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for f in files:
            if not f.endswith((".py", ".pyc")):
                datas.append((os.path.join(root, f), root))
hidden += ["twisted.internet.asyncioreactor", "channels.layers", "daphne.cli", "psycopg"]

a = Analysis(["desktop_entry.py"], pathex=["."], binaries=binaries, datas=datas, hiddenimports=hidden, noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="paya-server", console=True)
coll = COLLECT(exe, a.binaries, a.datas, name="paya-server")

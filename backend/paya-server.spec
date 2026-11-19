# PyInstaller spec: bundles the Django project, the built panel (web/) and the exercise library data.
# Build (from backend/, with the panel built at ../apps/web/dist):  pyinstaller paya-server.spec
from PyInstaller.utils.hooks import collect_all, collect_submodules

datas, binaries, hidden = [], [], []
for pkg in ["django", "rest_framework", "rest_framework_simplejwt", "corsheaders", "django_filters", "drf_spectacular",
            "channels", "daphne", "autobahn", "twisted", "zope.interface", "weasyprint", "pyphen", "cssselect2", "tinycss2", "pydyf", "fontTools"]:
    d, b, h = collect_all(pkg)
    datas += d; binaries += b; hidden += h
for app in ["config", "accounts", "coaching", "core", "messaging", "tracking", "training"]:
    hidden += collect_submodules(app)
datas += [("../apps/web/dist", "web"), ("training/library", "training/library"), ("core/templates", "core/templates"), ("core/pdf", "core/pdf")]
hidden += ["twisted.internet.asyncioreactor", "channels.layers", "daphne.cli", "psycopg"]

a = Analysis(["desktop_entry.py"], pathex=["."], binaries=binaries, datas=datas, hiddenimports=hidden, noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="paya-server", console=True)
coll = COLLECT(exe, a.binaries, a.datas, name="paya-server")

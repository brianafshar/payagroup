"""Serves the built coach panel (apps/web/dist) from PAYA_WEB_DIR for the desktop build: real files as they
are, every other path falls back to index.html (client-side routing)."""

from pathlib import Path

from django.conf import settings
from django.http import Http404
from django.views.static import serve


def spa(request, *args, **kwargs):
    root = Path(settings.WEB_DIR).resolve()
    rel = request.path.lstrip("/")
    target = (root / rel).resolve()
    if rel and target.is_file() and root in target.parents:
        return serve(request, rel, document_root=root)
    if not (root / "index.html").is_file():
        raise Http404("The panel is not built.")
    return serve(request, "index.html", document_root=root)

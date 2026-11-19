"""Entry point of the bundled Windows server (PyInstaller). Electron starts it as `paya-server.exe <port>`.

Data lives in %APPDATA%/PAYA Group (database, uploaded files, secret key). On the first run it creates the
admin and the head coach and writes their sign-in details to «اطلاعات-ورود.txt» in that folder."""

import io
import json
import os
import secrets
import sys
from pathlib import Path


def data_dir() -> Path:
    base = os.environ.get("PAYA_DATA_DIR") or (Path(os.environ.get("APPDATA") or Path.home()) / "PAYA Group")
    p = Path(base)
    p.mkdir(parents=True, exist_ok=True)
    return p


def bundle_dir() -> Path:
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))


def main() -> None:
    # autobahn (via daphne) would compile an optional C accelerator with cffi at import — not possible in the bundle.
    os.environ["AUTOBAHN_USE_NVX"] = "0"
    port = sys.argv[1] if len(sys.argv) > 1 else "8765"
    data = data_dir()
    key_file = data / "secret.key"
    if not key_file.exists():
        key_file.write_text(secrets.token_urlsafe(50))
    web = os.environ.get("PAYA_WEB_DIR") or str(bundle_dir() / "web")
    os.environ.update(
        PAYA_DESKTOP="1",
        PAYA_DATA_DIR=str(data),
        PAYA_WEB_DIR=web,
        DJANGO_DEBUG="0",
        DJANGO_SECRET_KEY=key_file.read_text().strip(),
        DJANGO_ALLOWED_HOSTS="127.0.0.1,localhost",
        DJANGO_SETTINGS_MODULE="config.settings",
        PUSH_BACKEND="off",
        EXERCISE_ILLUSTRATIONS="0",  # first start must not wait on downloads; they are filled in the background
    )
    sys.path.insert(0, str(bundle_dir()))
    import django
    from django.core.management import call_command

    django.setup()
    call_command("migrate", interactive=False, verbosity=0)
    buf = io.StringIO()
    call_command("bootstrap_gym", stdout=buf)
    created = json.loads(buf.getvalue() or "{}")
    created.pop("at", None)
    if created:
        lines = ["اطلاعات ورود PAYA Group — این فایل را در جای امن نگه دارید و بعد از ورود، رمزها را تغییر دهید.", ""]
        if "head_coach" in created:
            lines += ["سرمربی:", f"  نام کاربری: {created['head_coach']['username']}", f"  رمز عبور: {created['head_coach']['password']}", ""]
        if "admin" in created:
            lines += ["مدیر سیستم (پشتیبانی):", f"  نام کاربری: {created['admin']['username']}", f"  رمز عبور: {created['admin']['password']}", ""]
        (data / "اطلاعات-ورود.txt").write_text("\n".join(lines), encoding="utf-8")
        (data / "first-run.json").write_text(json.dumps(created), encoding="utf-8")
    import threading

    def fill_illustrations() -> None:
        """Download the exercise illustrations once the app is up (needs internet; silently skipped offline)."""
        try:
            from django.conf import settings

            from coaching.models import Coach
            from training import library

            settings.EXERCISE_ILLUSTRATIONS = True
            for coach in Coach.objects.filter(is_head=True):
                library.install(coach)
        except Exception:  # best effort
            pass

    threading.Thread(target=fill_illustrations, daemon=True).start()
    from daphne.cli import CommandLineInterface

    CommandLineInterface().run(["-b", "127.0.0.1", "-p", port, "config.asgi:application"])


if __name__ == "__main__":
    main()
